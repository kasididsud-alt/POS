import { NextRequest } from "next/server";
import { one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { subscribeDisplay } from "@/lib/display-events";

export const dynamic = "force-dynamic";

// สตรีมสถานะจอลูกค้าแบบสดผ่าน SSE — ส่งสถานะปัจจุบันทันทีที่ต่อ แล้ว push ทุกครั้งที่
// แคชเชียร์อัปเดต (ผ่าน pg_notify) พร้อม heartbeat กัน proxy ตัดการเชื่อมต่อ
export async function GET(req: NextRequest) {
  const ctx = await getAppContext();
  if (!ctx?.org) return new Response("unauthorized", { status: 401 });
  const orgId = ctx.org.id;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });

  async function readRow() {
    return one<{ state: unknown; paired: boolean; v: string }>(
      `select state, paired, floor(extract(epoch from updated_at) * 1000)::bigint::text as v
         from customer_displays
        where id = $1::uuid and org_id = $2`,
      [id, orgId],
    ).catch(() => null);
  }

  const first = await readRow();
  if (!first) return new Response("not_found", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      send("state", first);

      const unsubscribe = await subscribeDisplay(id, async () => {
        const row = await readRow();
        if (!row) send("gone", {});
        else send("state", row);
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, 20000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* ปิดไปแล้ว */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // กัน buffering ของ reverse proxy (เช่น nginx) เวลา deploy จริง
      "X-Accel-Buffering": "no",
    },
  });
}
