// ---------------------------------------------------------------------------
// A deploy replaces the site's JavaScript files (their names change with every
// build). A tab opened BEFORE the deploy still runs the old code, and the next
// screen it loads (e.g. Super Admin -> Pages) asks for an old file that no
// longer exists: "Failed to fetch dynamically imported module". Reloading the
// page picks up the new files - so that is done automatically, once. If the
// file still fails right after a reload (a real, lasting problem), the error
// is shown instead of reloading forever.
// ---------------------------------------------------------------------------

const KEY = "kibo-new-version-reload";
const GUARD_MS = 30_000;

/** Did loading a part of the site fail because its file is gone / not JavaScript? */
export function isNewVersionError(err) {
  const msg = String((err && (err.message || err.reason?.message)) || err || "");
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed|not a valid JavaScript MIME type/i.test(msg);
}

/** Reload to get the new version - unless that was just tried. Returns true when reloading. */
export function reloadForNewVersion() {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // no storage = no loop guard: let the person reload
  }
  window.location.reload();
  return true;
}

/** Has THIS page already started that reload? (a timestamp from before it loaded = an earlier page) */
export function reloadStartedHere() {
  try {
    return Number(sessionStorage.getItem(KEY) || 0) >= performance.timeOrigin;
  } catch {
    return false;
  }
}

/** Browser entry: reload when Vite reports that a part of the site could not be loaded. */
export function watchForNewVersion() {
  window.addEventListener("vite:preloadError", (e) => {
    // runs before React sees the error; the error screen then shows "Updating…"
    if (isNewVersionError(e.payload)) reloadForNewVersion();
  });
}
