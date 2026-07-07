"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import BarcodeScanner from "@/components/BarcodeScanner";
import Barcode from "@/components/Barcode";
import ImageUpload from "@/components/ImageUpload";
import { formatTHB } from "@/lib/format";
import type { Category, ProductWithStock } from "@/lib/types";
import { saveProduct, receiveStock, reduceStock, createCategory, deleteProduct, assignMissingBarcodes } from "./actions";
import { generateInternalEAN13 } from "@/lib/barcode";

export default function ProductsClient({
  products,
  categories,
}: {
  products: ProductWithStock[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProductWithStock | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [receiving, setReceiving] = useState<ProductWithStock | null>(null);
  const [reducing, setReducing] = useState<ProductWithStock | null>(null);
  const [showCat, setShowCat] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [barcodeView, setBarcodeView] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);

  const missingBarcodes = useMemo(
    () => products.filter((p) => p.is_active && !p.barcode).length,
    [products],
  );

  function genBarcodes() {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await assignMissingBarcodes();
      if (!res.ok) setError(res.error ?? "เกิดข้อผิดพลาด");
      else {
        setNotice(`สร้างบาร์โค้ดอัตโนมัติแล้ว ${res.count ?? 0} รายการ`);
        router.refresh();
      }
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q),
    );
  }, [products, search]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after: () => void) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "เกิดข้อผิดพลาด");
      else {
        after();
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">สินค้า / คลัง</h1>
          <p className="text-sm text-[var(--muted)]">
            ทั้งหมด {products.length} รายการ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {missingBarcodes > 0 && (
            <button
              onClick={genBarcodes}
              disabled={pending}
              className="btn-outline"
              title="สร้างบาร์โค้ด EAN-13 ภายในร้านให้สินค้าที่ยังไม่มี"
            >
              🏷️ สร้างบาร์โค้ด ({missingBarcodes})
            </button>
          )}
          <button onClick={() => setShowCat(true)} className="btn-outline">
            + หมวดหมู่
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setBarcodeView("");
              setShowForm(true);
            }}
            className="btn-primary"
          >
            + เพิ่มสินค้า
          </button>
        </div>
      </div>

      <input
        className="input mt-4 max-w-sm"
        placeholder="ค้นหาชื่อ / SKU / บาร์โค้ด"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">สินค้า</th>
              <th className="px-4 py-3">หมวด</th>
              <th className="px-4 py-3 text-right">ราคา</th>
              <th className="px-4 py-3 text-right">คงเหลือ</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีสินค้า — กด “เพิ่มสินค้า” เพื่อเริ่มต้น
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const low = p.qty <= p.low_stock_threshold;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    !p.is_active ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-slate-50 text-2xl text-slate-300">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          "📦"
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {p.barcode || p.sku || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {p.category_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{formatTHB(p.price)}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        low
                          ? "bg-red-50 text-red-700"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {p.qty} {p.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setReceiving(p)}
                        className="btn-ghost px-2 py-1 text-xs text-green-700"
                      >
                        รับเข้า
                      </button>
                      <button
                        onClick={() => setReducing(p)}
                        className="btn-ghost px-2 py-1 text-xs text-amber-700"
                      >
                        ลด
                      </button>
                      <button
                        onClick={() => {
                          setEditing(p);
                          setBarcodeView(p.barcode ?? "");
                          setShowForm(true);
                        }}
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        แก้ไข
                      </button>
                      {p.is_active && (
                        <button
                          onClick={() => {
                            if (confirm(`ปิดการขาย "${p.name}"?`))
                              run(() => deleteProduct(p.id), () => {});
                          }}
                          className="btn-ghost px-2 py-1 text-xs text-red-600"
                        >
                          ลบ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ {notice} —{" "}
          <a href="/labels" className="underline">
            ไปพิมพ์ป้ายบาร์โค้ด
          </a>
        </div>
      )}

      {/* Barcode scanner (เติมเลขบาร์โค้ดในฟอร์ม) */}
      {scanning && (
        <BarcodeScanner
          onDetected={(code) => {
            if (barcodeRef.current) barcodeRef.current.value = code;
            setBarcodeView(code);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {/* Add/Edit product */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => saveProduct(new FormData(e.currentTarget)),
              () => setShowForm(false),
            );
          }}
          className="space-y-3"
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="label">รูปสินค้า</label>
            <ImageUpload name="image_url" defaultValue={editing?.image_url} />
          </div>
          <div>
            <label className="label">ชื่อสินค้า *</label>
            <input
              name="name"
              required
              defaultValue={editing?.name}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ราคาขาย</label>
              <input
                name="price"
                type="number"
                step="0.01"
                defaultValue={editing?.price ?? 0}
                className="input"
              />
            </div>
            <div>
              <label className="label">ต้นทุน</label>
              <input
                name="cost"
                type="number"
                step="0.01"
                defaultValue={editing?.cost ?? 0}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">บาร์โค้ด</label>
              <div className="flex gap-1">
                <input
                  ref={barcodeRef}
                  name="barcode"
                  defaultValue={editing?.barcode ?? ""}
                  onChange={(e) => setBarcodeView(e.target.value)}
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="btn-outline px-2"
                  title="สแกนบาร์โค้ด"
                >
                  📷
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // สุ่มด้วย crypto กันชนกันข้าม session/แท็บ (เดิมใช้ performance.now())
                    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
                    const code = generateInternalEAN13(seed);
                    if (barcodeRef.current) barcodeRef.current.value = code;
                    setBarcodeView(code);
                  }}
                  className="btn-outline px-2"
                  title="สร้างบาร์โค้ดอัตโนมัติ"
                >
                  🎲
                </button>
              </div>
              {barcodeView.trim() && (
                <div className="mt-2 rounded-md border border-[var(--border)] bg-white p-2">
                  <Barcode
                    value={barcodeView.trim()}
                    height={40}
                    moduleWidth={1.6}
                    fontSize={11}
                    className="block [&_svg]:max-w-full"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="label">SKU</label>
              <input name="sku" defaultValue={editing?.sku ?? ""} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">หน่วย</label>
              <input
                name="unit"
                defaultValue={editing?.unit ?? "ชิ้น"}
                className="input"
              />
            </div>
            <div>
              <label className="label">แจ้งเตือนเมื่อเหลือ ≤</label>
              <input
                name="low_stock_threshold"
                type="number"
                defaultValue={editing?.low_stock_threshold ?? 5}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">หมวดหมู่</label>
            <select
              name="category_id"
              defaultValue={editing?.category_id ?? ""}
              className="input"
            >
              <option value="">— ไม่ระบุ —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {!editing && (
            <div>
              <label className="label">จำนวนสต็อกตั้งต้น</label>
              <input
                name="initial_qty"
                type="number"
                defaultValue={0}
                className="input"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={pending} type="submit" className="btn-primary w-full">
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </Modal>

      {/* Receive stock */}
      <Modal
        open={!!receiving}
        onClose={() => setReceiving(null)}
        title={`ปรับสต็อก: ${receiving?.name ?? ""}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => receiveStock(new FormData(e.currentTarget)),
              () => setReceiving(null),
            );
          }}
          className="space-y-3"
        >
          <input type="hidden" name="product_id" value={receiving?.id} />
          <p className="text-sm text-[var(--muted)]">
            คงเหลือปัจจุบัน: {receiving?.qty} {receiving?.unit}
          </p>
          <div>
            <label className="label">ประเภท</label>
            <select name="reason" className="input" defaultValue="purchase">
              <option value="purchase">รับสินค้าเข้า (+)</option>
              <option value="return">รับคืน (+)</option>
              <option value="adjust">ปรับยอด (+/−)</option>
            </select>
          </div>
          <div>
            <label className="label">จำนวน</label>
            <input name="qty" type="number" required className="input" />
            <p className="mt-1 text-xs text-[var(--muted)]">
              “ปรับยอด” ใส่ค่าลบเพื่อลดสต็อกได้
            </p>
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input name="note" className="input" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={pending} type="submit" className="btn-primary w-full">
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </Modal>

      {/* Reduce stock */}
      <Modal
        open={!!reducing}
        onClose={() => setReducing(null)}
        title={`ลดสต็อก: ${reducing?.name ?? ""}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => reduceStock(new FormData(e.currentTarget)),
              () => setReducing(null),
            );
          }}
          className="space-y-3"
        >
          <input type="hidden" name="product_id" value={reducing?.id} />
          <p className="text-sm text-[var(--muted)]">
            คงเหลือปัจจุบัน: {reducing?.qty} {reducing?.unit}
          </p>
          <div>
            <label className="label">จำนวนที่จะลด</label>
            <input
              name="qty"
              type="number"
              min={1}
              max={reducing?.qty ?? undefined}
              required
              className="input"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              ลดได้ไม่เกินคงเหลือ ({reducing?.qty} {reducing?.unit})
            </p>
          </div>
          <div>
            <label className="label">เหตุผล / หมายเหตุ</label>
            <input
              name="note"
              className="input"
              placeholder="เช่น ของเสีย, สูญหาย, แตกหัก"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={pending} type="submit" className="btn-primary w-full">
            {pending ? "กำลังบันทึก..." : "ลดสต็อก"}
          </button>
        </form>
      </Modal>

      {/* Category */}
      <Modal open={showCat} onClose={() => setShowCat(false)} title="เพิ่มหมวดหมู่">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createCategory(new FormData(e.currentTarget)),
              () => setShowCat(false),
            );
          }}
          className="space-y-3"
        >
          <div>
            <label className="label">ชื่อหมวด</label>
            <input name="name" required className="input" />
          </div>
          {categories.length > 0 && (
            <p className="text-xs text-[var(--muted)]">
              มีอยู่แล้ว: {categories.map((c) => c.name).join(", ")}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={pending} type="submit" className="btn-primary w-full">
            เพิ่มหมวด
          </button>
        </form>
      </Modal>
    </div>
  );
}
