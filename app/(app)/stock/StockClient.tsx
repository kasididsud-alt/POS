"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatTHB } from "@/lib/format";
import { planAllowsPath, type PlanTier } from "@/components/nav";
import type { Category, ProductWithStock } from "@/lib/types";

type StatusKey = "all" | "normal" | "low" | "out";

function statusOf(p: ProductWithStock): "normal" | "low" | "out" {
  if (p.qty <= 0) return "out";
  if (p.qty <= p.low_stock_threshold) return "low";
  return "normal";
}

const QUICK_ACTIONS = [
  { href: "/goods-receipt", label: "รับสินค้าเข้า", icon: "📥", tone: "green" },
  { href: "/stock-issue", label: "เบิก/ตัดจ่าย", icon: "📤", tone: "amber" },
  { href: "/transfers", label: "โอนย้ายคลัง/สาขา", icon: "🔄", tone: "indigo" },
  { href: "/stock-count", label: "ตรวจนับสต็อก", icon: "📋", tone: "slate" },
  { href: "/products", label: "เพิ่ม/แก้ไขสินค้า", icon: "📦", tone: "slate" },
] as const;

const SORTS = [
  { key: "actionable", label: "ต้องจัดการก่อน" },
  { key: "qty_asc", label: "คงเหลือน้อย→มาก" },
  { key: "value_desc", label: "มูลค่าสูง→ต่ำ" },
  { key: "name", label: "ชื่อ ก→ฮ" },
] as const;

export default function StockClient({
  products,
  categories,
  expiringLots,
  plan,
  branchName,
}: {
  products: ProductWithStock[];
  categories: Category[];
  expiringLots: number;
  plan: PlanTier;
  branchName: string | null;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>("all");
  const [catId, setCatId] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("actionable");

  // สรุปตัวเลข
  const kpi = useMemo(() => {
    let value = 0,
      units = 0,
      low = 0,
      out = 0;
    for (const p of products) {
      value += p.qty * Number(p.cost);
      units += p.qty;
      const s = statusOf(p);
      if (s === "low") low++;
      else if (s === "out") out++;
    }
    return { value, units, low, out };
  }, [products]);

  const counts = useMemo(
    () => ({
      all: products.length,
      normal: products.filter((p) => statusOf(p) === "normal").length,
      low: kpi.low,
      out: kpi.out,
    }),
    [products, kpi.low, kpi.out],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = products.filter((p) => {
      if (status !== "all" && statusOf(p) !== status) return false;
      if (catId && p.category_id !== catId) return false;
      if (
        q &&
        !(
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });

    const rank = { out: 0, low: 1, normal: 2 } as const;
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "qty_asc":
          return a.qty - b.qty;
        case "value_desc":
          return b.qty * Number(b.cost) - a.qty * Number(a.cost);
        case "name":
          return a.name.localeCompare(b.name, "th");
        default: // actionable
          return (
            rank[statusOf(a)] - rank[statusOf(b)] || a.qty - b.qty
          );
      }
    });
    return rows;
  }, [products, search, status, catId, sort]);

  function exportCsv() {
    const head = [
      "ชื่อสินค้า",
      "บาร์โค้ด",
      "SKU",
      "หมวดหมู่",
      "คงเหลือ",
      "หน่วย",
      "ทุน/หน่วย",
      "มูลค่ารวม",
      "สถานะ",
    ];
    const statusLabel = { normal: "ปกติ", low: "ใกล้หมด", out: "หมดสต็อก" };
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = filtered.map((p) =>
      [
        p.name,
        p.barcode ?? "",
        p.sku ?? "",
        p.category_name ?? "",
        p.qty,
        p.unit,
        Number(p.cost),
        p.qty * Number(p.cost),
        statusLabel[statusOf(p)],
      ]
        .map(esc)
        .join(","),
    );
    const csv = "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `คลังสินค้า-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const actions = QUICK_ACTIONS.filter((a) => planAllowsPath(plan, a.href));
  const toneCls: Record<string, string> = {
    green: "text-green-700",
    amber: "text-amber-700",
    indigo: "text-indigo-700",
    slate: "text-slate-700",
  };

  const tabs: { key: StatusKey; label: string; n: number }[] = [
    { key: "all", label: "ทั้งหมด", n: counts.all },
    { key: "normal", label: "ปกติ", n: counts.normal },
    { key: "low", label: "ใกล้หมด", n: counts.low },
    { key: "out", label: "หมดสต็อก", n: counts.out },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">คลังสินค้า</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {branchName ? (
              <>
                สาขา <span className="font-medium">{branchName}</span> ·{" "}
              </>
            ) : null}
            {products.length.toLocaleString("th-TH")} รายการ
          </p>
        </div>
        <button onClick={exportCsv} className="btn-outline" disabled={products.length === 0}>
          ⬇️ ส่งออก CSV
        </button>
      </div>

      {/* KPI */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="text-sm text-[var(--muted)]">มูลค่าสต็อก (ทุน)</div>
          <div className="mt-1 text-2xl font-bold">{formatTHB(kpi.value)}</div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">
            {kpi.units.toLocaleString("th-TH")} ชิ้นรวม
          </div>
        </div>
        <button
          onClick={() => setStatus("low")}
          className="card p-4 text-left transition-colors hover:bg-amber-50/50"
        >
          <div className="text-sm text-[var(--muted)]">ใกล้หมด</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{kpi.low}</div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">คลิกเพื่อดูรายการ →</div>
        </button>
        <button
          onClick={() => setStatus("out")}
          className="card p-4 text-left transition-colors hover:bg-red-50/50"
        >
          <div className="text-sm text-[var(--muted)]">หมดสต็อก</div>
          <div className="mt-1 text-2xl font-bold text-red-600">{kpi.out}</div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">คลิกเพื่อดูรายการ →</div>
        </button>
        {expiringLots > 0 ? (
          <Link href="/lots" className="card p-4 transition-colors hover:bg-orange-50/50">
            <div className="text-sm text-[var(--muted)]">Lot ใกล้/เกินหมดอายุ</div>
            <div className="mt-1 text-2xl font-bold text-orange-600">{expiringLots}</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">ภายใน 30 วัน →</div>
          </Link>
        ) : (
          <div className="card p-4">
            <div className="text-sm text-[var(--muted)]">รายการทั้งหมด</div>
            <div className="mt-1 text-2xl font-bold">
              {counts.all.toLocaleString("th-TH")}
            </div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">สินค้าที่เปิดขาย</div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="card flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50"
          >
            <span>{a.icon}</span>
            <span className={toneCls[a.tone]}>{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="ค้นหาชื่อ / SKU / บาร์โค้ด"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
        >
          <option value="">ทุกหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              เรียง: {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status tabs */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              status === t.key
                ? "bg-[var(--primary)] text-[var(--primary-fg)]"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
            <span className="ml-1 opacity-70">{t.n}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">สินค้า</th>
              <th className="px-4 py-3">หมวด</th>
              <th className="px-4 py-3 text-right">คงเหลือ</th>
              <th className="px-4 py-3 text-right">ทุน/หน่วย</th>
              <th className="px-4 py-3 text-right">มูลค่ารวม</th>
              <th className="px-4 py-3 text-right">ประวัติ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                  {products.length === 0 ? (
                    <>
                      ยังไม่มีสินค้า —{" "}
                      <Link href="/products" className="font-medium text-[var(--primary)]">
                        เพิ่มสินค้า
                      </Link>
                    </>
                  ) : (
                    "ไม่พบสินค้าตามเงื่อนไข"
                  )}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const s = statusOf(p);
              const badge =
                s === "out"
                  ? "bg-red-50 text-red-700"
                  : s === "low"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-green-50 text-green-700";
              return (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {p.barcode || p.sku || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {p.category_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${badge}`}>
                      {p.qty} {p.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatTHB(Number(p.cost))}</td>
                  <td className="px-4 py-3 text-right">
                    {formatTHB(p.qty * Number(p.cost))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/stock/${p.id}`}
                      className="text-xs font-medium text-[var(--primary)]"
                    >
                      ดูความเคลื่อนไหว →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
