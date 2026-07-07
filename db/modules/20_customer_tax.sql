-- โมดูล: ข้อมูลภาษีของลูกค้า (สำหรับออกใบกำกับภาษีเต็มรูป)
alter table customers add column if not exists tax_id text;
-- สาขาผู้ซื้อ: เว้นว่าง=สำนักงานใหญ่ หรือใส่รหัสสาขา เช่น 00001
alter table customers add column if not exists branch text;
