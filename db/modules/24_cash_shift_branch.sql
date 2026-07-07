-- 24: กะเงินสดแยกต่อสาขา
-- เดิม cash_shifts ผูกทั้ง org → เปิดได้กะเดียวทั้งบริษัท และ expected_cash
-- รวมยอดขายเงินสดทุกสาขา — เพิ่ม branch_id แล้วคิดต่อสาขา

alter table cash_shifts
  add column if not exists branch_id uuid references branches(id) on delete restrict;

-- กะเก่าที่ยังไม่ระบุสาขา → ผูกกับสาขาหลักของ org
update cash_shifts cs
   set branch_id = (
     select b.id from branches b
      where b.org_id = cs.org_id
      order by b.is_default desc, b.created_at asc
      limit 1
   )
 where cs.branch_id is null;

-- กันเปิดกะซ้อนในสาขาเดียวกัน (ยังยอมให้คนละสาขาเปิดพร้อมกัน)
create unique index if not exists uniq_open_shift_per_branch
  on cash_shifts (branch_id)
  where status = 'open';

create index if not exists idx_shifts_branch on cash_shifts(branch_id, status);
