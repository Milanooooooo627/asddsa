const DEFAULT_API_BASE = 'http://127.0.0.1:5000';

const API_BASE_STORAGE_KEY = 'proton.web.apiBase';
const USER_STORAGE_KEY = 'proton.web.user';
const SECRET_STORAGE_KEY = 'proton.web.secret';
const THEME_STORAGE_KEY = 'proton.web.theme';

export interface LicenseKeyRecord {
  keyValue: string;
  label: string;
  grantedAccess: string[];
  assignedEmail: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  expired: boolean;
}

export interface AuthUser {
  email: string;
  role: 'user' | 'admin' | 'owner';
  status: 'active' | 'restricted' | 'blacklisted';
  createdAt: string | null;
  lastLoginAt: string | null;
  uiAccess: string[];
  baseUiAccess: string[];
  activeKeys: LicenseKeyRecord[];
  isOwner: boolean;
}

export interface AdminOverviewResponse {
  actor: AuthUser;
  users: AuthUser[];
  keys: LicenseKeyRecord[];
}

export interface AdminReleaseRecord {
  id: number;
  product: string;
  channel: 'stable' | 'beta';
  version: string;
  notes: string;
  fileName: string;
  fileSize: number | null;
  sha256: string | null;
  requiredAccess: string[];
  active: boolean;
  forceUpdate: boolean;
  createdAt: string | null;
  createdBy: string | null;
  filePath?: string;
}

export interface ReleaseDownloadTokenRecord {
  id: number;
  releaseId: number;
  email: string;
  deviceId: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  downloadedAt: string | null;
  revoked: boolean;
  consumed: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  token?: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type JsonObject = Record<string, unknown>;

function normalizeBase(base: string) {
  return (base || DEFAULT_API_BASE).replace(/\/$/, '');
}

async function requestJson<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(normalizeBase(base) + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init && init.headers ? init.headers : {}),
    },
    ...init,
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in (body as JsonObject)
      ? String((body as JsonObject).message)
      : 'Request failed.';
    throw new ApiError(message, response.status, body);
  }

  return body as T;
}

export function getStoredApiBase() {
  return localStorage.getItem(API_BASE_STORAGE_KEY) || DEFAULT_API_BASE;
}

export function setStoredApiBase(base: string) {
  localStorage.setItem(API_BASE_STORAGE_KEY, normalizeBase(base));
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed || !parsed.email || !parsed.role) {
      return null;
    }
    return {
      email: parsed.email,
      role: parsed.role,
      status: parsed.status || 'active',
      createdAt: parsed.createdAt || null,
      lastLoginAt: parsed.lastLoginAt || null,
      uiAccess: parsed.uiAccess || ['core'],
      baseUiAccess: parsed.baseUiAccess || ['core'],
      activeKeys: parsed.activeKeys || [],
      isOwner: Boolean(parsed.isOwner || parsed.role === 'owner'),
    } as AuthUser;
  } catch (error) {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function getStoredSecret() {
  return localStorage.getItem(SECRET_STORAGE_KEY) || '';
}

export function setStoredSecret(secret: string | null) {
  if (!secret) {
    localStorage.removeItem(SECRET_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SECRET_STORAGE_KEY, secret);
}

export function getStoredTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'abyssal';
}

export function setStoredTheme(theme: string) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function clearStoredSession() {
  setStoredUser(null);
  setStoredSecret(null);
}

export async function authenticate(base: string, email: string, password: string) {
  return requestJson<{ success: boolean; message: string; user: AuthUser }>(base, '/auth', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(base: string, email: string, password: string, licenseKey?: string) {
  return requestJson<{ success: boolean; message: string; user: AuthUser }>(base, '/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      ...(licenseKey ? { licenseKey } : {}),
    }),
  });
}

export async function redeemUserKey(base: string, email: string, password: string, licenseKey: string) {
  return requestJson<{ success: boolean; message: string; user: AuthUser; key: LicenseKeyRecord }>(base, '/keys/redeem', {
    method: 'POST',
    body: JSON.stringify({ email, password, licenseKey }),
  });
}

export async function healthCheck(base: string) {
  return requestJson<{ success: boolean; message: string }>(base, '/health');
}

function withOwnerCredentials(email: string, password: string, payload?: JsonObject) {
  return {
    requesterEmail: email,
    requesterPassword: password,
    ...(payload || {}),
  };
}

export async function loadAdminOverview(base: string, email: string, password: string) {
  return requestJson<AdminOverviewResponse & { success: boolean; message: string }>(base, '/admin/overview', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password)),
  });
}

export async function updateAdminRole(
  base: string,
  email: string,
  password: string,
  targetEmail: string,
  role: string,
  uiAccess: string,
) {
  return requestJson<{ success: boolean; message: string; user: AuthUser }>(base, '/admin/users/role', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { targetEmail, role, uiAccess })),
  });
}

export async function updateAdminStatus(
  base: string,
  email: string,
  password: string,
  targetEmail: string,
  status: string,
) {
  return requestJson<{ success: boolean; message: string; user: AuthUser }>(base, '/admin/users/status', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { targetEmail, status })),
  });
}

export async function deleteAdminUser(base: string, email: string, password: string, targetEmail: string) {
  return requestJson<{ success: boolean; message: string }>(base, '/admin/users/delete', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { targetEmail })),
  });
}

export async function generateAdminKeys(
  base: string,
  email: string,
  password: string,
  payload: JsonObject,
) {
  return requestJson<{ success: boolean; message: string; keys: LicenseKeyRecord[] }>(base, '/admin/keys/generate', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, payload)),
  });
}

export async function assignAdminKey(
  base: string,
  email: string,
  password: string,
  keyValue: string,
  assignEmail: string,
) {
  return requestJson<{ success: boolean; message: string; key: LicenseKeyRecord }>(base, '/admin/keys/assign', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { keyValue, assignEmail })),
  });
}

export async function unassignAdminKey(base: string, email: string, password: string, keyValue: string) {
  return requestJson<{ success: boolean; message: string; key: LicenseKeyRecord }>(base, '/admin/keys/unassign', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { keyValue })),
  });
}

export async function revokeAdminKey(base: string, email: string, password: string, keyValue: string) {
  return requestJson<{ success: boolean; message: string; key: LicenseKeyRecord }>(base, '/admin/keys/revoke', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { keyValue })),
  });
}

export async function deleteAdminKey(base: string, email: string, password: string, keyValue: string) {
  return requestJson<{ success: boolean; message: string }>(base, '/admin/keys/delete', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { keyValue })),
  });
}

export async function createAdminRelease(
  base: string,
  email: string,
  password: string,
  payload: JsonObject,
) {
  return requestJson<{ success: boolean; message: string; release: AdminReleaseRecord }>(base, '/admin/releases', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, payload)),
  });
}

export async function listAdminReleases(base: string, email: string, password: string) {
  return requestJson<{ success: boolean; message: string; releases: AdminReleaseRecord[] }>(base, '/admin/releases/list', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password)),
  });
}

export async function toggleAdminRelease(
  base: string,
  email: string,
  password: string,
  releaseId: number,
  active: boolean,
) {
  return requestJson<{ success: boolean; message: string; release: AdminReleaseRecord }>(base, '/admin/releases/toggle', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { releaseId, active })),
  });
}

export async function listAdminReleaseTokens(base: string, email: string, password: string, limit = 50) {
  return requestJson<{ success: boolean; message: string; tokens: ReleaseDownloadTokenRecord[] }>(base, '/admin/releases/tokens', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { limit })),
  });
}

export async function revokeAdminReleaseToken(base: string, email: string, password: string, tokenId: number) {
  return requestJson<{ success: boolean; message: string; token: ReleaseDownloadTokenRecord }>(base, '/admin/releases/tokens/revoke', {
    method: 'POST',
    body: JSON.stringify(withOwnerCredentials(email, password, { tokenId })),
  });
}