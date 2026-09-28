// ---------------------------------------------------------------------------
// Append-only audit trail (JSON lines). Every mutating admin action is
// recorded with who, what, when and from where. The file is never rewritten
// by the application, so history can't be silently edited through the API.
// ---------------------------------------------------------------------------

const FILE = "audit.jsonl";

export function createAudit({ store }) {
  function log(req, { action, target = "", details = null, actor = null }) {
    const u = actor || req?.user || {};
    try {
      store.appendLine(FILE, {
        at: new Date().toISOString(),
        action,
        target: String(target).slice(0, 300),
        userId: u.id || null,
        userEmail: u.email || null,
        userName: u.name || null,
        ip: req?.ip || null,
        details: details && typeof details === "object" ? truncate(details) : details,
      });
    } catch (e) {
      console.error("[audit] write failed:", e.message);
    }
  }

  function query({ limit = 200, action, userId, target, since } = {}) {
    const sinceTs = since ? Date.parse(since) : 0;
    return store.readLines(FILE, {
      limit: Math.min(Math.max(Number(limit) || 200, 1), 2000),
      filter: (e) =>
        (!action || e.action === action || e.action.startsWith(`${action}.`)) &&
        (!userId || e.userId === userId) &&
        (!target || String(e.target).toLowerCase().includes(String(target).toLowerCase())) &&
        (!sinceTs || Date.parse(e.at) >= sinceTs),
    });
  }

  return { log, query };
}

function truncate(obj, depth = 0) {
  if (depth > 3) return "[...]";
  if (Array.isArray(obj)) return obj.slice(0, 50).map((v) => truncate(v, depth + 1));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj).slice(0, 50)) out[k] = truncate(v, depth + 1);
    return out;
  }
  if (typeof obj === "string") return obj.length > 500 ? obj.slice(0, 500) + "…" : obj;
  return obj;
}
