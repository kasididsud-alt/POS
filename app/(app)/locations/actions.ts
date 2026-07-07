"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

type Result = { ok: boolean; error?: string };

async function requireOrg() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  return ctx.org.id;
}

export async function saveLocation(formData: FormData): Promise<Result> {
  try {
    const orgId = await requireOrg();
    const id = String(formData.get("id") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const zone = String(formData.get("zone") ?? "").trim() || null;
    const note = String(formData.get("note") ?? "").trim() || null;
    if (!code) return { ok: false, error: "กรุณากรอกรหัสตำแหน่ง" };

    if (id) {
      await query(
        "update storage_locations set code=$1, zone=$2, note=$3 where id=$4 and org_id=$5",
        [code, zone, note, id, orgId],
      );
    } else {
      await query(
        "insert into storage_locations (org_id, code, zone, note) values ($1,$2,$3,$4)",
        [orgId, code, zone, note],
      );
    }
    revalidatePath("/locations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteLocation(id: string): Promise<Result> {
  try {
    const orgId = await requireOrg();
    await query("delete from storage_locations where id=$1 and org_id=$2", [id, orgId]);
    revalidatePath("/locations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
