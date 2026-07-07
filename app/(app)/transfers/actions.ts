"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

type Result = { ok: boolean; error?: string };
type TLine = { product_id: string; name: string; qty: number };

export async function createTransfer(input: {
  from_branch_id: string;
  to_branch_id: string;
  note: string | null;
  items: TLine[];
}): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    if (!input.from_branch_id || !input.to_branch_id)
      return { ok: false, error: "เลือกสาขาต้นทางและปลายทาง" };
    if (input.from_branch_id === input.to_branch_id)
      return { ok: false, error: "ต้นทางและปลายทางต้องต่างกัน" };
    const items = (input.items ?? []).filter((i) => i.product_id && i.qty > 0);
    if (!items.length) return { ok: false, error: "เพิ่มรายการอย่างน้อย 1" };

    await query("select create_transfer($1,$2,$3,$4::jsonb,$5,$6)", [
      ctx.org.id,
      input.from_branch_id,
      input.to_branch_id,
      JSON.stringify(items),
      input.note || null,
      ctx.userId,
    ]);
    revalidatePath("/transfers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setTransferStatus(
  id: string,
  status: "received" | "cancelled",
): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    const t = await one("select id from stock_transfers where id=$1 and org_id=$2", [
      id,
      ctx.org.id,
    ]);
    if (!t) return { ok: false, error: "ไม่พบใบโอน" };

    // RPC ขยับสต็อกจริง: received → เพิ่มปลายทาง, cancelled → คืนต้นทาง
    if (status === "received") {
      await query("select receive_transfer($1,$2)", [id, ctx.userId]);
    } else {
      await query("select cancel_transfer($1,$2)", [id, ctx.userId]);
    }
    revalidatePath("/transfers");
    revalidatePath("/stock");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
