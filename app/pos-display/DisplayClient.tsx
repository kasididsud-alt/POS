"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTHB } from "@/lib/format";
import LogoMark from "@/components/landing/LogoMark";
import {
  createDisplaySessionAction,
  type DisplayState,
} from "@/app/(app)/pos/actions";

// รหัสจับคู่ฝั่ง server มีอายุ 30 นาที — ถ้ายังไม่ถูกจับคู่และใกล้หมดอายุ ให้ขอรหัสใหม่เอง
const CODE_TTL_MS = 25 * 60 * 1000;

type Session = { id: string; code: string; createdAt: number };

export default function DisplayClient({
  orgId,
  orgName,
  orgLogo,
}: {
  orgId: string;
  orgName: string;
  orgLogo: string | null;
}) {
  const storeKey = `kd_display:${orgId}`;
  const [session, setSession] = useState<Session | null>(null);
  const [paired, setPaired] = useState(false);
  const [state, setState] = useState<DisplayState>({ mode: "idle" });
  const [error, setError] = useState<string | null>(null);
  const lastV = useRef<string | null>(null);

  const createSession = useCallback(async () => {
    setError(null);
    try {
      const res = await createDisplaySessionAction();
      if (!res.ok || !res.id || !res.code) {
        setError(res.error ?? "สร้าง session ไม่สำเร็จ");
        return;
      }
      const s = { id: res.id, code: res.code, createdAt: Date.now() };
      setSession(s);
      setPaired(false);
      setState({ mode: "idle" });
      lastV.current = null;
      try {
        localStorage.setItem(storeKey, JSON.stringify(s));
      } catch {
        /* ignore */
      }
    } catch {
      setError("เครือข่ายขัดข้อง — ลองรีเฟรชหน้านี้");
    }
  }, [storeKey]);

  // เริ่มต้น: ใช้ session เดิมถ้ายังจับคู่อยู่ ไม่งั้นขอใหม่
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: Session | null = null;
      try {
        const raw = localStorage.getItem(storeKey);
        stored = raw ? (JSON.parse(raw) as Session) : null;
      } catch {
        stored = null;
      }
      if (stored?.id) {
        const res = await fetch(`/api/pos/display?id=${stored.id}`).then(
          (r) => r.json(),
          () => null,
        );
        if (cancelled) return;
        if (res?.ok && res.paired) {
          setSession(stored);
          setPaired(true);
          if (res.state) setState(res.state as DisplayState);
          lastV.current = res.v ?? null;
          return;
        }
      }
      if (!cancelled) await createSession();
    })();
    return () => {
      cancelled = true;
    };
  }, [storeKey, createSession]);

  // รับสถานะแบบสดผ่าน SSE — เซิร์ฟเวอร์ push ทันทีที่แคชเชียร์อัปเดต
  // (EventSource ต่อใหม่ให้เองเมื่อหลุด; ถ้า session หายจากระบบค่อยขอรหัสชุดใหม่)
  useEffect(() => {
    if (!session) return;
    let disposed = false;
    let checkingGone = false;

    const es = new EventSource(`/api/pos/display/stream?id=${session.id}`);

    es.addEventListener("state", (e) => {
      if (disposed) return;
      try {
        const d = JSON.parse((e as MessageEvent).data);
        setPaired(!!d.paired);
        if (!d.paired) {
          // ถูกยกเลิกการจับคู่ — ถ้ารหัสเดิมใกล้หมดอายุ ขอชุดใหม่
          if (Date.now() - session.createdAt > CODE_TTL_MS) createSession();
          return;
        }
        if (d.state) {
          setState(d.state as DisplayState);
          lastV.current = d.v ?? null;
        }
      } catch {
        /* payload เพี้ยน — ข้ามรอบนี้ */
      }
    });

    es.addEventListener("gone", () => {
      if (!disposed) createSession();
    });

    // ต่อไม่ติดซ้ำๆ อาจแปลว่า session ถูกลบ (เซิร์ฟเวอร์ตอบ 404) — เช็คหนึ่งครั้งแล้วตัดสิน
    es.onerror = async () => {
      if (disposed || checkingGone) return;
      checkingGone = true;
      try {
        const r = await fetch(`/api/pos/display?id=${session.id}`);
        if (r.status === 404 && !disposed) {
          es.close();
          await createSession();
          return;
        }
      } catch {
        /* เน็ตล่มชั่วคราว — ปล่อยให้ EventSource ต่อใหม่เอง */
      } finally {
        checkingGone = false;
      }
    };

    return () => {
      disposed = true;
      es.close();
    };
  }, [session, createSession]);

  return (
    <div className="lp flex min-h-screen flex-col">
      {/* หัวจอ: โลโก้ร้านมุมซ้ายบน + ปุ่มเต็มจอ */}
      <header className="flex items-center justify-between border-b border-[var(--rule)] bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          {orgLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogo}
              alt="โลโก้ร้าน"
              className="h-10 w-10 shrink-0 object-contain"
            />
          ) : (
            <LogoMark />
          )}
          <span className="lp-display text-xl font-semibold">{orgName}</span>
        </div>
        <button
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen().catch(() => {});
          }}
          className="rounded-lg border border-[var(--rule)] px-3 py-1.5 text-xs text-[var(--muted2)] hover:text-[var(--ink)]"
        >
          เต็มจอ
        </button>
      </header>

      {error && (
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-[var(--muted2)]">{error}</p>
            <button onClick={createSession} className="lp-btn-solid mt-4">
              ลองใหม่
            </button>
          </div>
        </main>
      )}

      {/* ยังไม่จับคู่: โชว์รหัส */}
      {!error && session && !paired && (
        <main className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <p className="lp-mono text-sm font-semibold tracking-[0.2em] text-[var(--green)]">
              รหัสจับคู่จอลูกค้า
            </p>
            <div className="lp-mono mt-4 text-8xl font-bold tracking-[0.15em]">
              {session.code}
            </div>
            <p className="mx-auto mt-8 max-w-sm text-sm leading-relaxed text-[var(--muted2)]">
              ที่เครื่องแคชเชียร์: เปิดหน้า <b className="text-[var(--ink)]">ขายหน้าร้าน (POS)</b>{" "}
              กดปุ่ม <b className="text-[var(--ink)]">จอลูกค้า</b> แล้วกรอกรหัสนี้
            </p>
          </div>
        </main>
      )}

      {!error && session && paired && <PairedView state={state} />}
    </div>
  );
}

/* จอหลักหลังจับคู่: ซ้าย = ลูกค้า + รายการ, ขวา = กล่อง QR + ยอดสุทธิ (โครงคงที่ทุกสถานะ) */
function PairedView({ state }: { state: DisplayState }) {
  const cart = state.mode === "cart" ? state : null;

  return (
    <main className="relative grid flex-1 gap-5 p-5 lg:grid-cols-[1fr_380px]">
      {/* ซ้าย: ชื่อลูกค้า + รายการสินค้า */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--rule)] bg-white">
        <div className="flex items-center gap-3 border-b border-[var(--rule)] bg-[var(--paper-2)] px-5 py-3">
          <span className="text-sm text-[var(--muted2)]">ลูกค้า</span>
          <span className="lp-display font-semibold">
            {cart?.customer ?? "ลูกค้าทั่วไป"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {!cart?.items.length && (
            <p className="py-16 text-center text-[var(--muted2)]">ยังไม่มีรายการ</p>
          )}
          {cart?.items.map((i, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 border-b border-[var(--rule)] py-3 text-lg"
            >
              <span className="lp-mono w-8 shrink-0 text-sm text-[var(--muted2)]">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{i.name}</span>
                {/* ราคาต่อหน่วย ให้ลูกค้าเช็คได้ว่าคิดชิ้นละเท่าไร */}
                <span className="lp-mono block text-sm text-[var(--muted2)]">
                  {formatTHB(i.price)}
                  {i.unit ? ` / ${i.unit}` : ""}
                </span>
              </span>
              <span className="lp-mono shrink-0 text-base text-[var(--muted2)]">
                × {i.qty}
                {i.unit ? ` ${i.unit}` : ""}
              </span>
              <span className="lp-mono w-32 shrink-0 text-right font-semibold">
                {formatTHB(i.total)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 border-t border-[var(--rule)] px-5 py-4">
          <div className="flex justify-between text-[var(--muted2)]">
            <span>ยอดรวม</span>
            <span className="lp-mono">{formatTHB(cart?.subtotal ?? 0)}</span>
          </div>
          {!!cart?.discount && (
            <div className="flex justify-between text-[var(--green)]">
              <span>ส่วนลด</span>
              <span className="lp-mono">−{formatTHB(cart.discount)}</span>
            </div>
          )}
        </div>
      </section>

      {/* ขวา: กล่อง QR (ว่างได้) + ยอดสุทธิ */}
      <section className="flex flex-col rounded-2xl border border-[var(--rule)] bg-white p-5">
        <div className="flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-dashed border-[var(--rule)] bg-[var(--paper)] p-4">
          {cart?.qr ? (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cart.qr}
                alt="PromptPay QR"
                className="mx-auto w-full max-w-[280px] rounded-xl bg-white"
              />
              <p className="mt-3 font-semibold text-[var(--green)]">
                สแกนจ่ายด้วยพร้อมเพย์
              </p>
            </div>
          ) : (
            <div className="text-center text-[var(--muted2)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="mx-auto h-12 w-12 opacity-50"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3h-3zM20 14h1M14 20h1M20 20h1" />
              </svg>
              <p className="mt-2 text-sm">QR ชำระเงินจะแสดงที่นี่</p>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 text-right">
          <div className="text-sm text-[var(--muted2)]">ยอดสุทธิ</div>
          <div className="lp-mono text-[clamp(2.2rem,3.2vw+1rem,3.75rem)] font-bold leading-tight text-[var(--green)]">
            {formatTHB(cart?.total ?? 0)}
          </div>
        </div>
      </section>

      {/* จ่ายแล้ว: ทับทั้งจอด้วยสรุป + เงินทอน จนแคชเชียร์กดขายต่อ */}
      {state.mode === "paid" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--paper)]/95 backdrop-blur-sm">
          <div className="text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--green)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-10 w-10"
                aria-hidden="true"
              >
                <path d="m5 12 5 5L20 7" />
              </svg>
            </span>
            <div className="lp-display mt-6 text-5xl font-bold">ขอบคุณครับ/ค่ะ</div>
            <p className="mt-3 text-[var(--muted2)]">
              ชำระ {formatTHB(state.total)} · {state.method}
            </p>
            {state.change > 0 && (
              <div className="mt-6">
                <span className="text-[var(--muted2)]">เงินทอน</span>
                <div className="lp-mono text-6xl font-bold text-[var(--green)]">
                  {formatTHB(state.change)}
                </div>
              </div>
            )}
            {state.points > 0 && (
              <p className="mt-4 text-sm text-[var(--muted2)]">
                ได้รับ {state.points} แต้มสะสม
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
