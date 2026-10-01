-- ยอดขายรายเดือน (ค่าจากไฟล์สต็อกของร้าน) รันใน Supabase SQL Editor ครั้งเดียว รันซ้ำได้
-- 1 แถวต่อสินค้าต่อเดือน year เป็น ค.ศ. (หน้าเว็บแสดง พ.ศ.) ดูได้ทุกบทบาท เพิ่ม/แก้ได้เฉพาะ admin (นำเข้าไฟล์)

create table if not exists public.product_monthly_sales (
  product_id uuid not null references public.products (id) on delete cascade,
  year       integer not null,
  month      integer not null,
  quantity   numeric(12, 2) not null,
  updated_at timestamptz not null default now(),

  primary key (product_id, year, month),
  constraint product_monthly_sales_month_valid check (month between 1 and 12),
  constraint product_monthly_sales_year_valid check (year between 2000 and 2100),
  constraint product_monthly_sales_quantity_non_neg check (quantity >= 0)
);

create index if not exists product_monthly_sales_year_idx
  on public.product_monthly_sales using btree (year);

alter table public.product_monthly_sales enable row level security;

revoke all on public.product_monthly_sales from anon, authenticated;
grant select on public.product_monthly_sales to authenticated;
grant insert (product_id, year, month, quantity, updated_at) on public.product_monthly_sales to authenticated;
-- upsert (นำเข้าซ้ำ) เขียน ON CONFLICT DO UPDATE ทุกคอลัมน์ที่ส่ง จึงต้องมีสิทธิ์ update ครบ
grant update (product_id, year, month, quantity, updated_at) on public.product_monthly_sales to authenticated;

drop policy if exists "monthly_sales_select_with_role" on public.product_monthly_sales;
create policy "monthly_sales_select_with_role"
  on public.product_monthly_sales for select
  to authenticated
  using ((select public.current_app_role()) is not null);

drop policy if exists "monthly_sales_insert_admin" on public.product_monthly_sales;
create policy "monthly_sales_insert_admin"
  on public.product_monthly_sales for insert
  to authenticated
  with check ((select public.current_app_role()) = 'admin');

drop policy if exists "monthly_sales_update_admin" on public.product_monthly_sales;
create policy "monthly_sales_update_admin"
  on public.product_monthly_sales for update
  to authenticated
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

-- ตรวจผล: ควรได้ 3 นโยบาย
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'product_monthly_sales'
order by policyname;
