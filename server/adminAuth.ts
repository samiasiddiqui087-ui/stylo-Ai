import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.VERCEL
  ? '/tmp/immerso-data'
  : path.resolve(__dirname, '..', 'data');
const AUTH_STORE_PATH = path.resolve(DATA_DIR, 'admin-auth.json');

// Pre-hashed bcrypt digest (cost 12) for the initial bootstrap password; plaintext is never stored.
const INITIAL_BOOTSTRAP_BCRYPT_HASH =
  '$2b$12$.lqzI/Pz8btEMVQkDwmZvuo3lFrf4xXC9BbS/WZzTQvseOHZ2FCb.';
const DEFAULT_ADMIN_EMAIL = 'samiasiddiqui087@gmail.com';

const ADMIN_COOKIE_NAME = 'immerso_admin_sid_v2';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const BCRYPT_ROUNDS = 12;

interface AdminAuthRecord {
  email: string;
  passwordHash: string;
  mustChangePassword: boolean;
  tokenVersion: number;
  updatedAt: string;
}

interface AdminTokenPayload {
  email: string;
  role: 'admin';
  tokenVersion: number;
  jti: string;
  iat: number;
  exp: number;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  detail: string;
  actor: string;
  timestamp: string;
}

export interface AuthenticatedAdminRequest extends Request {
  adminAuth?: {
    email: string;
    jti: string;
    mustChangePassword: boolean;
  };
}

// Ephemeral fallback secret per process if ADMIN_SESSION_SECRET is not configured
const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
function getSessionSecret(): string {
  const configured = (process.env.ADMIN_SESSION_SECRET || '').trim();
  return configured.length >= 16 ? configured : EPHEMERAL_SESSION_SECRET;
}

// Track explicitly logged-out session IDs & failed login throttling in memory
const revokedTokenIds = new Set<string>();
const loginFailureMap = new Map<string, { failures: number; resetAt: number }>();
const adminAuditLogs: AdminAuditEntry[] = [];

export function recordAdminAudit(actor: string, action: string, detail: string) {
  adminAuditLogs.unshift({
    id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    action,
    detail: detail.slice(0, 240),
    actor,
    timestamp: new Date().toISOString(),
  });
  if (adminAuditLogs.length > 50) {
    adminAuditLogs.length = 50;
  }
}

export function getAdminAuditLogs(): AdminAuditEntry[] {
  return adminAuditLogs;
}

function getConfiguredAdminEmail(): string {
  const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return envEmail || DEFAULT_ADMIN_EMAIL;
}

function persistAuthRecord(record: AdminAuthRecord): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(AUTH_STORE_PATH, JSON.stringify(record, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

function loadOrInitializeAuthRecord(): AdminAuthRecord {
  const configuredEmail = getConfiguredAdminEmail();
  const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();

  if (envHash && /^\$2[aby]\$\d{2}\$/.test(envHash)) {
    return {
      email: configuredEmail,
      passwordHash: envHash,
      mustChangePassword: false,
      tokenVersion: 1,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    if (fs.existsSync(AUTH_STORE_PATH)) {
      const raw = fs.readFileSync(AUTH_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AdminAuthRecord>;
      if (
        parsed.email &&
        parsed.passwordHash &&
        /^\$2[aby]\$\d{2}\$/.test(parsed.passwordHash) &&
        typeof parsed.tokenVersion === 'number'
      ) {
        return {
          email: parsed.email.toLowerCase(),
          passwordHash: parsed.passwordHash,
          mustChangePassword: Boolean(parsed.mustChangePassword),
          tokenVersion: parsed.tokenVersion,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('Re-initializing admin auth store:', err instanceof Error ? err.message : err);
  }

  const envInitialPassword = (process.env.ADMIN_INITIAL_PASSWORD || '').trim();
  const initialHash = envInitialPassword
    ? bcrypt.hashSync(envInitialPassword, BCRYPT_ROUNDS)
    : INITIAL_BOOTSTRAP_BCRYPT_HASH;

  const initialRecord: AdminAuthRecord = {
    email: configuredEmail,
    passwordHash: initialHash,
    mustChangePassword: true,
    tokenVersion: 1,
    updatedAt: new Date().toISOString(),
  };

  try {
    persistAuthRecord(initialRecord);
  } catch (err) {
    console.warn('Could not persist admin auth store to disk:', err instanceof Error ? err.message : err);
  }

  return initialRecord;
}

let cachedRecord: AdminAuthRecord = loadOrInitializeAuthRecord();

function getRecord(): AdminAuthRecord {
  const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  if (envHash && /^\$2[aby]\$\d{2}\$/.test(envHash)) {
    return {
      ...cachedRecord,
      email: getConfiguredAdminEmail(),
      passwordHash: envHash,
      mustChangePassword: false,
    };
  }
  return cachedRecord;
}

function signAdminToken(record: AdminAuthRecord): { token: string; jti: string } {
  const now = Date.now();
  const jti = crypto.randomBytes(16).toString('hex');
  const payload: AdminTokenPayload = {
    email: record.email,
    role: 'admin',
    tokenVersion: record.tokenVersion,
    jti,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return { token: `${encodedPayload}.${sig}`, jti };
}

function verifyAdminToken(token: string): AdminTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  const bufProvided = Buffer.from(providedSig, 'utf8');
  const bufExpected = Buffer.from(expectedSig, 'utf8');
  if (bufProvided.length !== bufExpected.length) return null;
  if (!crypto.timingSafeEqual(bufProvided, bufExpected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as AdminTokenPayload;

    const record = getRecord();
    if (
      payload.role !== 'admin' ||
      typeof payload.email !== 'string' ||
      payload.email.toLowerCase() !== record.email.toLowerCase() ||
      payload.tokenVersion !== record.tokenVersion ||
      typeof payload.exp !== 'number' ||
      Date.now() > payload.exp ||
      !payload.jti ||
      revokedTokenIds.has(payload.jti)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function extractRequestToken(req: Request): { token: string; viaCookieOnly: boolean } {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) {
      return { token: bearer, viaCookieOnly: false };
    }
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[ADMIN_COOKIE_NAME]) {
    return { token: cookies[ADMIN_COOKIE_NAME], viaCookieOnly: true };
  }
  return { token: '', viaCookieOnly: false };
}

function validateMutatingCsrf(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  if (req.headers['x-requested-with'] === 'IMMERSO-Admin') {
    return true;
  }

  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}

function setAdminSessionCookie(res: Response, token: string): void {
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    partitioned: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
  } as CookieOptions & { partitioned: boolean };
  res.cookie(ADMIN_COOKIE_NAME, token, cookieOpts);
}

function clearAdminSessionCookie(res: Response): void {
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    partitioned: true,
    path: '/',
  } as CookieOptions & { partitioned: boolean };
  res.clearCookie(ADMIN_COOKIE_NAME, cookieOpts);
}

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginFailureMap.get(ip);
  if (!entry || now > entry.resetAt) {
    return { allowed: true };
  }
  if (entry.failures >= 8) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginFailureMap.get(ip);
  if (!entry || now > entry.resetAt) {
    loginFailureMap.set(ip, { failures: 1, resetAt: now + 10 * 60_000 });
  } else {
    entry.failures += 1;
  }
}

function clearLoginFailures(ip: string): void {
  loginFailureMap.delete(ip);
}

export function requireAdminAuth() {
  return (req: AuthenticatedAdminRequest, res: Response, next: NextFunction) => {
    const { token, viaCookieOnly } = extractRequestToken(req);
    if (!token) {
      return res.status(401).json({
        authenticated: false,
        error: 'Unauthorized. Admin authentication required.',
      });
    }

    if (viaCookieOnly && !validateMutatingCsrf(req)) {
      return res.status(403).json({
        authenticated: false,
        error: 'Forbidden. Invalid request origin for cookie session.',
      });
    }

    const payload = verifyAdminToken(token);
    if (!payload) {
      clearAdminSessionCookie(res);
      return res.status(401).json({
        authenticated: false,
        error: 'Unauthorized. Admin session expired or invalid.',
      });
    }

    const record = getRecord();
    req.adminAuth = {
      email: record.email,
      jti: payload.jti,
      mustChangePassword: record.mustChangePassword,
    };
    next();
  };
}

export async function handleAdminLogin(req: Request, res: Response) {
  const ip = req.ip || 'unknown';
  const rate = checkLoginRateLimit(ip);
  if (!rate.allowed) {
    return res.status(429).json({
      error: `Too many failed login attempts. Please retry in ${rate.retryAfterSec || 60} seconds.`,
    });
  }

  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!rawEmail || !rawPassword) {
    return res.status(401).json({ error: 'Invalid email or password. Access Denied.' });
  }

  const record = getRecord();

  // Always execute bcrypt compare to keep response timing consistent across valid/invalid emails
  const passwordValid = await bcrypt.compare(rawPassword, record.passwordHash);
  const emailBuf = Buffer.from(rawEmail.padEnd(128, '\0').slice(0, 128), 'utf8');
  const expectedBuf = Buffer.from(record.email.toLowerCase().padEnd(128, '\0').slice(0, 128), 'utf8');
  const emailValid =
    rawEmail.length === record.email.length && crypto.timingSafeEqual(emailBuf, expectedBuf);

  if (!emailValid || !passwordValid) {
    recordLoginFailure(ip);
    recordAdminAudit(rawEmail || 'unknown', 'LOGIN_DENIED', 'Invalid credentials attempt');
    return res.status(401).json({ error: 'Invalid email or password. Access Denied.' });
  }

  clearLoginFailures(ip);
  const { token } = signAdminToken(record);
  setAdminSessionCookie(res, token);
  recordAdminAudit(
    record.email,
    'LOGIN_SUCCESS',
    record.mustChangePassword ? 'Authenticated (initial password change required)' : 'Authenticated admin session'
  );

  return res.json({
    authenticated: true,
    token,
    admin: {
      email: record.email,
      mustChangePassword: record.mustChangePassword,
      updatedAt: record.updatedAt,
    },
  });
}

export function handleAdminSessionStatus(req: AuthenticatedAdminRequest, res: Response) {
  const record = getRecord();
  return res.json({
    authenticated: true,
    admin: {
      email: record.email,
      mustChangePassword: record.mustChangePassword,
      updatedAt: record.updatedAt,
    },
  });
}

export async function handleAdminChangePassword(req: AuthenticatedAdminRequest, res: Response) {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({
      error: 'New password must be between 8 and 128 characters.',
    });
  }

  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
    return res.status(400).json({
      error: 'New password must include letters and at least one number or special symbol.',
    });
  }

  const record = getRecord();
  const currentValid = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!currentValid) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const sameAsCurrent = await bcrypt.compare(newPassword, record.passwordHash);
  if (sameAsCurrent) {
    return res.status(400).json({
      error: 'New password must be different from your current password.',
    });
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const updatedRecord: AdminAuthRecord = {
    email: record.email,
    passwordHash: newHash,
    mustChangePassword: false,
    tokenVersion: record.tokenVersion + 1,
    updatedAt: new Date().toISOString(),
  };

  cachedRecord = updatedRecord;
  try {
    persistAuthRecord(updatedRecord);
  } catch (err) {
    console.warn('Could not persist updated admin password hash:', err instanceof Error ? err.message : err);
  }

  if (req.adminAuth?.jti) {
    revokedTokenIds.add(req.adminAuth.jti);
  }

  const { token } = signAdminToken(updatedRecord);
  setAdminSessionCookie(res, token);
  recordAdminAudit(updatedRecord.email, 'PASSWORD_CHANGED', 'Admin updated password with bcrypt hash');

  return res.json({
    authenticated: true,
    token,
    admin: {
      email: updatedRecord.email,
      mustChangePassword: false,
      updatedAt: updatedRecord.updatedAt,
    },
  });
}

export function handleAdminLogout(req: AuthenticatedAdminRequest, res: Response) {
  if (req.adminAuth?.jti) {
    revokedTokenIds.add(req.adminAuth.jti);
    recordAdminAudit(req.adminAuth.email, 'LOGOUT', 'Admin session terminated');
  }
  clearAdminSessionCookie(res);
  return res.json({ authenticated: false, loggedOut: true });
}
