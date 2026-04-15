"use client";

const AUTH_COOKIE_NAME = "glazia_auth";
const LEGACY_STORAGE_KEY = "authToken";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 120;

function isBrowser() {
  return typeof window !== "undefined";
}

function getSharedCookieDomain(hostname: string) {
  if (!hostname || hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return undefined;
  }

  if (hostname === "glazia.in" || hostname.endsWith(".glazia.in")) {
    return ".glazia.in";
  }

  return undefined;
}

function readCookie(name: string) {
  if (!isBrowser()) return null;

  const encodedName = `${name}=`;
  const cookies = document.cookie.split(";");

  for (const entry of cookies) {
    const trimmed = entry.trim();
    if (trimmed.startsWith(encodedName)) {
      return decodeURIComponent(trimmed.slice(encodedName.length));
    }
  }

  return null;
}

export function setAuthToken(token: string, maxAgeSeconds: number = DEFAULT_MAX_AGE_SECONDS) {
  if (!isBrowser()) return;

  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "SameSite=Lax",
  ];

  const domain = getSharedCookieDomain(window.location.hostname);
  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  if (window.location.protocol === "https:") {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function clearAuthToken() {
  if (!isBrowser()) return;

  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  const expires = "expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
  const domain = getSharedCookieDomain(window.location.hostname);

  document.cookie = `${AUTH_COOKIE_NAME}=; ${expires}${secureFlag}`;
  document.cookie = `authToken=; ${expires}${secureFlag}`;

  if (domain) {
    document.cookie = `${AUTH_COOKIE_NAME}=; ${expires}; domain=${domain}${secureFlag}`;
    document.cookie = `authToken=; ${expires}; domain=${domain}${secureFlag}`;
  }

  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function getAuthToken() {
  if (!isBrowser()) return null;

  const cookieToken = readCookie(AUTH_COOKIE_NAME) || readCookie("authToken");
  if (cookieToken) {
    return cookieToken;
  }

  const legacyToken = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyToken) {
    setAuthToken(legacyToken);
    return legacyToken;
  }

  return null;
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}
