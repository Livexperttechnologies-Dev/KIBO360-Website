import { useState } from "react";
import { useAuth } from "./AdminApp.jsx";
import { useContent, saveLabel } from "./store.jsx";
import { Badge, Button, I, timeAgo, useConfirm, useNow, useToast } from "./ui.jsx";
import { describeChanges } from "./docOps.js";
import { PublishDialog, PreviewDialog, docLabel } from "./editor/panels.jsx";

/**
 * Sticky draft/publish bar for form-based modules (SEO, header & footer,
 * forms...). Shows whether there are unpublished changes and offers
 * Preview, Discard and Publish.
 */
export default function DocBar({ docIds, previewPath = "/", note }) {
  const store = useContent();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [dialog, setDialog] = useState(null);
  useNow(10000);
  if (!store?.loaded) return null;
  const dirty = docIds.filter((id) => store.isDirty(id));
  const editPerm = (id) => (id.startsWith("page:") ? "pages.edit" : { site: "site.edit", seo: "seo.edit", forms: "forms.edit" }[id]);
  const discardable = dirty.filter((id) => can(editPerm(id)));
  const changes = dirty.reduce((n, id) => n + describeChanges(id, store.published[id] || {}, store.working[id] || {}).length, 0);
  const canPublish = can(["site.publish", "seo.publish", "forms.publish", "pages.publish"]);
  const st = store.status[docIds[0]];
  return (
    <div className="a-docbar">
      <span className={`ed-status ${store.save.state === "error" ? "error" : ""}`} title={store.save.error?.message || ""}>
        {store.save.state === "saving" ? <span className="a-spin" /> : <I n={store.save.state === "error" ? "alert" : "check"} size={14} />}
        {saveLabel(store.save)}{store.save.state === "saved" && store.save.at ? ` · ${timeAgo(store.save.at)}` : ""}
      </span>
      {dirty.length ? <Badge tone="amber">{changes} unpublished change{changes === 1 ? "" : "s"}</Badge> : <Badge tone="green">Live</Badge>}
      {st?.publishedAt && <span className="a-small a-muted">Published {timeAgo(st.publishedAt)}{st.publishedBy?.name ? ` by ${st.publishedBy.name}` : ""}</span>}
      {note && <span className="a-small a-muted">{note}</span>}
      <span className="a-spacer" />
      <Button size="sm" icon="undo" disabled={!store.hist.undo || !store.canUndo(docIds)} onClick={() => { const e = store.undo(docIds); if (e) toast(`Undone: ${e.label}`, { duration: 1500 }); }}>Undo</Button>
      <Button size="sm" icon="eye" onClick={async () => { await store.flush(); setDialog("preview"); }}>Preview</Button>
      {discardable.length > 0 && (
        <Button size="sm" variant="danger" onClick={async () => {
          const ok = await confirm({ title: "Discard unpublished changes?", message: `This throws away the draft of ${discardable.map((id) => docLabel(id, store)).join(" and ")} and goes back to the live version.`, confirmLabel: "Discard", danger: true });
          if (!ok) return;
          try { for (const id of discardable) await store.discard(id); toast("Draft discarded"); } catch (e) { toast(e.message, { tone: "error" }); }
        }}>Discard</Button>
      )}
      {canPublish && <Button size="sm" variant="primary" icon="send" disabled={!dirty.length} onClick={async () => { await store.flush(); setDialog("publish"); }}>Publish</Button>}
      {dialog === "publish" && <PublishDialog ctx={{ store, can, pageDocId: null, path: previewPath }} docIds={dirty} onClose={() => setDialog(null)} />}
      {dialog === "preview" && <PreviewDialog path={previewPath} label={docIds.map((id) => docLabel(id, store)).join(", ")} onClose={() => setDialog(null)} />}
    </div>
  );
}
