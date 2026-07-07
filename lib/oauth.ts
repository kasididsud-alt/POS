// Google OAuth 2.0 — ทำเองแบบ minimal ไม่ต้องพึ่ง library
// ใช้ Authorization Code flow: redirect ไป Google → callback แลก token → ดึงโปรไฟล์
import { randomBytes } from "node:crypto";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleProfile = {
  sub: string; // id ถาวรของบัญชี Google
  email: string;
  email_verified: boolean;
  name: string | null;
  picture: string | null;
};

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function redirectUri(): string {
  return `${siteUrl()}/api/auth/google/callback`;
}

/** state แบบสุ่มไว้กัน CSRF (เก็บคู่กันใน cookie) */
export function newState(): string {
  return randomBytes(16).toString("hex");
}

/** URL ที่จะพาผู้ใช้ไปหน้ายินยอมของ Google */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** แลก authorization code เป็น access token */
async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("no access_token in response");
  return data.access_token;
}

/** ดึงโปรไฟล์ผู้ใช้จาก access token */
async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`userinfo failed: ${res.status} ${await res.text()}`);
  }
  const u = (await res.json()) as {
    sub: string;
    email: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  return {
    sub: u.sub,
    email: u.email.toLowerCase(),
    email_verified: Boolean(u.email_verified),
    name: u.name ?? null,
    picture: u.picture ?? null,
  };
}

/** flow ฝั่ง callback: code → โปรไฟล์ Google */
export async function getProfileFromCode(code: string): Promise<GoogleProfile> {
  const token = await exchangeCode(code);
  return fetchProfile(token);
}
