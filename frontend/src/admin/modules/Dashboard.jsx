import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth, useChatSummary } from "../AdminApp.jsx";
import { Alert, Badge, Button, Card, Empty, ErrorBox, I, PageHead, Spinner, fmtBytes, timeAgo, useLoad } from "../ui.jsx";
import { docLabel } from "../editor/panels.jsx";
import { PAGES } from "../../cms/pageMeta.js";

// ---------------------------------------------------------------------------
// Dashboard: website health at a glance.
// ---------------------------------------------------------------------------

const ACTION_LABEL = {
  "content.publish": "published", "content.draft_saved": "edited", "content.schedule": "scheduled", "content.schedule_published": "auto-published",
  "content.page_created": "created page", "content.page_deleted": "deleted page", "content.restore_to_draft": "restored a revision of", "content.unpublish": "unpublished",
  "content.draft_discarded": "discarded draft of", "media.upload": "uploaded", "media.replace": "replaced", "media.trash": "trashed", "media.update": "updated media",
  "lead.update": "updated lead", "lead.delete": "deleted lead", "user.create": "added team member", "user.update": "updated team member", "role.update": "changed role",
  "settings.update": "changed settings", "seo.scan": "ran SEO check",
};
export const actionText = (a) => ACTION_LABEL[a] || a.replace(/[._]/g, " ");

function Stat({ to, icon, label, value, sub, tone }) {
  const inner = (
    <>
      <div className="a-stat-top"><span>{label}</span><I n={icon} size={16} /></div>
      <strong style={tone ? { color: tone } : undefined}>{value}</strong>
      {sub && <small>{sub}</small>}
    </>
  );
  return to ? <Link to={to} className="a-stat">{inner}</Link> : <div className="a-stat">{inner}</div>;
}

export default function Dashboard() {
  const { me, can } = useAuth();
  const chat = useChatSummary();
  const [d, { loading, error, reload }] = useLoad(() => api("/api/admin/dashboard"), []);
  if (loading && !d) return <div className="a-page"><Spinner /></div>;
  if (error) return <div className="a-page"><ErrorBox error={error} onRetry={reload} /></div>;
  const max = Math.max(1, ...(d.submissions?.daily || []).map((x) => x.count));
  const hour = new Date().getHours();
  return (
    <div className="a-page">
      <PageHead
        title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${me.name.split(" ")[0]}`}
        subtitle={d.lastPublishedAt ? `Website version ${d.version} · last published ${timeAgo(d.lastPublishedAt)}` : "Nothing has been published from Super Admin yet - the website shows its original content."}
        actions={
          <>
            <a className="a-btn" href="/" target="_blank" rel="noopener noreferrer"><I n="external" size={15} /> View website</a>
            {can("pages.view") && <Link className="a-btn a-btn-primary" to="/admin/editor?path=/"><I n="edit" size={15} /> Edit homepage</Link>}
          </>
        }
      />
      {d.storage && !d.storage.persistent && (
        <Alert tone="error"><strong>Your content will be erased on the next deploy.</strong> Drafts, published pages, SEO settings, images, leads and accounts are stored inside the app container ({d.storage.dataDir}), and every deploy starts a new, empty one. Ask your developer to fix this before the next deploy, then Deploy: {d.storage.fix}</Alert>
      )}
      {d.storage?.persistent && d.storage.database && (
        <Alert tone="warn">Content is kept across deploys, but it is stored inside a database's own volume ({d.storage.dataDir}), so it depends on that database and is not in its backups. Ask your developer to give the backend a new volume of its own and move DATA_DIR to it.</Alert>
      )}
      {d.storage?.persistent && d.storage.insideApp && !d.storage.inContainer && (
        <Alert tone="warn">Content is stored inside the app folder ({d.storage.dataDir}). A deploy that replaces the whole app folder deletes all drafts, pages, images and leads - your developer should keep this folder or move it with DATA_DIR.</Alert>
      )}
      {d.deployHook?.lastError && (
        <Alert tone="error">The website could not be rebuilt after the last publish, so page source and link previews may still show old text: {d.deployHook.lastError}. Ask your developer to check SITE_DEPLOY_HOOK.</Alert>
      )}
      {d.staticSite?.lastError && (
        <Alert tone="error">The website files could not be updated after the last publish, so page source and link previews may still show old text: {d.staticSite.lastError}. Ask your developer to check the server (STATIC_SITE_DIR).</Alert>
      )}
      <div className="a-stats">
        <Stat to="/admin/pages" icon="pages" label="Live pages" value={PAGES.length + (d.content.customPublished || 0)} sub={`${PAGES.length} main pages · ${d.content.customPublished || 0} landing page(s)`} />
        <Stat to="/admin/pages" icon="edit" label="Unpublished drafts" value={d.content.drafts.length} sub={d.content.drafts.length ? "waiting to go live" : "everything is live"} tone={d.content.drafts.length ? "var(--a-amber)" : undefined} />
        {d.leads && <Stat to="/admin/leads" icon="users" label="New leads" value={d.leads.new} sub={`${d.leads.last7d} in the last 7 days · ${d.leads.total} total`} />}
        {d.submissions && <Stat to="/admin/submissions" icon="inbox" label="Form submissions" value={d.submissions.last7d} sub={`last 7 days · ${d.submissions.total} total`} />}
        {can("seo.view") && <Stat to="/admin/seo" icon="globe" label="SEO issues" value={d.seo ? d.seo.totals.errors + d.seo.totals.warnings : "–"} sub={d.seo ? `avg score ${d.seo.totals.avgScore ?? "–"} · checked ${timeAgo(d.seo.at)}` : "run an SEO check"} tone={d.seo?.totals.errors ? "var(--a-red)" : undefined} />}
        {d.media && <Stat to="/admin/media" icon="image" label="Media files" value={d.media.count} sub={fmtBytes(d.media.bytes)} />}
        {d.chat && <Stat to="/admin/chat" icon="chat" label="Visitors online" value={chat.summary?.presence ?? d.chat.online} sub={`${chat.summary?.unread ?? d.chat.unread} unread chat message(s)`} tone={(chat.summary?.unread ?? d.chat.unread) ? "var(--a-pink)" : undefined} />}
      </div>

      <div className="a-grid-2">
        <div>
          {d.submissions && (
            <Card title="Form submissions" subtitle="Last 14 days">
              <div className="a-bars" aria-label="Submissions per day">
                {d.submissions.daily.map((x) => <div key={x.day} style={{ height: `${(x.count / max) * 100}%` }} data-tip={`${x.day.slice(5)}: ${x.count}`} />)}
              </div>
              {Object.keys(d.submissions.byForm).length > 0 && (
                <div className="a-row" style={{ marginTop: 10 }}>
                  {Object.entries(d.submissions.byForm).map(([f, n]) => <Badge key={f} tone="violet">{f}: {n}</Badge>)}
                  <span className="a-small a-muted">last 30 days</span>
                </div>
              )}
            </Card>
          )}
          <Card title="Drafts waiting to be published" actions={<Link className="a-btn a-btn-sm" to="/admin/pages">All pages</Link>}>
            {!d.content.drafts.length ? <Empty icon="check" text="No unpublished changes." /> : (
              <div className="a-list">
                {d.content.drafts.map((x) => (
                  <div key={x.docId} className="a-list-row">
                    <span className="a-dot amber" />
                    <div className="a-grow"><strong>{x.label || docLabel(x.docId)}</strong><div className="a-small a-muted">edited {timeAgo(x.updatedAt)}{x.updatedBy ? ` by ${x.updatedBy}` : ""}</div></div>
                    {x.docId.startsWith("page:") && <Link className="a-btn a-btn-sm" to={`/admin/pages`}>Review</Link>}
                  </div>
                ))}
              </div>
            )}
            {d.schedules?.length > 0 && (
              <>
                <div className="a-section-title">Scheduled</div>
                {d.schedules.map((s) => <div key={s.id} className="a-list-row"><I n="clock" size={14} /><div className="a-grow">{s.docIds.map((id) => docLabel(id)).join(", ")}</div><span className="a-small">{new Date(s.at).toLocaleString()}</span></div>)}
              </>
            )}
          </Card>
        </div>
        <div>
          {d.leads && (
            <Card title="Latest leads" actions={<Link className="a-btn a-btn-sm" to="/admin/leads">All leads</Link>}>
              {!d.leads.recent.length ? <Empty icon="users" text="Leads from website forms and chat appear here." /> : (
                <div className="a-list">
                  {d.leads.recent.map((l) => (
                    <div key={l.id} className="a-list-row">
                      <span className={`a-dot ${l.status === "new" ? "violet" : l.status === "won" ? "green" : ""}`} />
                      <div className="a-grow"><strong>{l.name || l.email}</strong><div className="a-small a-muted">{l.email} · {l.source || "direct"}</div></div>
                      <span className="a-small a-muted">{timeAgo(l.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
          {can("audit.view") && (
            <Card title="Recent activity" actions={<Link className="a-btn a-btn-sm" to="/admin/history">Change history</Link>}>
              {!d.recent.length ? <Empty icon="history" text="No activity yet." /> : (
                <div className="a-list">
                  {d.recent.slice(0, 10).map((e, i) => (
                    <div key={i} className="a-list-row a-small">
                      <span className="a-avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{(e.userName || "?").slice(0, 1)}</span>
                      <div className="a-grow"><strong>{e.userName || "System"}</strong> {actionText(e.action)} <span className="a-muted">{e.target?.startsWith?.("page:") || ["site", "seo", "forms"].includes(e.target) ? docLabel(e.target) : e.target}</span></div>
                      <span className="a-muted">{timeAgo(e.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
          <Card title="Quick actions">
            <div className="a-row">
              {can("pages.create") && <Link className="a-btn a-btn-sm" to="/admin/pages"><I n="plus" size={14} /> New landing page</Link>}
              {can("media.upload") && <Link className="a-btn a-btn-sm" to="/admin/media"><I n="upload" size={14} /> Upload media</Link>}
              {can("seo.view") && <Link className="a-btn a-btn-sm" to="/admin/seo"><I n="search" size={14} /> Run SEO check</Link>}
              {can("site.edit") && <Link className="a-btn a-btn-sm" to="/admin/site/banners"><I n="megaphone" size={14} /> Announcement bar</Link>}
              {can("forms.edit") && <Link className="a-btn a-btn-sm" to="/admin/forms"><I n="form" size={14} /> Edit forms</Link>}
            </div>
            {!d.siteServer && <p className="a-hint" style={{ marginTop: 10 }}>Published changes reach visitors within seconds (the site checks for a new version on every visit). Search engines see them after the next site build, or instantly when the site is served by the Node server.</p>}
          </Card>
        </div>
      </div>
      <Button variant="ghost" size="sm" icon="refresh" onClick={reload} style={{ marginTop: 10 }}>Refresh</Button>
    </div>
  );
}
