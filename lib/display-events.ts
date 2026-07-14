import { Client } from "pg";
import { EventEmitter } from "node:events";
import { query } from "./db";

// ท่อส่งอีเวนต์จอลูกค้าแบบสด: แคชเชียร์อัปเดตแถว → pg_notify → ตัว listener
// ตัวเดียวของโปรเซสกระจายต่อให้ SSE ทุกสายที่รอฟัง display id นั้นอยู่
// ใช้ Postgres เป็นตัวกลาง (ไม่ใช่ EventEmitter อย่างเดียว) เพื่อให้ทำงานข้ามโปรเซสได้

const CHANNEL = "customer_display_changed";
const RECONNECT_MS = 3000;

type Hub = { emitter: EventEmitter; connected: Promise<void> | null };
const globalForHub = globalThis as unknown as { __displayHub?: Hub };
const hub: Hub = globalForHub.__displayHub ?? {
  emitter: new EventEmitter().setMaxListeners(0),
  connected: null,
};
if (process.env.NODE_ENV !== "production") globalForHub.__displayHub = hub;

async function ensureListener(): Promise<void> {
  if (hub.connected) return hub.connected;
  hub.connected = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const onDown = () => {
      // การเชื่อมต่อหลุด — เคลียร์สถานะ แล้วต่อใหม่ถ้ายังมีจอรอฟังอยู่
      hub.connected = null;
      client.removeAllListeners();
      if (hub.emitter.eventNames().length > 0) {
        setTimeout(() => ensureListener().catch(() => {}), RECONNECT_MS);
      }
    };
    client.on("error", onDown);
    client.on("end", onDown);
    client.on("notification", (msg) => {
      if (msg.channel === CHANNEL && msg.payload) hub.emitter.emit(msg.payload);
    });
    await client.connect();
    await client.query(`listen ${CHANNEL}`);
  })();
  try {
    await hub.connected;
  } catch (e) {
    hub.connected = null;
    throw e;
  }
}

/** ฟังการเปลี่ยนแปลงของ display id — คืนฟังก์ชันสำหรับเลิกฟัง */
export async function subscribeDisplay(
  id: string,
  fn: () => void,
): Promise<() => void> {
  await ensureListener();
  hub.emitter.on(id, fn);
  return () => hub.emitter.off(id, fn);
}

/** แจ้งว่า display id นี้มีสถานะใหม่ (เรียกหลัง update แถวสำเร็จ) */
export async function notifyDisplay(id: string): Promise<void> {
  await query("select pg_notify($1, $2)", [CHANNEL, id]);
}
