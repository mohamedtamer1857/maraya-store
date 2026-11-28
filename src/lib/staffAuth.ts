import crypto from 'node:crypto';

declare global {
  var _marayaRuntimeSecret: string | undefined;
}

function getSigningSecret(): string {
  const envSecret = (
    process.env.STAFF_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    ''
  ).trim();
  if (envSecret.length >= 16) {
    return envSecret;
  }
  if (!global._marayaRuntimeSecret) {
    global._marayaRuntimeSecret = crypto.randomBytes(32).toString('hex');
  }
  return global._marayaRuntimeSecret;
}

export function normalizeUsername(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\u200B-\u200F\u202A-\u202E\uFEFF]+/g, '')
    .slice(0, 60);
}

export function isValidUsername(username: string): boolean {
  return /^[\p{L}\p{N}][\p{L}\p{N}._@-]{1,59}$/u.test(username);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const expected = Buffer.from(hexHash, 'hex');
    const actual = crypto.scryptSync(password, salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface StaffTokenPayload {
  type: 'staff';
  sub: string;
  sid: number;
  role: string;
  exp: number;
}

export interface OrderAccessTokenPayload {
  type: 'order';
  orderRef: string;
  exp: number;
}

function signPayload(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySignedToken<T>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  try {
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(encoded)
      .digest('base64url');
    if (!timingSafeStringEqual(sig, expectedSig)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T & {
      exp?: number;
    };
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function signStaffToken(input: {
  username: string;
  staffId: number;
  role: string;
}): string {
  const payload: StaffTokenPayload = {
    type: 'staff',
    sub: input.username,
    sid: input.staffId,
    role: input.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  return signPayload(payload);
}

export function verifyStaffToken(token: string): StaffTokenPayload | null {
  const payload = verifySignedToken<StaffTokenPayload>(token);
  if (!payload || payload.type !== 'staff' || !payload.sub) return null;
  return payload;
}

export function signOrderAccessToken(orderRef: string): string {
  const payload: OrderAccessTokenPayload = {
    type: 'order',
    orderRef,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 90,
  };
  return signPayload(payload);
}

export function verifyOrderAccessToken(token: string): OrderAccessTokenPayload | null {
  const payload = verifySignedToken<OrderAccessTokenPayload>(token);
  if (!payload || payload.type !== 'order' || !payload.orderRef) return null;
  return payload;
}

export function getEnvAdminConfig(): { username: string; password: string | null } {
  const rawUsername = process.env.STAFF_ADMIN_USERNAME;
  const username = normalizeUsername(rawUsername) || 'admin';
  const rawPassword = process.env.STAFF_ADMIN_PASSWORD?.trim() || '';
  return {
    username: isValidUsername(username) ? username : 'admin',
    password: rawPassword.length > 0 ? rawPassword : null,
  };
}
