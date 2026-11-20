-- Inventory TTV: เบิกออกจาก PDF ของเว็บ seller พร้อมกันเบิกซ้ำด้วยเลขคำสั่งซื้อ (2026-11-20)
-- รันใน Supabase SQL Editor ได้ซ้ำโดยไม่พัง ไม่แตะข้อมูลเดิม ต้องมี migration_roles.sql และ migration_batch_issue.sql แล้ว
--
-- online_issued_orders: คำสั่งซื้อที่เบิกไปแล้ว (แพลตฟอร์ม + เลขคำสั่งซื้อ + SKU ใน PDF) ใช้ข้ามคำสั่งซื้อที่เคยเบิก
-- record_online_issue: บันทึกคำสั่งซื้อ + เบิกออกทุกรายการใน transaction เดียว (ทั้งใบหรือไม่เอาเลย)
-- ใช้ได้เฉพาะ admin / store_qc (ผู้ใช้กำหนด 2026-11-19)

create table if not exists public.online_issued_orders (
  platform      text not null,
  order_no      text not null,
  sku           text not null,
  movement_date date not null,
  created_by    uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now(),
  constraint online_issued_orders_pkey primary key (platform, order_no, sku),
  constraint online_issued_orders_platform_valid check (platform in ('shopee', 'lazada', 'tiktok')),
  constraint online_issued_orders_order_no_valid check (length(order_no) between 1 and 64),
  constraint online_issued_orders_sku_valid check (length(sku) between 1 and 200)
);

create index if not exists online_issued_orders_created_by_idx
  on public.online_issued_orders using btree (created_by);

alter table public.online_issued_orders enable row level security;

drop policy if exists online_issued_orders_select_with_role on public.online_issued_orders;
create policy online_issued_orders_select_with_role on public.online_issued_orders
  for select to authenticated
  using ((select public.current_app_role()) is not null);

drop policy if exists online_issued_orders_insert_full_access on public.online_issued_orders;
create policy online_issued_orders_insert_full_access on public.online_issued_orders
  for insert to authenticated
  with check ((select public.current_app_role()) in ('admin', 'store_qc') and created_by = (select auth.uid()));

-- ไม่มีสิทธิ์แก้ไข/ลบ (ประวัติการเบิกต้องคงอยู่)
revoke all on table public.online_issued_orders from anon;
revoke update, delete, truncate on table public.online_issued_orders from authenticated;
grant select, insert on table public.online_issued_orders to authenticated;

-- p_items  = เหมือน record_movements [{ product_id, type: 'out', quantity, note }]
-- p_orders = [{ platform, order_no, sku }]
create or replace function public.record_online_issue(
  p_items         jsonb,
  p_orders        jsonb,
  p_movement_date date default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dup   text;
  v_saved integer;
begin
  if (select public.current_app_role()) is distinct from 'admin' and (select public.current_app_role()) is distinct from 'store_qc' then
    raise exception 'เบิกออกจาก PDF ได้เฉพาะเจ้าของร้านและ Store/QC' using errcode = '42501', hint = 'pdf_issue_forbidden';
  end if;

  if p_orders is null or jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) = 0 then
    raise exception 'ไม่มีเลขคำสั่งซื้อ' using hint = 'empty_orders';
  end if;

  if jsonb_array_length(p_orders) > 2000 then
    raise exception 'คำสั่งซื้อมากเกินไปในครั้งเดียว' using hint = 'too_many_items';
  end if;

  select string_agg(distinct t.order_no, ', ') into v_dup
  from jsonb_array_elements(p_orders) as o
  join public.online_issued_orders as t
    on t.platform = o ->> 'platform' and t.order_no = o ->> 'order_no' and upper(t.sku) = upper(o ->> 'sku');
  if v_dup is not null then
    raise exception 'มีคำสั่งซื้อที่เบิกไปแล้ว: %', v_dup using hint = 'duplicate_order';
  end if;

  insert into public.online_issued_orders (platform, order_no, sku, movement_date)
  select distinct o ->> 'platform', o ->> 'order_no', o ->> 'sku', coalesce(p_movement_date, (now() at time zone 'Asia/Bangkok')::date)
  from jsonb_array_elements(p_orders) as o;

  v_saved := public.record_movements(p_items, p_movement_date);
  return v_saved;
end;
$$;

revoke all on function public.record_online_issue(jsonb, jsonb, date) from public, anon;
grant execute on function public.record_online_issue(jsonb, jsonb, date) to authenticated;
