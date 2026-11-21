"use strict";

function hasControls(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function decodeRepeated(value) {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    if (!/%[0-9a-fA-F]{2}/.test(current)) break;
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      return null;
    }
  }
  return current;
}

// Same-site admin path only. Rejects absolute URLs, protocol-relative
// "//host" values, backslashes, control characters, and encoded variants.
function safeAdminNext(value) {
  if (typeof value !== "string") return "";
  const next = value.trim();
  if (!next || next.length > 2048) return "";
  if (!next.startsWith("/") || next.startsWith("//")) return "";
  if (next.includes("\\") || hasControls(next)) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return "";
  const decoded = decodeRepeated(next);
  if (decoded == null) return "";
  if (decoded.startsWith("//") || decoded.includes("\\") || hasControls(decoded)) return "";
  const pathOnly = decoded.split("#")[0].split("?")[0];
  if (pathOnly.includes("//")) return "";
  if (pathOnly !== "/admin" && !pathOnly.startsWith("/admin/")) return "";
  return next;
}

// Referer is an absolute URL. Keep only its path, then apply the same rules,
// so a foreign host cannot ride along in Location.
function safeAdminReferer(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  let path;
  try {
    const url = new URL(value.trim(), "http://localhost");
    path = url.pathname + url.search;
  } catch {
    return "";
  }
  return safeAdminNext(path);
}

module.exports = { safeAdminNext, safeAdminReferer };
