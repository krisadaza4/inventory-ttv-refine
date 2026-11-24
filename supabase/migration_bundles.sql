-- Inventory TTV: ชุดสินค้า (Bundle) สำหรับเบิกออกจาก PDF (2026-11-24)
-- รันใน Supabase SQL Editor ได้ซ้ำโดยไม่พัง ไม่แตะข้อมูลเดิม
--
-- รหัสชุดใน PDF ของ seller (เช่น GL-203R-P1) ไม่ใช่สินค้าในสต็อก ร้านหยิบชิ้นส่วนมาจัดตอนแพ็กออเดอร์ (ผู้ใช้กำหนด 2026-11-24)
-- ตอนเบิกจาก PDF แอปแตกชุดเป็นชิ้นส่วนตามตารางนี้ (จำนวนชิ้นส่วน = จำนวนชุด × quantity)
-- รหัสชุดเก็บเป็นตัวพิมพ์ใหญ่ ไม่มีช่องว่างหัวท้าย (แอปเทียบแบบไม่สนตัวพิมพ์)
-- จัดการได้เฉพาะ admin / store_qc ทุกบทบาทดูได้
-- ถ้ารหัสชุดตรงกับสินค้าในสต็อกด้วย แอปถือว่าเป็นชุด (แตกเป็นชิ้นส่วน)

create table if not exists public.product_bundles (
  sku        text not null,
  updated_by uuid not null default auth.uid() references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint product_bundles_pkey primary key (sku),
  constraint product_bundles_sku_valid check (length(sku) between 1 and 100 and sku = upper(btrim(sku)))
);

create table if not exists public.product_bundle_items (
  bundle_sku text not null references public.product_bundles (sku) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity   numeric(12, 2) not null,
  constraint product_bundle_items_pkey primary key (bundle_sku, product_id),
  constraint product_bundle_items_quantity_positive check (quantity > 0)
);

create index if not exists product_bundle_items_product_id_idx on public.product_bundle_items using btree (product_id);
create index if not exists product_bundles_updated_by_idx on public.product_bundles using btree (updated_by);

alter table public.product_bundles enable row level security;
alter table public.product_bundle_items enable row level security;

drop policy if exists product_bundles_select_with_role on public.product_bundles;
create policy product_bundles_select_with_role on public.product_bundles
  for select to authenticated using ((select public.current_app_role()) is not null);
drop policy if exists product_bundles_write_full_access on public.product_bundles;
create policy product_bundles_write_full_access on public.product_bundles
  for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'store_qc'))
  with check ((select public.current_app_role()) in ('admin', 'store_qc'));

drop policy if exists product_bundle_items_select_with_role on public.product_bundle_items;
create policy product_bundle_items_select_with_role on public.product_bundle_items
  for select to authenticated using ((select public.current_app_role()) is not null);
drop policy if exists product_bundle_items_write_full_access on public.product_bundle_items;
create policy product_bundle_items_write_full_access on public.product_bundle_items
  for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'store_qc'))
  with check ((select public.current_app_role()) in ('admin', 'store_qc'));

revoke all on table public.product_bundles, public.product_bundle_items from anon;
grant select, insert, update, delete on table public.product_bundles, public.product_bundle_items to authenticated;

-- บันทึกชุด (เพิ่มใหม่หรือแทนที่ชิ้นส่วนทั้งหมด) ใน transaction เดียว
-- p_items = [{ product_id, quantity }] p_old_sku = รหัสเดิมเมื่อเปลี่ยนรหัสชุด (null = ไม่เปลี่ยน)
create or replace function public.save_product_bundle(p_sku text, p_items jsonb, p_old_sku text default null)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sku text := upper(btrim(coalesce(p_sku, '')));
  v_old text := nullif(upper(btrim(coalesce(p_old_sku, ''))), '');
begin
  if (select public.current_app_role()) is distinct from 'admin' and (select public.current_app_role()) is distinct from 'store_qc' then
    raise exception 'จัดการชุดสินค้าได้เฉพาะเจ้าของร้านและ Store/QC' using errcode = '42501', hint = 'bundle_forbidden';
  end if;
  if v_sku = '' then
    raise exception 'กรุณาใส่รหัสชุด' using hint = 'bundle_invalid';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ชุดต้องมีสินค้าอย่างน้อย 1 รายการ' using hint = 'bundle_invalid';
  end if;
  -- เพิ่มใหม่ หรือเปลี่ยนรหัส: ห้ามทับชุดอื่นที่มีอยู่แล้ว
  if (v_old is null or v_old <> v_sku) and exists (select 1 from public.product_bundles where sku = v_sku) then
    raise exception 'รหัสชุด % มีอยู่แล้ว' , v_sku using hint = 'bundle_duplicate';
  end if;
  if v_old is not null and v_old <> v_sku then
    delete from public.product_bundles where sku = v_old;
  end if;

  insert into public.product_bundles (sku, updated_by, updated_at)
  values (v_sku, (select auth.uid()), now())
  on conflict (sku) do update set updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  delete from public.product_bundle_items where bundle_sku = v_sku;
  insert into public.product_bundle_items (bundle_sku, product_id, quantity)
  select v_sku, (i ->> 'product_id')::uuid, sum((i ->> 'quantity')::numeric)
  from jsonb_array_elements(p_items) as i
  group by (i ->> 'product_id')::uuid;

  return v_sku;
end;
$$;

revoke all on function public.save_product_bundle(text, jsonb, text) from public, anon;
grant execute on function public.save_product_bundle(text, jsonb, text) to authenticated;

-- ลบชุด (ไม่กระทบสต็อกหรือประวัติ ลบแค่การตั้งค่า) คืนจำนวนชุดที่ลบ
create or replace function public.delete_product_bundle(p_sku text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select public.current_app_role()) is distinct from 'admin' and (select public.current_app_role()) is distinct from 'store_qc' then
    raise exception 'จัดการชุดสินค้าได้เฉพาะเจ้าของร้านและ Store/QC' using errcode = '42501', hint = 'bundle_forbidden';
  end if;
  delete from public.product_bundles where sku = upper(btrim(coalesce(p_sku, '')));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.delete_product_bundle(text) from public, anon;
grant execute on function public.delete_product_bundle(text) to authenticated;
