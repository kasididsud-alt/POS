"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Modal from "@/components/Modal";
import BarcodeScanner from "@/components/BarcodeScanner";
import { formatTHB } from "@/lib/format";
import type { CartLine, ProductWithStock } from "@/lib/types";
import { checkoutAction, getPromptPayQRAction } from "./actions";

type CartItem = CartLine & { max: number; unit: string };
export type PosCustomer = { id: string; name: string; phone: string | null; points: number };
export type PosPromotion = {
  id: string;
  name: string;
  type: "percent" | "amount";
  value: number;
  min_purchase: number;
};

export default function PosClient({
  products,
  hasPromptPay,
  customers,
  promotions,
}: {
  products: ProductWithStock[];
  hasPromptPay: boolean;
  customers: PosCustomer[];
  promotions: PosPromotion[];
}) {
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [payMode, setPayMode] = useState<null | "cash" | "promptpay" | "credit">(null);
  const [cashReceived, setCashReceived] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    bill_no: string;
    total: number;
    change: number;
    method: string;
    points: number;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // บิลที่พักไว้ (เก็บในเครื่อง)
  type HeldCart = {
    id: number;
    items: CartItem[];
    customerId: string;
    discount: number;
  };
  const [held, setHeld] = useState<HeldCart[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("stockpos_held");
      if (raw) setHeld(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  function persistHeld(next: HeldCart[]) {
    setHeld(next);
    try {
      localStorage.setItem("stockpos_held", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  function holdCurrent() {
    if (!cart.length) return;
    persistHeld([
      ...held,
      { id: Date.now(), items: cart, customerId, discount: manualDiscount },
    ]);
    resetSale();
  }
  function resumeHeld(h: HeldCart) {
    setCart(h.items);
    setCustomerId(h.customerId);
    setManualDiscount(h.discount);
    persistHeld(held.filter((x) => x.id !== h.id));
  }

  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q),
    );
  }, [products, search]);

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.qty, 0);

  // โปรโมชั่นที่ดีที่สุดที่เข้าเงื่อนไข (ยอดถึงขั้นต่ำ)
  const bestPromo = useMemo(() => {
    let best: { promo: PosPromotion; amount: number } | null = null;
    for (const p of promotions) {
      if (subtotal < Number(p.min_purchase)) continue;
      const amount =
        p.type === "percent"
          ? (subtotal * Number(p.value)) / 100
          : Number(p.value);
      const capped = Math.min(amount, subtotal);
      if (!best || capped > best.amount) best = { promo: p, amount: capped };
    }
    return best;
  }, [promotions, subtotal]);

  // ใช้ส่วนลดที่กรอกเอง ถ้าไม่กรอกใช้โปรโมชั่นอัตโนมัติ
  const appliedDiscount = manualDiscount > 0 ? manualDiscount : (bestPromo?.amount ?? 0);
  const total = Math.max(subtotal - appliedDiscount, 0);
  const change = Number(cashReceived || 0) - total;

  function addToCart(p: ProductWithStock) {
    setCart((prev) => {
      const found = prev.find((i) => i.product_id === p.id);
      if (found) {
        if (found.qty >= found.max) {
          setScanMsg(`"${p.name}" มีในตะกร้าครบจำนวนคงเหลือแล้ว (${found.max})`);
          setTimeout(() => setScanMsg(null), 2000);
          return prev;
        }
        return prev.map((i) =>
          i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          unit_price: p.price,
          qty: 1,
          max: p.qty,
          unit: p.unit,
        },
      ];
    });
  }

  function setQty(id: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product_id !== id));
    } else {
      setCart((prev) =>
        prev.map((i) =>
          i.product_id === id ? { ...i, qty: Math.min(qty, i.max) } : i,
        ),
      );
    }
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = search.trim().toLowerCase();
    const exact = products.find((p) => p.barcode?.toLowerCase() === q);
    const target = exact ?? (filtered.length === 1 ? filtered[0] : null);
    if (target) {
      addToCart(target);
      setSearch("");
    }
  }

  function handleScan(code: string) {
    const q = code.trim().toLowerCase();
    const found = products.find(
      (p) => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q,
    );
    setScanning(false);
    if (found) {
      if (found.qty <= 0) setScanMsg(`"${found.name}" สินค้าหมด`);
      else {
        addToCart(found);
        setScanMsg(`เพิ่ม "${found.name}" แล้ว`);
      }
    } else setScanMsg(`ไม่พบสินค้าบาร์โค้ด ${code}`);
    setTimeout(() => setScanMsg(null), 2500);
  }

  // เครื่องสแกนบาร์โค้ด USB (keyboard-wedge): พิมพ์เร็วมากแล้วจบด้วย Enter
  // ดักทั้งหน้าจอเมื่อไม่ได้โฟกัสอยู่ในช่องกรอก เพื่อให้ยิงบาร์โค้ดได้ทันที
  const wedgeScan = useRef<(code: string) => void>(() => {});
  wedgeScan.current = handleScan;
  useEffect(() => {
    let buf = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      const now = performance.now();
      if (now - last > 100) buf = ""; // ช้าเกิน = คนพิมพ์ ไม่ใช่สแกนเนอร์
      last = now;
      if (e.key === "Enter") {
        if (buf.length >= 3 && !typing) {
          wedgeScan.current(buf);
          e.preventDefault();
        }
        buf = "";
        return;
      }
      if (e.key.length === 1) buf += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function resetSale() {
    setCart([]);
    setManualDiscount(0);
    setCustomerId("");
    setCashReceived("");
    setQr(null);
    setPayMode(null);
    setError(null);
    searchRef.current?.focus();
  }

  async function openPromptPay() {
    setError(null);
    setQr(null);
    setPayMode("promptpay");
    const res = await getPromptPayQRAction(total);
    if (!res.ok) setError(res.error ?? "สร้าง QR ไม่สำเร็จ");
    else setQr(res.dataUrl ?? null);
  }

  function confirmCheckout(method: "cash" | "promptpay" | "credit") {
    setError(null);
    start(async () => {
      const res = await checkoutAction({
        // ส่งแค่ product_id + qty — ราคาคิดฝั่ง server จาก DB
        items: cart.map(({ product_id, qty }) => ({ product_id, qty })),
        payment_method: method,
        discount: appliedDiscount,
        cash_received: method === "cash" ? Number(cashReceived || 0) : null,
        customer_id: customerId || null,
      });
      if (!res.ok) {
        setError(res.error ?? "ขายไม่สำเร็จ");
        return;
      }
      setReceipt({
        bill_no: res.bill_no!,
        total: res.total!,
        change: res.change ?? 0,
        method:
          method === "cash" ? "เงินสด" : method === "promptpay" ? "พร้อมเพย์" : "ขายเชื่อ",
        points: res.points ?? 0,
      });
      resetSale();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Products */}
      <div>
        <div className="mb-4 flex gap-2">
          <input
            ref={searchRef}
            autoFocus
            className="input"
            placeholder="🔍 พิมพ์ค้นหาสินค้า หรือยิงบาร์โค้ด แล้วกด Enter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
          />
          <button
            onClick={() => setScanning(true)}
            className="btn-outline whitespace-nowrap"
            title="สแกนด้วยกล้อง"
          >
            📷 สแกน
          </button>
        </div>
        {scanMsg && (
          <div className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
            {scanMsg}
          </div>
        )}
        {held.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-sm font-medium text-amber-800">
              ⏸️ บิลที่พักไว้:
            </span>
            {held.map((h, i) => (
              <span key={h.id} className="flex items-center gap-1">
                <button
                  onClick={() => resumeHeld(h)}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs hover:bg-amber-100"
                  title="เรียกบิลนี้กลับมา"
                >
                  บิล {i + 1} · {h.items.length} รายการ ·{" "}
                  {formatTHB(
                    Math.max(
                      h.items.reduce((s, it) => s + it.unit_price * it.qty, 0) -
                        h.discount,
                      0,
                    ),
                  )}
                </button>
                <button
                  onClick={() => persistHeld(held.filter((x) => x.id !== h.id))}
                  className="text-amber-500 hover:text-red-600"
                  title="ลบบิลที่พัก"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const out = p.qty <= 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={out}
                className="card flex flex-col overflow-hidden p-3 text-left transition hover:ring-2 hover:ring-[var(--primary)]/40 disabled:opacity-40"
              >
                <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-slate-50 text-2xl text-slate-300">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    "📦"
                  )}
                </div>
                <div className="line-clamp-2 min-h-[2.5rem] font-medium">{p.name}</div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="font-semibold text-[var(--primary)]">
                    {formatTHB(p.price)}
                  </span>
                  <span className={`text-xs ${out ? "text-red-600" : "text-[var(--muted)]"}`}>
                    {out ? "หมด" : `เหลือ ${p.qty}`}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-[var(--muted)]">
              ไม่พบสินค้า
            </p>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="card flex h-fit flex-col p-4 lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold">🧾 ตะกร้า</h2>

        {/* ลูกค้า */}
        <div className="mt-3">
          <select
            className="input"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">👤 ลูกค้าทั่วไป (ไม่ระบุ)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ""} · {c.points} แต้ม
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 max-h-[35vh] space-y-2 overflow-y-auto">
          {cart.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              ยังไม่มีสินค้าในตะกร้า
            </p>
          )}
          {cart.map((i) => (
            <div key={i.product_id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.name}</div>
                <div className="text-xs text-[var(--muted)]">{formatTHB(i.unit_price)}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setQty(i.product_id, i.qty - 1)} className="btn-outline h-7 w-7 p-0">
                  −
                </button>
                <input
                  className="w-10 rounded border border-[var(--border)] text-center text-sm"
                  value={i.qty}
                  onChange={(e) => setQty(i.product_id, parseInt(e.target.value) || 0)}
                />
                <button onClick={() => setQty(i.product_id, i.qty + 1)} className="btn-outline h-7 w-7 p-0">
                  +
                </button>
              </div>
              <div className="w-20 text-right text-sm font-medium">
                {formatTHB(i.unit_price * i.qty)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">ยอดรวม</span>
            <span>{formatTHB(subtotal)}</span>
          </div>
          {bestPromo && manualDiscount === 0 && (
            <div className="flex justify-between text-green-700">
              <span>🎯 {bestPromo.promo.name}</span>
              <span>- {formatTHB(bestPromo.amount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">ส่วนลดเพิ่ม</span>
            <input
              type="number"
              className="w-24 rounded border border-[var(--border)] px-2 py-1 text-right"
              value={manualDiscount || ""}
              onChange={(e) => setManualDiscount(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>สุทธิ</span>
            <span className="text-[var(--primary)]">{formatTHB(total)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            disabled={cart.length === 0}
            onClick={() => {
              setCashReceived("");
              setError(null);
              setPayMode("cash");
            }}
            className="btn-primary"
          >
            💵 เงินสด
          </button>
          <button disabled={cart.length === 0} onClick={openPromptPay} className="btn-outline">
            📱 พร้อมเพย์
          </button>
        </div>
        <button
          disabled={cart.length === 0 || !customerId}
          onClick={() => {
            setError(null);
            setPayMode("credit");
          }}
          className="btn-outline mt-2"
          title={!customerId ? "ต้องเลือกลูกค้าก่อนขายเชื่อ" : ""}
        >
          📝 ขายเชื่อ (ลงบัญชีลูกหนี้)
        </button>
        {cart.length > 0 && (
          <div className="mt-2 flex gap-2">
            <button onClick={holdCurrent} className="btn-outline flex-1 text-sm">
              ⏸️ พักบิล
            </button>
            <button onClick={resetSale} className="btn-ghost text-sm text-red-600">
              ล้างตะกร้า
            </button>
          </div>
        )}
      </div>

      {/* Barcode scanner */}
      {scanning && (
        <BarcodeScanner onDetected={handleScan} onClose={() => setScanning(false)} />
      )}

      {/* Cash modal */}
      <Modal open={payMode === "cash"} onClose={() => setPayMode(null)} title="รับเงินสด">
        <div className="space-y-3">
          <div className="flex justify-between text-lg font-bold">
            <span>ยอดสุทธิ</span>
            <span>{formatTHB(total)}</span>
          </div>
          <div>
            <label className="label">รับเงินมา</label>
            <input
              autoFocus
              type="number"
              className="input text-right text-lg"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[total, 100, 500, 1000].map((amt, idx) => (
              <button
                key={idx}
                onClick={() => setCashReceived(String(amt))}
                className="btn-outline px-3 py-1 text-sm"
              >
                {idx === 0 ? "พอดี" : `฿${amt}`}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-lg">
            <span>เงินทอน</span>
            <span className={change < 0 ? "text-red-600" : "font-bold text-green-600"}>
              {formatTHB(Math.max(change, 0))}
            </span>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={pending || change < 0}
            onClick={() => confirmCheckout("cash")}
            className="btn-primary w-full"
          >
            {pending ? "กำลังบันทึก..." : "ยืนยันการขาย"}
          </button>
        </div>
      </Modal>

      {/* PromptPay modal */}
      <Modal open={payMode === "promptpay"} onClose={() => setPayMode(null)} title="รับเงินผ่านพร้อมเพย์">
        <div className="space-y-3 text-center">
          <div className="text-lg font-bold">{formatTHB(total)}</div>
          {!hasPromptPay && (
            <p className="text-sm text-amber-700">
              ยังไม่ได้ตั้งค่าเบอร์พร้อมเพย์ — ไปที่หน้าตั้งค่าก่อน
            </p>
          )}
          {qr && (
            <img src={qr} alt="PromptPay QR" className="mx-auto rounded-lg border border-[var(--border)]" />
          )}
          {!qr && hasPromptPay && !error && (
            <p className="py-6 text-sm text-[var(--muted)]">กำลังสร้าง QR...</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-[var(--muted)]">ให้ลูกค้าสแกนจ่าย แล้วกดยืนยันเมื่อได้รับเงิน</p>
          <button
            disabled={pending || !qr}
            onClick={() => confirmCheckout("promptpay")}
            className="btn-primary w-full"
          >
            {pending ? "กำลังบันทึก..." : "ได้รับเงินแล้ว — ยืนยัน"}
          </button>
        </div>
      </Modal>

      {/* Credit modal */}
      <Modal open={payMode === "credit"} onClose={() => setPayMode(null)} title="ขายเชื่อ (ลงบัญชีลูกหนี้)">
        <div className="space-y-3">
          <div className="flex justify-between text-lg font-bold">
            <span>ยอดเชื่อ</span>
            <span>{formatTHB(total)}</span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            ลูกค้า: <span className="font-medium text-foreground">{selectedCustomer?.name}</span>
            <br />
            ระบบจะบันทึกเป็นลูกหนี้ค้างชำระ ดู/รับชำระภายหลังที่เมนู “ลูกหนี้/เครดิต”
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={pending}
            onClick={() => confirmCheckout("credit")}
            className="btn-primary w-full"
          >
            {pending ? "กำลังบันทึก..." : "ยืนยันขายเชื่อ"}
          </button>
        </div>
      </Modal>

      {/* Receipt */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="ขายสำเร็จ ✅">
        {receipt && (
          <div className="space-y-2 text-center">
            <div className="text-sm text-[var(--muted)]">เลขที่บิล {receipt.bill_no}</div>
            <div className="text-3xl font-bold">{formatTHB(receipt.total)}</div>
            <div className="text-sm">ชำระโดย: {receipt.method}</div>
            {receipt.method === "เงินสด" && receipt.change > 0 && (
              <div className="text-lg font-semibold text-green-600">
                เงินทอน {formatTHB(receipt.change)}
              </div>
            )}
            {receipt.points > 0 && (
              <div className="text-sm text-indigo-600">
                ⭐ ลูกค้าได้รับ {receipt.points} แต้ม
              </div>
            )}
            <button onClick={() => setReceipt(null)} className="btn-primary mt-4 w-full">
              ขายต่อ
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
