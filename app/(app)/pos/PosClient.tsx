"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import BarcodeScanner from "@/components/BarcodeScanner";
import { formatTHB } from "@/lib/format";
import {
  forgetDrawer,
  isDrawerSupported,
  kickDrawer,
  reconnectDrawer,
  requestDrawerPort,
} from "@/lib/cash-drawer";
import type { CartLine, ProductWithStock } from "@/lib/types";
import {
  checkGatewayChargeAction,
  checkoutAction,
  createGatewayQRAction,
  getPromptPayQRAction,
  pairDisplayAction,
  pushDisplayStateAction,
  unpairDisplayAction,
  type DisplayState,
} from "./actions";

// ปัดเงินให้เหลือ 2 ตำแหน่ง (สตางค์) กัน float ทศนิยมเพี้ยนตอนส่งให้ server
const round2 = (n: number) => Math.round(n * 100) / 100;

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
  orgId,
  branchId,
  gatewayConnected,
}: {
  products: ProductWithStock[];
  hasPromptPay: boolean;
  customers: PosCustomer[];
  promotions: PosPromotion[];
  orgId: string;
  branchId: string | null;
  gatewayConnected: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  // ค่าที่กำลังพิมพ์ในช่องจำนวน (draft) — ยอมค่าว่างชั่วคราวโดยไม่ลบรายการ
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [manualDiscount, setManualDiscount] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [payMode, setPayMode] = useState<null | "cash" | "promptpay" | "credit">(null);
  const [cashReceived, setCashReceived] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  // พร้อมเพย์ 2 โหมด: null = ยังไม่เลือก (จอลูกค้ายังไม่เห็น QR) /
  // "direct" = QR เบอร์ร้าน (ฟรี ยืนยันเอง) / "gateway" = QR จาก Omise/Stripe (เช็คเงินเข้าเอง)
  const [qrMode, setQrMode] = useState<null | "direct" | "gateway">(null);
  const [gwCharge, setGwCharge] = useState<{ chargeId: string } | null>(null);
  const [gwLoading, setGwLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    sale_id: string;
    bill_no: string;
    total: number;
    change: number;
    method: string;
    points: number;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // พิมพ์ใบเสร็จจากหน้าขาย — ฝังหน้าใบเสร็จใน iframe ซ่อนไว้ให้เด้ง print dialog
  // โดยไม่ต้องออกจากหน้า POS (ตั้งค่ากระดาษ/โหมดอัตโนมัติจำไว้ในเครื่อง)
  const [paper, setPaper] = useState<"80" | "58">("80");
  const [autoPrint, setAutoPrint] = useState(false);
  const [printJob, setPrintJob] = useState<{ src: string; nonce: number } | null>(
    null,
  );

  useEffect(() => {
    const p = localStorage.getItem("pos_paper");
    if (p === "58" || p === "80") setPaper(p);
    setAutoPrint(localStorage.getItem("pos_auto_print") === "1");
  }, []);

  function printReceipt(saleId: string, p: "80" | "58") {
    // nonce บังคับ remount iframe — กดพิมพ์ซ้ำบิลเดิมได้
    setPrintJob((j) => ({
      src: `/sales/${saleId}?print=${p}`,
      nonce: (j?.nonce ?? 0) + 1,
    }));
  }

  // ---------- ลิ้นชักเก็บเงิน ----------
  // ต่อผ่านเครื่องพิมพ์สลิปด้วย Web Serial (ดู lib/cash-drawer.ts)
  const [drawerModal, setDrawerModal] = useState(false);
  const [drawerConnected, setDrawerConnected] = useState(false);
  const [drawerAuto, setDrawerAuto] = useState(false);
  const [drawerMsg, setDrawerMsg] = useState<string | null>(null);

  useEffect(() => {
    setDrawerAuto(localStorage.getItem("pos_drawer_auto") === "1");
    // พอร์ตที่เคยอนุญาตไว้จะต่อกลับให้เอง ไม่ต้องกดเชื่อมต่อใหม่ทุกเช้า
    if (isDrawerSupported()) {
      reconnectDrawer().then((ok) => setDrawerConnected(ok));
    }
  }, []);

  async function connectDrawer() {
    setDrawerMsg(null);
    try {
      await requestDrawerPort();
      setDrawerConnected(true);
      setDrawerMsg("เชื่อมต่อแล้ว ✅ — ลองกด “เปิดลิ้นชักตอนนี้” เพื่อทดสอบ");
    } catch (e) {
      // ผู้ใช้กดยกเลิกหน้าต่างเลือกพอร์ต — ไม่ใช่ข้อผิดพลาด
      if (e instanceof DOMException && e.name === "NotFoundError") return;
      setDrawerMsg((e as Error).message);
    }
  }

  async function openDrawerNow() {
    setDrawerMsg(null);
    try {
      await kickDrawer();
      setDrawerMsg("ส่งสัญญาณเปิดลิ้นชักแล้ว 💰");
    } catch (e) {
      setDrawerConnected(false);
      setDrawerMsg((e as Error).message + " — กดเชื่อมต่อใหม่อีกครั้ง");
    }
  }

  // เด้งลิ้นชักตอนรับเงินสด — ห้าม block การขาย ถ้าส่งไม่ได้ให้แจ้งเบา ๆ แทน
  function kickDrawerForSale() {
    kickDrawer().catch(() => {
      setDrawerConnected(false);
      setScanMsg("⚠️ เปิดลิ้นชักไม่สำเร็จ — เช็คสายเครื่องพิมพ์ แล้วเชื่อมต่อใหม่ที่ปุ่ม 💰 ลิ้นชัก");
      setTimeout(() => setScanMsg(null), 5000);
    });
  }

  // บิลที่พักไว้ (เก็บในเครื่อง)
  type HeldCart = {
    id: number;
    items: CartItem[];
    customerId: string;
    discount: number;
  };
  // แยก key ตามร้าน/สาขา กันบิลพักรั่วข้ามบัญชีบนเครื่องเดียวกัน
  const heldKey = `stockpos_held:${orgId}:${branchId ?? "none"}`;
  const [held, setHeld] = useState<HeldCart[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(heldKey);
      setHeld(raw ? JSON.parse(raw) : []);
    } catch {
      setHeld([]);
    }
  }, [heldKey]);
  function persistHeld(next: HeldCart[]) {
    setHeld(next);
    try {
      localStorage.setItem(heldKey, JSON.stringify(next));
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
    // อ้างอิงราคา/สต็อกล่าสุดจากสินค้าปัจจุบัน และตัดรายการที่ไม่มีในคลังแล้ว
    const resolved: CartItem[] = [];
    const dropped: string[] = [];
    for (const it of h.items) {
      const p = products.find((x) => x.id === it.product_id);
      if (!p) {
        dropped.push(it.name);
        continue;
      }
      resolved.push({
        ...it,
        name: p.name,
        unit_price: p.price,
        max: p.qty,
        unit: p.unit,
        qty: Math.min(it.qty, p.qty),
      });
    }
    setCart(resolved);
    setCustomerId(customers.some((c) => c.id === h.customerId) ? h.customerId : "");
    setManualDiscount(h.discount);
    persistHeld(held.filter((x) => x.id !== h.id));
    if (dropped.length) {
      setScanMsg(`อัปเดตราคา/สต็อกล่าสุดแล้ว · ตัดรายการที่ไม่มีในคลัง: ${dropped.join(", ")}`);
      setTimeout(() => setScanMsg(null), 3500);
    }
  }

  // ---------- จอลูกค้า ----------
  // จับคู่กับหน้า /pos-display บนอุปกรณ์อื่น (จำการจับคู่ไว้ต่อเครื่อง/สาขา)
  const displayKey = `kd_display_link:${orgId}:${branchId ?? "none"}`;
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [displayModal, setDisplayModal] = useState(false);
  const [displayCode, setDisplayCode] = useState("");
  const [displayErr, setDisplayErr] = useState<string | null>(null);
  const [displayPending, setDisplayPending] = useState(false);
  useEffect(() => {
    try {
      setDisplayId(localStorage.getItem(displayKey));
    } catch {
      setDisplayId(null);
    }
  }, [displayKey]);

  function disconnectDisplay(tellServer = true) {
    if (tellServer && displayId) unpairDisplayAction(displayId).catch(() => {});
    setDisplayId(null);
    try {
      localStorage.removeItem(displayKey);
    } catch {
      /* ignore */
    }
  }

  async function submitPairCode() {
    setDisplayErr(null);
    setDisplayPending(true);
    try {
      const res = await pairDisplayAction(displayCode);
      if (!res.ok || !res.id) {
        setDisplayErr(res.error ?? "จับคู่ไม่สำเร็จ");
        return;
      }
      setDisplayId(res.id);
      try {
        localStorage.setItem(displayKey, res.id);
      } catch {
        /* ignore */
      }
      setDisplayModal(false);
    } catch {
      setDisplayErr("เครือข่ายขัดข้อง — ลองใหม่อีกครั้ง");
    } finally {
      setDisplayPending(false);
    }
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

  const subtotal = round2(cart.reduce((s, i) => s + i.unit_price * i.qty, 0));

  // โปรโมชั่นที่ดีที่สุดที่เข้าเงื่อนไข (ยอดถึงขั้นต่ำ)
  const bestPromo = useMemo(() => {
    let best: { promo: PosPromotion; amount: number } | null = null;
    for (const p of promotions) {
      if (subtotal < Number(p.min_purchase)) continue;
      const amount =
        p.type === "percent"
          ? (subtotal * Number(p.value)) / 100
          : Number(p.value);
      const capped = round2(Math.min(amount, subtotal));
      if (!best || capped > best.amount) best = { promo: p, amount: capped };
    }
    return best;
  }, [promotions, subtotal]);

  // ใช้ส่วนลดที่กรอกเอง ถ้าไม่กรอกใช้โปรโมชั่นอัตโนมัติ
  const appliedDiscount = round2(
    manualDiscount > 0 ? manualDiscount : (bestPromo?.amount ?? 0),
  );
  const total = round2(Math.max(subtotal - appliedDiscount, 0));
  const change = round2(Number(cashReceived || 0) - total);

  // ส่งสถานะปัจจุบันไปจอลูกค้า (debounce สั้นๆ กันยิงถี่ตอนกดรัว — ฝั่งจอรับสดผ่าน SSE)
  // ระหว่างเปิดสรุปบิล (receipt) ไม่ส่งทับ — จอค้างสถานะ "จ่ายแล้ว" จนกดขายต่อ
  useEffect(() => {
    if (!displayId || receipt) return;
    const t = setTimeout(() => {
      let st: DisplayState;
      if (cart.length) {
        st = {
          mode: "cart",
          items: cart.map((i) => ({
            name: i.name,
            price: i.unit_price,
            qty: i.qty,
            unit: i.unit,
            total: round2(i.unit_price * i.qty),
          })),
          subtotal,
          discount: appliedDiscount,
          total,
          customer: selectedCustomer?.name ?? null,
          // QR โผล่ในกล่องฝั่งขวาของจอลูกค้าเฉพาะตอนเปิดรับชำระพร้อมเพย์
          qr: payMode === "promptpay" && qr ? qr : null,
        };
      } else {
        st = { mode: "idle" };
      }
      pushDisplayStateAction(displayId, st)
        .then((r) => {
          // จอถูกยกเลิกจับคู่/หายไปแล้ว — เลิกส่งเงียบๆ
          if (!r.ok && r.error === "not_found") disconnectDisplay(false);
        })
        .catch(() => {});
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayId, cart, subtotal, appliedDiscount, total, payMode, qr, receipt, customerId]);

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

  // แก้จำนวนผ่านการพิมพ์: ยอมค่าว่างชั่วคราว ไม่ลบรายการจนกว่าจะยืนยัน (blur)
  function onQtyInput(id: string, raw: string) {
    setQtyDrafts((d) => ({ ...d, [id]: raw }));
    const n = parseInt(raw, 10);
    if (raw.trim() !== "" && Number.isFinite(n) && n > 0) {
      setCart((prev) =>
        prev.map((i) =>
          i.product_id === id ? { ...i, qty: Math.min(n, i.max) } : i,
        ),
      );
    }
  }
  function commitQty(id: string) {
    setQtyDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
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
    setQtyDrafts({});
    setManualDiscount(0);
    setCustomerId("");
    setCashReceived("");
    setQr(null);
    setQrMode(null);
    setGwCharge(null);
    setPayMode(null);
    setError(null);
    searchRef.current?.focus();
  }

  /** เปิด modal พร้อมเพย์ — ยังไม่สร้าง QR จนกว่าแคชเชียร์เลือกโหมด (จอลูกค้าจะยังไม่เห็นอะไร) */
  function openPromptPay() {
    setError(null);
    setQr(null);
    setQrMode(null);
    setGwCharge(null);
    setPayMode("promptpay");
  }

  /** เลือกโหมด QR เบอร์ร้าน — สร้าง QR แล้วค่อยขึ้นจอลูกค้า */
  async function loadDirectQR() {
    setError(null);
    setQr(null);
    setGwCharge(null);
    setQrMode("direct");
    try {
      const res = await getPromptPayQRAction(total);
      if (!res.ok) setError(res.error ?? "สร้าง QR ไม่สำเร็จ");
      else setQr(res.dataUrl ?? null);
    } catch {
      setError("เครือข่ายขัดข้อง — สร้าง QR ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  /** สลับเป็น QR ผ่าน gateway — สร้าง charge ตามยอดบิล แล้วให้ effect ด้านล่าง poll จนเงินเข้า */
  async function openGatewayQR() {
    setError(null);
    setQr(null);
    setGwCharge(null);
    setQrMode("gateway");
    setGwLoading(true);
    try {
      const res = await createGatewayQRAction({
        items: cart.map(({ product_id, qty }) => ({ product_id, qty })),
        discount: round2(appliedDiscount),
      });
      if (!res.ok || !res.chargeId || !res.qrImage) {
        setError(res.error ?? "สร้าง QR ไม่สำเร็จ");
      } else {
        setQr(res.qrImage); // ใช้ state เดิม — จอลูกค้า (customer display) เห็น QR นี้ด้วย
        setGwCharge({ chargeId: res.chargeId });
      }
    } catch {
      setError("เครือข่ายขัดข้อง — สร้าง QR ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setGwLoading(false);
    }
  }

  // poll สถานะ QR gateway ทุก 2.5 วิ — เงินเข้าแล้วปิดบิลเอง / รายการหลุด (หมดอายุ/ยกเลิก) แจ้งแคชเชียร์
  useEffect(() => {
    if (!gwCharge || payMode !== "promptpay") return;
    let stopped = false;
    const t = setInterval(async () => {
      try {
        const res = await checkGatewayChargeAction(gwCharge.chargeId);
        if (stopped || !res.ok) return;
        if (res.status === "paid") {
          stopped = true;
          clearInterval(t);
          setGwCharge(null);
          confirmCheckout("promptpay");
        } else if (res.status === "failed") {
          stopped = true;
          clearInterval(t);
          setGwCharge(null);
          setError("รายการถูกยกเลิก/หมดอายุ — กดสร้าง QR ใหม่");
        }
      } catch {
        // เน็ตสะดุดระหว่าง poll — รอบถัดไปลองใหม่เอง
      }
    }, 2500);
    return () => {
      stopped = true;
      clearInterval(t);
    };
    // confirmCheckout เป็น closure ที่อ้าง state ล่าสุดอยู่แล้ว — ผูก dep แค่ตัวกำหนดรอบ poll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gwCharge, payMode]);

  function confirmCheckout(method: "cash" | "promptpay" | "credit") {
    setError(null);
    start(async () => {
      try {
        const res = await checkoutAction({
          // ส่งแค่ product_id + qty — ราคาคิดฝั่ง server จาก DB
          items: cart.map(({ product_id, qty }) => ({ product_id, qty })),
          payment_method: method,
          discount: round2(appliedDiscount),
          cash_received: method === "cash" ? round2(Number(cashReceived || 0)) : null,
          customer_id: customerId || null,
        });
        if (!res.ok) {
          setError(res.error ?? "ขายไม่สำเร็จ");
          return;
        }
        const methodLabel =
          method === "cash" ? "เงินสด" : method === "promptpay" ? "พร้อมเพย์" : "ขายเชื่อ";
        setReceipt({
          sale_id: res.sale_id!,
          bill_no: res.bill_no!,
          total: res.total!,
          change: res.change ?? 0,
          method: methodLabel,
          points: res.points ?? 0,
        });
        // โหมดเครื่องพิมพ์หน้าร้าน: สลิปเด้งทันทีที่ขายสำเร็จ ไม่ต้องกดปุ่ม
        if (autoPrint && res.sale_id) printReceipt(res.sale_id, paper);
        // รับเงินสด → เด้งลิ้นชักให้หยิบเงินทอน
        if (method === "cash" && drawerAuto && drawerConnected) kickDrawerForSale();
        // แจ้งจอลูกค้าว่าจ่ายแล้ว (โชว์เงินทอน/ขอบคุณ ค้างไว้จนกดขายต่อ)
        if (displayId) {
          pushDisplayStateAction(displayId, {
            mode: "paid",
            total: res.total!,
            change: res.change ?? 0,
            method: methodLabel,
            points: res.points ?? 0,
          }).catch(() => {});
        }
        resetSale();
        // ดึงสต็อก/แต้มล่าสุดมาแสดงในกริด กัน qty ค้างทั้งกะ (กัน oversell)
        router.refresh();
      } catch {
        // เน็ตสะดุด/เซิร์ฟเวอร์ไม่ตอบ — ยังไม่ล้างตะกร้า ให้ลองใหม่ได้
        setError(
          "เครือข่ายขัดข้อง — ยังไม่บันทึกการขาย ตรวจสอบแล้วลองใหม่อีกครั้ง (ตะกร้ายังอยู่)",
        );
      }
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
                  {p.has_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/products/${p.id}/image`}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">🧾 ตะกร้า</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setDrawerMsg(null);
                setDrawerModal(true);
              }}
              className="btn-ghost gap-1.5 px-2 py-1 text-xs"
              title="ลิ้นชักเก็บเงิน"
            >
              💰 ลิ้นชัก
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  drawerConnected ? "bg-green-500" : "bg-slate-300"
                }`}
              />
            </button>
            <button
              onClick={() => {
                setDisplayErr(null);
                setDisplayCode("");
                setDisplayModal(true);
              }}
              className="btn-ghost gap-1.5 px-2 py-1 text-xs"
              title="จอแสดงผลฝั่งลูกค้า"
            >
              🖥️ จอลูกค้า
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  displayId ? "bg-green-500" : "bg-slate-300"
                }`}
              />
            </button>
          </div>
        </div>

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
                <button
                  onClick={() => {
                    commitQty(i.product_id);
                    setQty(i.product_id, i.qty - 1);
                  }}
                  className="btn-outline h-7 w-7 p-0"
                >
                  −
                </button>
                <input
                  className="w-10 rounded border border-[var(--border)] text-center text-sm"
                  inputMode="numeric"
                  value={qtyDrafts[i.product_id] ?? String(i.qty)}
                  onChange={(e) => onQtyInput(i.product_id, e.target.value)}
                  onBlur={() => commitQty(i.product_id)}
                />
                <button
                  onClick={() => {
                    commitQty(i.product_id);
                    setQty(i.product_id, i.qty + 1);
                  }}
                  className="btn-outline h-7 w-7 p-0"
                >
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

      {/* Customer display pairing */}
      <Modal open={displayModal} onClose={() => setDisplayModal(false)} title="จอลูกค้า">
        {displayId ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
              เชื่อมต่อจอลูกค้าแล้ว — จอจะแสดงตะกร้า ยอดสุทธิ QR พร้อมเพย์ และเงินทอนอัตโนมัติ
            </p>
            <button
              onClick={() => {
                disconnectDisplay();
                setDisplayModal(false);
              }}
              className="btn-outline w-full text-red-600"
            >
              ยกเลิกการเชื่อมต่อ
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
              <li>
                เปิด{" "}
                <a
                  href="/pos-display"
                  target="_blank"
                  className="font-medium text-[var(--primary)] underline"
                >
                  หน้าจอลูกค้า
                </a>{" "}
                บนแท็บเล็ต/จอที่สอง (login ร้านเดียวกัน)
              </li>
              <li>จอนั้นจะแสดงรหัส 6 หลัก — นำมากรอกด้านล่าง</li>
            </ol>
            <input
              className="input text-center text-2xl tracking-[0.3em]"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={displayCode}
              onChange={(e) => setDisplayCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && displayCode.length === 6) submitPairCode();
              }}
            />
            {displayErr && <p className="text-sm text-red-600">{displayErr}</p>}
            <button
              disabled={displayPending || displayCode.length !== 6}
              onClick={submitPairCode}
              className="btn-primary w-full"
            >
              {displayPending ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ"}
            </button>
          </div>
        )}
      </Modal>

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
                onClick={() =>
                  setCashReceived(idx === 0 ? total.toFixed(2) : String(amt))
                }
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

      {/* PromptPay modal — 2 โหมด: QR เบอร์ร้าน (ฟรี ยืนยันเอง) / QR gateway (เช็คเงินเข้า+ปิดบิลเอง) */}
      <Modal open={payMode === "promptpay"} onClose={() => setPayMode(null)} title="รับเงินผ่านพร้อมเพย์">
        <div className="space-y-3 text-center">
          <div className="text-lg font-bold">{formatTHB(total)}</div>

          <div className="flex justify-center gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            <button
              onClick={() => loadDirectQR()}
              className={`flex-1 rounded-md px-3 py-1.5 ${
                qrMode === "direct" ? "bg-white font-medium shadow-sm" : "text-[var(--muted)]"
              }`}
            >
              QR เบอร์ร้าน (ฟรี)
            </button>
            <button
              onClick={() => {
                // ยังไม่เชื่อม gateway — โชว์แท็บไว้ให้รู้ว่ามีฟีเจอร์ แต่กดแล้วบอกทางไปเชื่อมต่อ
                if (gatewayConnected) openGatewayQR();
                else {
                  setQr(null);
                  setGwCharge(null);
                  setError(null);
                  setQrMode("gateway");
                }
              }}
              className={`flex-1 rounded-md px-3 py-1.5 ${
                qrMode === "gateway" ? "bg-white font-medium shadow-sm" : "text-[var(--muted)]"
              }`}
              title="QR จาก Omise/Stripe — ระบบเช็คเงินเข้าและปิดบิลให้เอง (มีค่าธรรมเนียมของ gateway)"
            >
              {gatewayConnected ? "QR อัตโนมัติ ⚡" : "QR อัตโนมัติ 🔒"}
            </button>
          </div>

          {qrMode === null && (
            <p className="py-4 text-sm text-[var(--muted)]">
              เลือกรูปแบบ QR ด้านบนก่อน — QR จะขึ้นจอลูกค้าหลังเลือกแล้วเท่านั้น
            </p>
          )}

          {qrMode === "gateway" && !gatewayConnected && (
            <div className="rounded-lg bg-indigo-50 px-3 py-3 text-sm text-indigo-800">
              โหมดนี้ระบบจะเช็คเงินเข้าและปิดบิลให้เอง — ต้องเชื่อมต่อ Omise/Stripe ก่อน
              <br />
              <a href="/integrations" className="font-semibold underline">
                ไปที่หน้า การเชื่อมต่อ →
              </a>
            </div>
          )}

          {qrMode === "direct" && !hasPromptPay && (
            <p className="text-sm text-amber-700">
              ยังไม่ได้ตั้งค่าเบอร์พร้อมเพย์ — ไปที่หน้าตั้งค่าก่อน
            </p>
          )}
          {qr && (
            <img src={qr} alt="PromptPay QR" className="mx-auto rounded-lg border border-[var(--border)]" />
          )}
          {!qr && !error && qrMode !== null && (qrMode === "gateway" ? gwLoading : hasPromptPay) && (
            <p className="py-6 text-sm text-[var(--muted)]">กำลังสร้าง QR...</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {qrMode === "direct" && (
            <>
              <p className="text-xs text-[var(--muted)]">
                ให้ลูกค้าสแกนจ่าย แล้วกดยืนยันเมื่อได้รับเงิน
              </p>
              <button
                disabled={pending || !qr}
                onClick={() => confirmCheckout("promptpay")}
                className="btn-primary w-full"
              >
                {pending ? "กำลังบันทึก..." : "ได้รับเงินแล้ว — ยืนยัน"}
              </button>
            </>
          )}
          {qrMode === "gateway" && (
            <p className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
              {gwCharge && !pending && (
                <>
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  รอลูกค้าสแกนจ่าย — เงินเข้าแล้วระบบจะปิดบิลให้เอง
                </>
              )}
              {pending && "เงินเข้าแล้ว! กำลังปิดบิล..."}
            </p>
          )}
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

      {/* ลิ้นชักเก็บเงิน */}
      <Modal open={drawerModal} onClose={() => setDrawerModal(false)} title="ลิ้นชักเก็บเงิน 💰">
        <div className="space-y-3 text-sm">
          {!isDrawerSupported() ? (
            <>
              <p>
                เบราว์เซอร์นี้ไม่รองรับการสั่งลิ้นชักโดยตรง — ใช้ <b>Chrome</b> หรือ{" "}
                <b>Edge</b> บนคอมพิวเตอร์แคชเชียร์
              </p>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-[var(--muted)]">
                หรือไม่ต้องตั้งค่าอะไรเลย: เข้าไดรเวอร์เครื่องพิมพ์สลิป เปิดตัวเลือก
                “Open cash drawer before printing” ลิ้นชักจะเด้งเองทุกครั้งที่พิมพ์ใบเสร็จ
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--muted)]">
                ลิ้นชักต้องเสียบสาย RJ11 เข้าเครื่องพิมพ์สลิป แล้วเชื่อมต่อเครื่องพิมพ์กับ
                เบราว์เซอร์ครั้งแรกครั้งเดียว — หลังจากนั้นระบบจะต่อให้เองอัตโนมัติ
              </p>

              {drawerConnected ? (
                <div className="flex gap-2">
                  <button onClick={openDrawerNow} className="btn-primary flex-1">
                    💰 เปิดลิ้นชักตอนนี้
                  </button>
                  <button
                    onClick={async () => {
                      await forgetDrawer();
                      setDrawerConnected(false);
                      setDrawerMsg(null);
                    }}
                    className="btn-outline"
                  >
                    ยกเลิกการเชื่อมต่อ
                  </button>
                </div>
              ) : (
                <button onClick={connectDrawer} className="btn-primary w-full">
                  🔌 เชื่อมต่อเครื่องพิมพ์/ลิ้นชัก
                </button>
              )}

              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={drawerAuto}
                  onChange={(e) => {
                    setDrawerAuto(e.target.checked);
                    localStorage.setItem("pos_drawer_auto", e.target.checked ? "1" : "0");
                  }}
                />
                เปิดลิ้นชักอัตโนมัติเมื่อรับชำระเงินสด
              </label>

              {drawerMsg && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">{drawerMsg}</div>
              )}

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-[var(--muted)]">
                ทางเลือกที่ไม่ต้องเชื่อมต่อ: ตั้งในไดรเวอร์เครื่องพิมพ์ให้
                “เปิดลิ้นชักเมื่อพิมพ์” — ลิ้นชักจะเด้งพร้อมใบเสร็จที่พิมพ์อัตโนมัติ
              </p>
            </>
          )}
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

            <div className="mt-4 flex gap-2">
              <select
                value={paper}
                onChange={(e) => {
                  const p = e.target.value as "80" | "58";
                  setPaper(p);
                  localStorage.setItem("pos_paper", p);
                }}
                className="input w-auto py-1.5 text-sm"
                title="หน้ากว้างกระดาษสลิป"
              >
                <option value="80">80mm</option>
                <option value="58">58mm</option>
              </select>
              <button
                onClick={() => printReceipt(receipt.sale_id, paper)}
                className="btn-outline flex-1"
              >
                🖨️ พิมพ์ใบเสร็จ
              </button>
            </div>
            <label className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => {
                  setAutoPrint(e.target.checked);
                  localStorage.setItem("pos_auto_print", e.target.checked ? "1" : "0");
                }}
              />
              พิมพ์ใบเสร็จอัตโนมัติเมื่อขายสำเร็จ
            </label>
            <a
              href={`/sales/${receipt.sale_id}`}
              target="_blank"
              className="block text-xs text-[var(--primary)] underline-offset-2 hover:underline"
            >
              เปิดดูใบเสร็จ / ใบกำกับภาษี
            </a>

            <button onClick={() => setReceipt(null)} className="btn-primary mt-2 w-full">
              ขายต่อ
            </button>
          </div>
        )}
      </Modal>

      {/* iframe พิมพ์สลิป — ซ่อนนอกจอ (ห้าม display:none ไม่งั้นบางเบราว์เซอร์ไม่ยอมพิมพ์)
          คงไว้หลังปิด modal เพื่อให้งานพิมพ์ที่ค้างอยู่ทำงานต่อจนจบ */}
      {printJob && (
        <iframe
          key={printJob.nonce}
          src={printJob.src}
          title="พิมพ์ใบเสร็จ"
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none fixed -left-[9999px] top-0 h-[600px] w-[420px] opacity-0"
        />
      )}
    </div>
  );
}
