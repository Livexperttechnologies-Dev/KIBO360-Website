import { API_BASE } from "../lib/apiBase.js";

// ---------------------------------------------------------------------------
// Super Admin API client. The session token lives in sessionStorage (per
// tab, gone when the browser closes); the server keeps only its hash.
// ---------------------------------------------------------------------------

const TOKEN_KEY = "kibo360-admin-token";

let token = (() => { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } })();
const expiredListeners = new Set();
const pwListeners = new Set();

export const getToken = () => token;
export function setToken(t) {
  token = t || "";
  try { if (token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}
export function onSessionExpired(fn) { expiredListeners.add(fn); return () => expiredListeners.delete(fn); }
/** The server wants a new password before anything else (e.g. after a reset). */
export function onPasswordChangeRequired(fn) { pwListeners.add(fn); return () => pwListeners.delete(fn); }

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

function expired() {
  setToken("");
  for (const fn of expiredListeners) { try { fn(); } catch { /* ignore */ } }
}

export async function api(path, { method = "GET", body, signal, keepalive } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      keepalive,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError("Can't reach the server - check your connection", 0, null);
  }
  const isJson = /json/i.test(res.headers.get("content-type") || "");
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (res.ok && !isJson) {
    // e.g. a web page served where the API was expected - never "succeed" silently
    throw new ApiError("The server sent an unexpected answer - the API address may be wrong or the backend is not running", res.status, null);
  }
  if (res.status === 401 && token && !path.endsWith("/login")) {
    expired();
    throw new ApiError("Your session has expired - please sign in again", 401, data);
  }
  if (res.status === 403 && data.code === "PASSWORD_CHANGE_REQUIRED") {
    for (const fn of pwListeners) { try { fn(); } catch { /* ignore */ } }
  }
  if (!res.ok || data.ok === false) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}

/** Multipart upload with progress (XHR - fetch has no upload progress). */
export function upload(path, file, fields = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v != null && v !== "") fd.append(k, Array.isArray(v) ? v.join(",") : String(v));
    fd.append("file", file, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch { /* not json */ }
      if (xhr.status === 401) { expired(); return reject(new ApiError("Your session has expired", 401, data)); }
      if (xhr.status === 403 && data.code === "PASSWORD_CHANGE_REQUIRED") for (const fn of pwListeners) { try { fn(); } catch { /* ignore */ } }
      if (xhr.status >= 400 || data.ok === false) return reject(new ApiError(data.error || `Upload failed (${xhr.status})`, xhr.status, data));
      resolve(data);
    };
    xhr.onerror = () => reject(new ApiError("Upload failed - check your connection", 0, null));
    xhr.send(fd);
  });
}

/** Authenticated file download (CSV exports). */
export async function download(path, fallbackName) {
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(d.error || `Download failed (${res.status})`, res.status, d);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Absolute URL for media returned by the API (relative /uploads/...). */
export const mediaUrl = (src) => (typeof src === "string" && src.startsWith("/uploads/") ? `${API_BASE}${src}` : src || "");
