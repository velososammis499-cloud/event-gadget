import type { DeviceInfo } from '../types';

const VISITOR_COOKIE = '_eg_visitor';
const VISITOR_TTL_DAYS = 30;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function generateVisitorId(): string {
  return 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

export class SessionContext {
  private _userId?: string;
  private _visitorId: string;
  private _isNewVisitor: boolean;
  private cachedDevice: DeviceInfo;

  constructor() {
    this.cachedDevice = {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language,
    };

    // Anonymous visitor fallback — gives "new vs returning" data even when
    // the host page never calls setUserId. Cookie scope is intentionally
    // per-origin (path=/), 30-day rolling expiry.
    const existing = readCookie(VISITOR_COOKIE);
    if (existing) {
      this._visitorId = existing;
      this._isNewVisitor = false;
      // refresh expiry on every page load
      writeCookie(VISITOR_COOKIE, existing, VISITOR_TTL_DAYS);
    } else {
      this._visitorId = generateVisitorId();
      this._isNewVisitor = true;
      writeCookie(VISITOR_COOKIE, this._visitorId, VISITOR_TTL_DAYS);
    }
  }

  /** Business-supplied user ID takes precedence; otherwise fall back to the
   *  anonymous visitor cookie so downstream "users / new vs returning" analytics
   *  always have something to count. */
  get userId(): string | undefined {
    return this._userId ?? this._visitorId;
  }

  get visitorId(): string {
    return this._visitorId;
  }

  get isNewVisitor(): boolean {
    return this._isNewVisitor;
  }

  setUserId(id: string): void {
    this._userId = id;
  }

  getDeviceInfo(): DeviceInfo {
    return this.cachedDevice;
  }
}
