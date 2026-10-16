import { useEffect, useState } from "react";
import { useRouteError } from "react-router-dom";
import { isNewVersionError, reloadForNewVersion, reloadStartedHere } from "../lib/newVersion.js";

// Shown instead of React Router's bare "Unexpected Application Error!" when a
// page fails to render. The usual cause right after a deploy is an old tab
// asking for files that were replaced: then the page reloads by itself.
export default function RouteError() {
  const error = useRouteError();
  const newVersion = isNewVersionError(error);
  const [reloading, setReloading] = useState(newVersion);
  const [slow, setSlow] = useState(false); // reload cancelled (unsaved-changes prompt) or stalled

  useEffect(() => {
    if (!newVersion) return undefined;
    // usually the reload was already started (vite:preloadError); otherwise start it now
    const started = reloadStartedHere() || reloadForNewVersion();
    setReloading(started);
    if (!started) return undefined;
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, [newVersion]);

  const box = { maxWidth: 520, margin: "12vh auto", padding: "32px 28px", fontFamily: "system-ui, sans-serif", color: "#1f1640", textAlign: "center" };
  const btn = { marginTop: 18, padding: "10px 22px", border: 0, borderRadius: 8, background: "#6d28d9", color: "#fff", fontSize: 15, cursor: "pointer" };

  if (newVersion) {
    return (
      <div role="alert" style={box}>
        <h1 style={{ fontSize: 22, margin: "0 0 10px" }}>{reloading ? "Updating to the latest version…" : "A new version was just published"}</h1>
        {!reloading && <p style={{ margin: 0, lineHeight: 1.5 }}>This page was opened before the update. Reload it to continue.</p>}
        {(!reloading || slow) && <button type="button" style={btn} onClick={() => window.location.reload()}>Reload page</button>}
      </div>
    );
  }
  return (
    <div role="alert" style={box}>
      <h1 style={{ fontSize: 22, margin: "0 0 10px" }}>Something went wrong</h1>
      <p style={{ margin: 0, lineHeight: 1.5 }}>Please reload the page. If it keeps happening, let us know.</p>
      {import.meta.env.DEV && error && <pre style={{ textAlign: "left", whiteSpace: "pre-wrap", fontSize: 12, marginTop: 16 }}>{String(error.stack || error.message || error)}</pre>}
      <button type="button" style={btn} onClick={() => window.location.reload()}>Reload page</button>
    </div>
  );
}
