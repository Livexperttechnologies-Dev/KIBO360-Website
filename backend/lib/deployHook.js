// ---------------------------------------------------------------------------
// Rebuild a separately hosted website after publishing (Dokploy, Coolify,
// Netlify, Vercel, Render ... deploy hooks).
//
// When the website is its own app (static files built with
// CONTENT_API=https://api.kibo360.in), its HTML - "view page source", link
// previews, sitemap - only changes when it is rebuilt. With SITE_DEPLOY_HOOK
// set, the backend asks for that rebuild after publishing: once, 15 seconds
// after the last publish (several publishes in a row = one rebuild), and at
// most once a minute.
//
//   SITE_DEPLOY_HOOK          the website app's deploy webhook URL
//   SITE_DEPLOY_BRANCH        branch the website app deploys (default "main");
//                             sent as a git "push" event, which Dokploy and
//                             Coolify webhooks check
//   SITE_DEPLOY_HOOK_HEADERS  optional JSON of extra headers, e.g. {"x-api-key":"..."}
//   SITE_DEPLOY_HOOK_BODY     optional JSON body to send instead of the push event
// ---------------------------------------------------------------------------

export function createDeployHook({ url, branch = "main", headers = {}, body = null, delay = 15_000, minGap = 60_000, fetchImpl = fetch, log = console.log }) {
  const status = { pending: false, lastTriggeredAt: null, lastStatus: null, lastError: null };
  let timer = null;
  let lastAt = 0;

  async function fire(reason) {
    status.pending = false;
    lastAt = Date.now();
    const payload = body ?? {
      // shaped like a git push so deploy webhooks that check the branch accept it
      ref: `refs/heads/${branch}`,
      repository: { name: "kibo360", full_name: "kibo360/website" },
      pusher: { name: "kibo360-backend" },
      head_commit: { message: `Content published in Super Admin (${reason})`, timestamp: new Date().toISOString() },
    };
    try {
      const r = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "kibo360-backend", ...(body ? {} : { "X-GitHub-Event": "push" }), ...headers },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
      status.lastTriggeredAt = new Date().toISOString();
      status.lastStatus = r.status;
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`the deploy hook answered ${r.status}${text ? ` (${text.replace(/\s+/g, " ").slice(0, 160)})` : ""}`);
      }
      status.lastError = null;
      log(`[deploy] website rebuild requested (${reason})`);
    } catch (e) {
      status.lastError = e.message;
      console.error(`[deploy] could not request a website rebuild: ${e.message}`);
    }
  }

  /** Ask for a rebuild soon; publishes in quick succession are combined. */
  function schedule(reason) {
    status.pending = true;
    clearTimeout(timer);
    const wait = Math.max(delay, lastAt + minGap - Date.now());
    timer = setTimeout(() => fire(reason), wait);
    timer.unref?.();
  }

  return { schedule, status, close: () => clearTimeout(timer) };
}

/** From the environment, or null when no hook is configured. */
export function deployHookFromEnv(env = process.env) {
  const url = (env.SITE_DEPLOY_HOOK || "").trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) { console.error("[deploy] SITE_DEPLOY_HOOK must be an http(s) URL - ignored"); return null; }
  const json = (name) => {
    if (!env[name]) return null;
    try { return JSON.parse(env[name]); } catch { console.error(`[deploy] ${name} is not valid JSON - ignored`); return null; }
  };
  return createDeployHook({ url, branch: (env.SITE_DEPLOY_BRANCH || "main").trim(), headers: json("SITE_DEPLOY_HOOK_HEADERS") || {}, body: json("SITE_DEPLOY_HOOK_BODY") });
}
