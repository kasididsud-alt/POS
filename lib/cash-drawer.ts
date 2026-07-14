"use client";

/* ลิ้นชักเก็บเงิน (cash drawer)
   ลิ้นชักแทบทุกรุ่นไม่ได้ต่อคอมตรง ๆ แต่เสียบสาย RJ11 เข้าเครื่องพิมพ์สลิป
   แล้วเครื่องพิมพ์ส่งพัลส์ "kick" ให้ลิ้นชักเด้ง — โมดูลนี้คุยกับเครื่องพิมพ์
   ผ่าน Web Serial API (Chrome/Edge เท่านั้น) ด้วยคำสั่ง ESC/POS: ESC p m t1 t2
   ยิงทั้ง pin 2 (m=0) และ pin 5 (m=1) เพื่อให้เข้าได้กับสายทุกแบบ */

// Web Serial ยังไม่อยู่ใน lib.dom ของ TypeScript — ประกาศ type เท่าที่ใช้
type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  forget?: () => Promise<void>;
  writable: WritableStream<Uint8Array> | null;
};
type SerialLike = {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
};

const KICK = new Uint8Array([
  0x1b, 0x70, 0x00, 0x19, 0xfa, // ESC p 0 25 250
  0x1b, 0x70, 0x01, 0x19, 0xfa, // ESC p 1 25 250
]);
const BAUD = 9600;

let port: SerialPortLike | null = null;

function serialApi(): SerialLike | null {
  return typeof navigator !== "undefined"
    ? ((navigator as unknown as { serial?: SerialLike }).serial ?? null)
    : null;
}

/** เบราว์เซอร์นี้ใช้ Web Serial ได้ไหม (Chrome/Edge บนเดสก์ท็อป) */
export function isDrawerSupported(): boolean {
  return serialApi() !== null;
}

async function openPort(p: SerialPortLike): Promise<void> {
  try {
    await p.open({ baudRate: BAUD });
  } catch (e) {
    // เปิดค้างอยู่แล้ว (เช่น hot reload) ถือว่าใช้ได้
    if (!(e instanceof DOMException && e.name === "InvalidStateError")) throw e;
  }
}

/** ขอสิทธิ์เลือกพอร์ตเครื่องพิมพ์ — ต้องเรียกจาก user gesture (คลิกปุ่ม) */
export async function requestDrawerPort(): Promise<void> {
  const api = serialApi();
  if (!api) throw new Error("เบราว์เซอร์นี้ไม่รองรับ — ใช้ Chrome หรือ Edge");
  const p = await api.requestPort(); // โยน NotFoundError ถ้าผู้ใช้กดยกเลิก
  await openPort(p);
  port = p;
}

/** ต่อพอร์ตที่เคยได้รับสิทธิ์ไว้แล้วกลับมาใช้ (ตอนเปิดหน้า POS) */
export async function reconnectDrawer(): Promise<boolean> {
  const api = serialApi();
  if (!api) return false;
  try {
    const ports = await api.getPorts();
    if (!ports.length) return false;
    await openPort(ports[0]);
    port = ports[0];
    return true;
  } catch {
    return false; // เครื่องพิมพ์ถูกถอด/ปิดอยู่
  }
}

export function isDrawerConnected(): boolean {
  return port !== null;
}

/** ส่งพัลส์เปิดลิ้นชัก */
export async function kickDrawer(): Promise<void> {
  if (!port?.writable) {
    port = null;
    throw new Error("ยังไม่ได้เชื่อมต่อเครื่องพิมพ์/ลิ้นชัก");
  }
  const writer = port.writable.getWriter();
  try {
    await writer.write(KICK);
  } finally {
    writer.releaseLock();
  }
}

/** ตัดการเชื่อมต่อ + ถอนสิทธิ์พอร์ต */
export async function forgetDrawer(): Promise<void> {
  if (!port) return;
  const p = port;
  port = null;
  try {
    await p.close();
  } catch {
    /* ปิดไปแล้วก็ไม่เป็นไร */
  }
  try {
    await p.forget?.();
  } catch {
    /* บางเวอร์ชันไม่มี forget */
  }
}
