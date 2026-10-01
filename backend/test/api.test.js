import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { createApp } from "../app.js";

// End-to-end API tests against an isolated temp data directory.
// Run: npm test   (from backend/)

let base, srv, close, dataDir, svc;
const ADMIN = { email: "livexperttechnologies@gmail.com", password: "Kibo360@Admin" };

async function call(p, { method = "GET", body, token, raw, headers = {} } = {}) {
  const r = await fetch(base + p, {
    method,
    headers: { ...(raw ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json, headers: r.headers };
}
const login = async (email, password) => (await call("/api/admin/login", { method: "POST", body: { email, password } })).body.token;
async function upload(token, buf, name, extra = {}, id = null) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  fd.append("file", new Blob([buf]), name);
  const r = await fetch(`${base}/api/admin/media${id ? `/${id}/replace` : ""}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  return { status: r.status, body: await r.json() };
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kibo360-test-"));
  // Seed a LEGACY users.json to prove the migration + hash upgrade path.
  const legacySha = crypto.createHash("sha256").update("kibo360::" + ADMIN.password).digest("hex");
  fs.writeFileSync(path.join(dataDir, "users.json"), JSON.stringify([
    { id: "legacy-1", email: ADMIN.email, name: "Super Admin", passwordHash: legacySha, role: "superadmin", permissions: { leads: true }, createdAt: "2026-01-01T00:00:00Z" },
    { id: "legacy-2", email: "support@example.com", name: "Old Support", passwordHash: crypto.createHash("sha256").update("kibo360::Support12345").digest("hex"), role: "admin", permissions: { chats: true, leads: true }, createdAt: "2026-01-01T00:00:00Z" },
  ]));
  fs.writeFileSync(path.join(dataDir, "submissions.json"), JSON.stringify([
    { id: "old-1", receivedAt: "2026-08-01T10:00:00Z", status: "contacted", name: "Legacy Lead", email: "legacy@example.com", phone: "", organization: "", product: "HMS", message: "hi" },
  ]));
  const made = await createApp({ dataDir });
  close = made.close;
  svc = made.services;
  await new Promise((res) => { srv = made.app.listen(0, res); });
  base = `http://localhost:${srv.address().port}`;
});
after(() => { srv?.close(); close?.(); fs.rmSync(dataDir, { recursive: true, force: true }); });

describe("auth & migration", () => {
  test("legacy SHA-256 password logs in and is upgraded to scrypt", async () => {
    const r = await call("/api/admin/login", { method: "POST", body: ADMIN });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.roleId, "superadmin");
    const users = JSON.parse(fs.readFileSync(path.join(dataDir, "users.json"), "utf8"));
    assert.match(users.find((u) => u.email === ADMIN.email).passwordHash, /^scrypt\$/);
    // the old server's public default has to be replaced straight away
    assert.equal(r.body.user.mustChangePassword, true);
    assert.equal((await call("/api/admin/content/docs", { token: r.body.token })).body.code, "PASSWORD_CHANGE_REQUIRED");
    const reuse = await call("/api/admin/password", { method: "POST", token: r.body.token, body: { current: ADMIN.password, next: ADMIN.password } });
    assert.equal(reuse.status, 400);
    const ch = await call("/api/admin/password", { method: "POST", token: r.body.token, body: { current: ADMIN.password, next: "OwnerChosen12345" } });
    assert.equal(ch.status, 200, JSON.stringify(ch.body));
    assert.equal(ch.body.user.mustChangePassword, false);
    ADMIN.password = "OwnerChosen12345";
    assert.equal((await call("/api/admin/content/docs", { token: r.body.token })).status, 200);
  });
  test("a legacy account with its own password is not forced to change it", async () => {
    const r = await call("/api/admin/login", { method: "POST", body: { email: "support@example.com", password: "Support12345" } });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.mustChangePassword, false);
  });
  test("legacy per-user flags migrate to role + extra permissions", async () => {
    const t = await login("support@example.com", "Support12345");
    const me = await call("/api/admin/me", { token: t });
    assert.equal(me.body.user.roleId, "viewer");
    assert.ok(me.body.user.permissions.includes("chats"));
    assert.ok(me.body.user.permissions.includes("leads.edit"));
    assert.ok(!me.body.user.permissions.includes("pages.edit"));
  });
  test("wrong password is rejected and no token is issued", async () => {
    const r = await call("/api/admin/login", { method: "POST", body: { ...ADMIN, password: "nope" } });
    assert.equal(r.status, 401);
    assert.equal(r.body.token, undefined);
  });
  test("sessions are stored hashed, never as raw tokens", async () => {
    const t = await login(ADMIN.email, ADMIN.password);
    const raw = fs.readFileSync(path.join(dataDir, "sessions.json"), "utf8");
    assert.ok(!raw.includes(t));
  });
  test("logout revokes the token", async () => {
    const t = await login(ADMIN.email, ADMIN.password);
    assert.equal((await call("/api/admin/logout", { method: "POST", token: t })).status, 200);
    assert.equal((await call("/api/admin/me", { token: t })).status, 401);
  });
  test("admin endpoints refuse anonymous callers", async () => {
    for (const p of ["/api/admin/dashboard", "/api/admin/leads", "/api/admin/media", "/api/admin/content/docs", "/api/admin/users", "/api/admin/audit"]) {
      assert.equal((await call(p)).status, 401, p);
    }
  });
  test("weak passwords are refused", async () => {
    const t = await login(ADMIN.email, ADMIN.password);
    const r = await call("/api/admin/users", { method: "POST", token: t, body: { email: "weak@example.com", password: "short", roleId: "viewer" } });
    assert.equal(r.status, 400);
  });
});

describe("RBAC: separate edit and publish rights", () => {
  let superT, contentT, seoT, viewerT;
  before(async () => {
    superT = await login(ADMIN.email, ADMIN.password);
    for (const [email, roleId] of [["content@example.com", "content_manager"], ["seo@example.com", "seo_manager"], ["viewer@example.com", "viewer"]]) {
      const r = await call("/api/admin/users", { method: "POST", token: superT, body: { email, password: "Password12345", roleId } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    // New accounts must replace their temporary password before anything else.
    const fresh = async (email) => {
      const t = await login(email, "Password12345");
      assert.equal((await call("/api/admin/content/docs", { token: t })).body.code, "PASSWORD_CHANGE_REQUIRED");
      assert.equal((await call("/api/admin/password", { method: "POST", token: t, body: { current: "Password12345", next: "Chosen12345678" } })).status, 200);
      return t;
    };
    contentT = await fresh("content@example.com");
    seoT = await fresh("seo@example.com");
    viewerT = await fresh("viewer@example.com");
  });
  test("nobody can be given the super admin role", async () => {
    const r = await call("/api/admin/users", { method: "POST", token: superT, body: { email: "x@example.com", password: "Password12345", roleId: "superadmin" } });
    assert.equal(r.status, 400);
  });
  test("content manager can edit a draft but NOT publish it", async () => {
    const e = await call("/api/admin/content/doc/page:home", { method: "PATCH", token: contentT, body: { fields: { "hero.title": "Draft title" } } });
    assert.equal(e.status, 200);
    const p = await call("/api/admin/content/publish", { method: "POST", token: contentT, body: { docIds: ["page:home"] } });
    assert.equal(p.status, 403);
    const live = await call("/api/content/published");
    assert.equal(live.body.docs["page:home"], undefined, "draft must not be live");
  });
  test("SEO manager may edit page SEO but not page content", async () => {
    assert.equal((await call("/api/admin/content/doc/page:about", { method: "PATCH", token: seoT, body: { seo: { title: "About KIBO360" } } })).status, 200);
    assert.equal((await call("/api/admin/content/doc/page:about", { method: "PATCH", token: seoT, body: { fields: { "x.y": "nope" } } })).status, 403);
  });
  test("SEO manager may publish an SEO-only page change", async () => {
    const r = await call("/api/admin/content/publish", { method: "POST", token: seoT, body: { docIds: ["page:about"] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });
  test("viewer cannot edit anything", async () => {
    assert.equal((await call("/api/admin/content/doc/page:home", { method: "PATCH", token: viewerT, body: { fields: { a: "b" } } })).status, 403);
    assert.equal((await call("/api/admin/media", { method: "POST", token: viewerT, body: {} })).status, 403);
  });
  test("custom roles can be created and enforced", async () => {
    const r = await call("/api/admin/roles", { method: "POST", token: superT, body: { name: "Banner Editor", permissions: ["site.edit", "dashboard.view", "bogus.perm"] } });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.role.permissions.sort(), ["dashboard.view", "site.edit"]);
  });
});

describe("content: draft -> publish", () => {
  let t;
  before(async () => { t = await login(ADMIN.email, ADMIN.password); });

  test("rich text is sanitized on save", async () => {
    const r = await call("/api/admin/content/doc/page:home", { method: "PATCH", token: t, body: { fields: { "about.text": { t: "html", html: '<b>Hi</b><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><script>bad()</script>' } } } });
    assert.equal(r.status, 200);
    const html = r.body.data.fields["about.text"].html;
    assert.ok(!/onerror|javascript:|<script|<img/i.test(html), html);
    assert.ok(html.includes("<strong>Hi</strong>"));
  });
  test("unsafe button links are neutralised", async () => {
    const r = await call("/api/admin/content/doc/page:home", { method: "PATCH", token: t, body: { fields: { "hero.cta": { t: "btn", label: "Go", action: "link", href: "javascript:alert(1)" } } } });
    assert.equal(r.body.data.fields["hero.cta"].href, undefined);
  });
  test("draft is dirty, publish makes it live and bumps the version", async () => {
    const before = (await call("/api/content/version")).body.version;
    const st = await call("/api/admin/content/doc/page:home", { token: t });
    assert.equal(st.body.status.dirty, true);
    const p = await call("/api/admin/content/publish", { method: "POST", token: t, body: { docIds: ["page:home"], note: "first" } });
    assert.equal(p.status, 200);
    const live = await call("/api/content/published");
    assert.equal(live.body.docs["page:home"].fields["hero.title"], "Draft title");
    assert.ok(live.body.version > before);
    const st2 = await call("/api/admin/content/doc/page:home", { token: t });
    assert.equal(st2.body.status.dirty, false);
  });
  test("revisions are recorded and can be restored to draft (not live)", async () => {
    await call("/api/admin/content/doc/page:home", { method: "PATCH", token: t, body: { fields: { "hero.title": "Second" } } });
    await call("/api/admin/content/publish", { method: "POST", token: t, body: { docIds: ["page:home"] } });
    const revs = await call("/api/admin/content/doc/page:home/revisions", { token: t });
    assert.ok(revs.body.revisions.length >= 2);
    const first = revs.body.revisions[revs.body.revisions.length - 1];
    assert.equal((await call("/api/admin/content/doc/page:home/restore", { method: "POST", token: t, body: { rev: first.rev } })).status, 200);
    const doc = await call("/api/admin/content/doc/page:home", { token: t });
    assert.equal(doc.body.data.fields["hero.title"], "Draft title");
    assert.equal(doc.body.published.fields["hero.title"], "Second", "restore must not change live");
  });
  test("discard returns the draft to the live version", async () => {
    await call("/api/admin/content/doc/page:home/discard", { method: "POST", token: t });
    const doc = await call("/api/admin/content/doc/page:home", { token: t });
    assert.equal(doc.body.data.fields["hero.title"], "Second");
    assert.equal(doc.body.status.dirty, false);
  });
  test("a failed publish (invalid schema) leaves live content untouched", async () => {
    const liveBefore = (await call("/api/content/published")).body;
    await call("/api/admin/content/doc/page:home", { method: "PATCH", token: t, body: { fields: { "hero.title": "Should not ship" }, seo: { schema: { custom: "{not json" } } } });
    const p = await call("/api/admin/content/publish", { method: "POST", token: t, body: { docIds: ["page:home"] } });
    assert.equal(p.status, 400);
    const liveAfter = (await call("/api/content/published")).body;
    assert.equal(liveAfter.version, liveBefore.version);
    assert.equal(liveAfter.docs["page:home"].fields["hero.title"], "Second");
    await call("/api/admin/content/doc/page:home/discard", { method: "POST", token: t });
  });
  test("multi-document publish is all-or-nothing", async () => {
    const liveBefore = (await call("/api/content/published")).body;
    await call("/api/admin/content/doc/page:contact", { method: "PATCH", token: t, body: { fields: { "hero.title": "Contact v2" } } });
    await call("/api/admin/content/doc/seo", { method: "PATCH", token: t, body: { redirects: [{ from: "/a", to: "/b" }, { from: "/b", to: "/a" }] } });
    const p = await call("/api/admin/content/publish", { method: "POST", token: t, body: { docIds: ["page:contact", "seo"] } });
    assert.equal(p.status, 400, "redirect loop must block the whole publish");
    const liveAfter = (await call("/api/content/published")).body;
    assert.equal(liveAfter.version, liveBefore.version);
    assert.equal(liveAfter.docs["page:contact"], undefined, "contact must not have gone live alone");
  });
  test("redirect analysis finds duplicates, loops and chains", async () => {
    const r = await call("/api/admin/seo/validate-redirects", { method: "POST", token: t, body: { redirects: [
      { from: "/x", to: "/y" }, { from: "/x", to: "/z" }, { from: "/y", to: "/z" }, { from: "/p", to: "/q" }, { from: "/q", to: "/p" }, { from: "/bad", to: "javascript:alert(1)" },
    ] } });
    const codes = r.body.issues.map((i) => i.code);
    for (const c of ["duplicate", "loop", "chain", "invalid-target"]) assert.ok(codes.includes(c), `expected ${c} in ${codes}`);
  });
  test("scheduled publish goes live at the scheduled time", async () => {
    await call("/api/admin/content/doc/page:terms", { method: "PATCH", token: t, body: { fields: { "title": "Scheduled terms" } } });
    const s = await call("/api/admin/content/schedules", { method: "POST", token: t, body: { docIds: ["page:terms"], at: new Date(Date.now() + 61_000).toISOString() } });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    // fast-forward: rewrite the schedule time into the past and run the scheduler
    const file = path.join(dataDir, "content/schedules.json");
    const list = JSON.parse(fs.readFileSync(file, "utf8"));
    list.find((x) => x.id === s.body.schedule.id).at = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(file, JSON.stringify(list));
    assert.equal((await call("/api/content/published")).body.docs["page:terms"], undefined, "not live before its time");
    svc.content.runDueSchedules(); // the same function the 20s timer calls
    assert.equal((await call("/api/content/published")).body.docs["page:terms"].fields.title, "Scheduled terms");
    const schedules = await call("/api/admin/content/schedules", { token: t });
    assert.equal(schedules.body.schedules.find((x) => x.id === s.body.schedule.id).status, "done");
  });
  test("preview tokens expose drafts, are unguessable and revocable", async () => {
    await call("/api/admin/content/doc/page:about", { method: "PATCH", token: t, body: { fields: { "hero.title": "Preview me" } } });
    const c = await call("/api/admin/content/previews", { method: "POST", token: t, body: { label: "stakeholders", hours: 2 } });
    assert.equal(c.status, 201);
    const pv = await call(`/api/preview/${c.body.token}`);
    assert.equal(pv.body.docs["page:about"].fields["hero.title"], "Preview me");
    assert.equal(pv.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal((await call(`/api/preview/${"0".repeat(64)}`)).status, 404);
    await call(`/api/admin/content/previews/${c.body.preview.id}`, { method: "DELETE", token: t });
    assert.equal((await call(`/api/preview/${c.body.token}`)).status, 404);
  });
  test("custom pages: create, reserved URLs refused, unpublish keeps a draft", async () => {
    assert.equal((await call("/api/admin/content/pages", { method: "POST", token: t, body: { slug: "/admin/evil", label: "x" } })).status, 400);
    const c = await call("/api/admin/content/pages", { method: "POST", token: t, body: { slug: "/landing/hospitals", label: "Hospitals landing" } });
    assert.equal(c.status, 201);
    const id = c.body.docId;
    assert.equal((await call("/api/admin/content/pages", { method: "POST", token: t, body: { slug: "/landing/hospitals", label: "dupe" } })).status, 400);
    assert.equal((await call("/api/admin/content/publish", { method: "POST", token: t, body: { docIds: [id] } })).status, 200);
    assert.equal((await call("/api/content/published")).body.docs[id].meta.slug, "/landing/hospitals");
    assert.equal((await call("/api/admin/content/unpublish", { method: "POST", token: t, body: { docId: id } })).status, 200);
    assert.equal((await call("/api/content/published")).body.docs[id], undefined);
    assert.equal((await call(`/api/admin/content/doc/${id}`, { token: t })).body.data.meta.slug, "/landing/hospitals");
  });
});

describe("media library", () => {
  let t, png, imgItem;
  before(async () => {
    t = await login(ADMIN.email, ADMIN.password);
    png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#6C22D6" } }).png().toBuffer();
  });
  test("image upload produces WebP + responsive widths", async () => {
    const r = await upload(t, png, "Hero Banner.png", { alt: "Brand banner", folder: "home", tags: "hero, brand" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    imgItem = r.body.item;
    assert.equal(imgItem.mime, "image/png");
    assert.equal(imgItem.width, 1200);
    assert.ok(imgItem.webp.endsWith(".webp"));
    assert.ok(imgItem.srcset.some((s) => s.w === 480));
    assert.deepEqual(imgItem.tags, ["hero", "brand"]);
    const f = await fetch(base + imgItem.webp);
    assert.equal(f.status, 200);
    assert.equal(f.headers.get("x-content-type-options"), "nosniff");
  });
  test("file type is decided by content, not by name", async () => {
    const exe = Buffer.concat([Buffer.from("MZ"), crypto.randomBytes(200)]);
    assert.equal((await upload(t, exe, "innocent.png")).status, 415);
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    assert.equal((await upload(t, html, "page.jpg")).status, 415);
  });
  test("SVG uploads are sanitized", async () => {
    const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><rect width="10" height="10" onclick="x()"/></a><foreignObject><body onload="y()"/></foreignObject><use href="https://evil/x.svg#a"/></svg>');
    const r = await upload(t, svg, "logo.svg");
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const txt = await (await fetch(base + r.body.item.url)).text();
    assert.ok(!/onload|onclick|<script|javascript:|foreignObject|evil/i.test(txt), txt);
    assert.ok(/<rect/.test(txt));
  });
  test("in-use media warns before delete; replace only changes drafts", async () => {
    // put the image on the live home page
    await call("/api/admin/content/doc/page:home", { method: "PATCH", token: t, body: { fields: { "about.image": { t: "img", src: imgItem.webp, alt: "x", mediaId: imgItem.id } } } });
    await call("/api/admin/content/publish", { method: "POST", token: t, body: { docIds: ["page:home"] } });
    const del = await call(`/api/admin/media/${imgItem.id}`, { method: "DELETE", token: t });
    assert.equal(del.status, 409);
    assert.ok(del.body.usedLive);
    const png2 = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#E03E8F" } }).png().toBuffer();
    const rep = await upload(t, png2, "new.png", {}, imgItem.id);
    assert.equal(rep.status, 200, JSON.stringify(rep.body));
    assert.ok(rep.body.draftsUpdated.includes("page:home"));
    const doc = await call("/api/admin/content/doc/page:home", { token: t });
    assert.equal(doc.body.data.fields["about.image"].src, rep.body.item.webp, "draft points at new file");
    assert.equal(doc.body.published.fields["about.image"].src, imgItem.webp, "live still points at old file");
    assert.equal((await fetch(base + imgItem.webp)).status, 200, "old file still served");
  });
  test("trash keeps serving; purge refused while live uses it", async () => {
    assert.equal((await call(`/api/admin/media/${imgItem.id}?force=1`, { method: "DELETE", token: t })).status, 200);
    assert.equal((await fetch(base + imgItem.webp)).status, 200);
    assert.equal((await call(`/api/admin/media/${imgItem.id}/purge`, { method: "DELETE", token: t })).status, 409);
  });
  test("path traversal in upload URLs is refused", async () => {
    const r = await fetch(`${base}/uploads/..%2f..%2fusers.json`);
    assert.notEqual(r.status, 200);
    const r2 = await fetch(`${base}/uploads/.tmp/anything`);
    assert.notEqual(r2.status, 200);
  });
});

describe("forms & leads", () => {
  let t;
  before(async () => { t = await login(ADMIN.email, ADMIN.password); });
  const ok = { name: "Asha Rao", email: "asha@example.com", phone: "+91 98765 43210", message: "Need HMS", product: "Hospital Management Software (HMS)" };
  test("server validates against the published definition", async () => {
    const bad = await call("/api/forms/demo/submit", { method: "POST", body: { values: { ...ok, name: "Robot123", email: "nope", product: "Hacker plan" } } });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.errors.name && bad.body.errors.email && bad.body.errors.product);
  });
  test("valid submission creates a lead with UTM context; duplicates dedupe by email", async () => {
    const ctx = { page: "/contact", utm: { source: "google", medium: "cpc", campaign: "hms-q4" }, firstTouch: { landingPage: "/products/hospitalmanagementsoftware", utm: { source: "google" } } };
    const r = await call("/api/forms/demo/submit", { method: "POST", body: { values: ok, context: ctx, startedAt: Date.now() - 10_000 } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    await call("/api/forms/contact/submit", { method: "POST", body: { values: { name: "Asha Rao", email: "ASHA@example.com", message: "again" }, startedAt: Date.now() - 10_000 } });
    const leads = await call("/api/admin/leads?q=asha", { token: t });
    assert.equal(leads.body.total, 1);
    assert.equal(leads.body.leads[0].submissions.length, 2);
    assert.equal(leads.body.leads[0].source, "google");
    assert.equal(leads.body.leads[0].landingPage, "/products/hospitalmanagementsoftware");
  });
  test("honeypot submissions are dropped silently", async () => {
    const before = (await call("/api/admin/submissions", { token: t })).body.total;
    const r = await call("/api/forms/demo/submit", { method: "POST", body: { values: ok, hp: "i am a bot" } });
    assert.equal(r.status, 201);
    assert.equal((await call("/api/admin/submissions", { token: t })).body.total, before);
  });
  test("legacy /api/contact still works", async () => {
    const r = await call("/api/contact", { method: "POST", body: { name: "Old Form", email: "old@example.com", message: "hello", product: "General" } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });
  test("legacy submissions were migrated with their status", async () => {
    const r = await call("/api/admin/leads?q=legacy", { token: t });
    assert.equal(r.body.leads[0].status, "contacted");
  });
  test("CSV export neutralises spreadsheet formulas", async () => {
    await call("/api/forms/contact/submit", { method: "POST", body: { values: { name: "Mr Formula", email: "f@example.com", message: "=HYPERLINK(\"http://evil\")" }, startedAt: Date.now() - 10_000 } });
    const r = await fetch(`${base}/api/admin/submissions/export.csv`, { headers: { Authorization: `Bearer ${t}` } });
    const csv = await r.text();
    assert.ok(csv.includes("\"'=HYPERLINK"), "formula must be prefixed with a quote");
  });
});

describe("audit trail", () => {
  test("mutations are recorded with who and what", async () => {
    const t = await login(ADMIN.email, ADMIN.password);
    const r = await call("/api/admin/audit?limit=500", { token: t });
    const actions = new Set(r.body.entries.map((e) => e.action));
    for (const a of ["auth.login", "user.create", "content.publish", "media.upload", "media.replace", "role.create"]) assert.ok(actions.has(a), `missing ${a}`);
    const pub = r.body.entries.find((e) => e.action === "content.publish");
    assert.ok(pub.userEmail && pub.at);
  });
});

describe("shared code", () => {
  test("the HTML sanitizer is byte-identical in backend and frontend", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const a = fs.readFileSync(path.join(here, "../lib/sanitize.js"), "utf8");
    const b = fs.readFileSync(path.join(here, "../../frontend/src/cms/sanitize.js"), "utf8");
    assert.equal(a, b, "backend/lib/sanitize.js and frontend/src/cms/sanitize.js have drifted apart");
  });
});

describe("header & footer scripts", () => {
  let superT, webT, mktT, codeT;
  const member = async (email, roleId) => {
    const r = await call("/api/admin/users", { method: "POST", token: superT, body: { email, password: "Password12345", roleId } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const t = await login(email, "Password12345");
    assert.equal((await call("/api/admin/password", { method: "POST", token: t, body: { current: "Password12345", next: "Chosen12345678" } })).status, 200);
    return t;
  };
  const snip = (over = {}) => ({ id: "sn_chat", name: "Chat widget", location: "bodyEnd", code: "<script>window.__chat = 1</script>", enabled: true, pages: ["*"], consent: "none", preview: false, ...over });
  const site = async (t = superT) => (await call("/api/admin/content/doc/site", { token: t })).body;
  const liveSnippets = async () => (await call("/api/content/published")).body.docs.site?.code?.snippets || [];
  const setCode = (t, snippets) => call("/api/admin/content/doc/site", { method: "PATCH", token: t, body: { code: { snippets } } });
  const publishSite = (t) => call("/api/admin/content/publish", { method: "POST", token: t, body: { docIds: ["site"] } });

  before(async () => {
    superT = await login(ADMIN.email, ADMIN.password);
    webT = await member("web-admin@example.com", "website_admin");
    mktT = await member("marketing@example.com", "marketing_manager");
    const role = await call("/api/admin/roles", { method: "POST", token: superT, body: { name: "Script Manager", permissions: ["dashboard.view", "site.code"] } });
    assert.equal(role.status, 201, JSON.stringify(role.body));
    codeT = await member("scripts@example.com", role.body.role.id);
  });

  test("only the Super Admin has the scripts permission out of the box", async () => {
    const r = await call("/api/admin/roles", { token: superT });
    assert.ok(r.body.permissions.some((p) => p.key === "site.code"));
    for (const role of r.body.roles.filter((x) => x.builtin && x.id !== "superadmin")) assert.ok(!role.permissions.includes("site.code"), role.id);
    assert.ok((await call("/api/admin/me", { token: superT })).body.user.permissions.includes("site.code"));
  });

  test("snippets are normalised on save, the code itself is kept as written", async () => {
    const r = await setCode(superT, [
      { id: "dup", name: "  ", location: "nowhere", code: "<script>a()</script>\u0000", pages: ["*", "/about", "../etc", "javascript:x"], consent: "maybe" },
      { id: "dup", location: "bodyStart", code: "<p onclick=\"x()\">hi</p>", enabled: false, preview: true, consent: "analytics" },
      "junk",
    ]);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const [a, b, ...rest] = r.body.data.code.snippets;
    assert.equal(rest.length, 0);
    assert.deepEqual(a, { id: "dup", name: "Custom code", location: "head", code: "<script>a()</script>", enabled: true, pages: ["*", "/about"], consent: "none", preview: false });
    assert.notEqual(b.id, "dup", "duplicate ids get a fresh one");
    assert.match(b.id, /^sn_[a-z0-9]+$/);
    assert.equal(b.code, "<p onclick=\"x()\">hi</p>", "custom code is not sanitised - it is meant to run");
    assert.equal(b.location, "bodyStart");
    assert.equal(b.enabled, false);
    assert.equal(b.preview, true);
    assert.equal(b.consent, "analytics");
    const many = await setCode(superT, Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, code: "<b>x</b>" })));
    assert.equal(many.body.data.code.snippets.length, 30);
    const long = await setCode(superT, [{ id: "big", code: "x".repeat(60000) }]);
    assert.equal(long.body.data.code.snippets[0].code.length, 50000);
    await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT });
  });

  test("people without the scripts permission can't add or change code", async () => {
    assert.equal((await setCode(webT, [snip()])).status, 403);
    assert.equal((await setCode(mktT, [snip()])).status, 403);
    // ...but can still edit the rest of the site document
    assert.equal((await call("/api/admin/content/doc/site", { method: "PATCH", token: webT, body: { footer: { motto: "Care, connected" } } })).status, 200);
    // and a scripts-only role can edit only the scripts
    assert.equal((await call("/api/admin/content/doc/site", { method: "PATCH", token: codeT, body: { header: { showCta: false } } })).status, 403);
    assert.equal((await site(codeT)).ok, true, "scripts-only role can read the site document");
  });

  test("without the scripts permission you publish everything except the scripts", async () => {
    assert.equal((await setCode(codeT, [snip()])).status, 200);
    // the draft now holds a footer change (website admin) and a script (scripts role)
    const p1 = await publishSite(webT);
    assert.equal(p1.status, 200, JSON.stringify(p1.body));
    assert.deepEqual(p1.body.keptAsDraft, ["site"]);
    assert.equal((await liveSnippets()).length, 0, "the script did not go live");
    let doc = await site();
    assert.equal(doc.published.footer.motto, "Care, connected", "the footer change did");
    assert.deepEqual(doc.data.code.snippets.map((s) => s.id), ["sn_chat"], "the script change is still a draft");
    assert.equal(doc.status.dirty, true);
    // only the script is left: nothing these people may publish or schedule
    const p2 = await publishSite(mktT);
    assert.equal(p2.status, 400);
    assert.match(p2.body.error, /scripts permission/);
    const sched = await call("/api/admin/content/schedules", { method: "POST", token: webT, body: { docIds: ["site"], at: new Date(Date.now() + 3600_000).toISOString() } });
    assert.equal(sched.status, 400);
    // editing scripts is not publishing: the scripts-only role can't publish
    assert.equal((await publishSite(codeT)).status, 403);
    assert.equal((await liveSnippets()).length, 0, "nothing went live");
    const ok = await publishSite(superT);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual(ok.body.keptAsDraft, []);
    assert.deepEqual((await liveSnippets()).map((s) => s.id), ["sn_chat"]);
    doc = await site();
    assert.equal(doc.status.dirty, false);
    // header/footer-only change: a website admin may publish it
    assert.equal((await call("/api/admin/content/doc/site", { method: "PATCH", token: webT, body: { footer: { motto: "Care, connected v2" } } })).status, 200);
    const p = await publishSite(webT);
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.deepEqual((await liveSnippets()).map((s) => s.id), ["sn_chat"], "publishing the footer keeps the live scripts");
  });

  test("switched-off snippets never reach visitors, live or in previews", async () => {
    await setCode(superT, [snip(), snip({ id: "sn_off", enabled: false, code: "<script>unfinished()</script>" }), snip({ id: "sn_pv", preview: true })]);
    assert.equal((await publishSite(superT)).status, 200);
    const live = await call("/api/content/published");
    assert.deepEqual(live.body.docs.site.code.snippets.map((s) => s.id), ["sn_chat", "sn_pv"]);
    assert.ok(!JSON.stringify(live.body).includes("unfinished()"));
    // still kept for the editors
    assert.ok((await site()).published.code.snippets.some((s) => s.id === "sn_off"));
    const c = await call("/api/admin/content/previews", { method: "POST", token: superT, body: { label: "scripts", hours: 1 } });
    const pv = await call(`/api/preview/${c.body.token}`);
    assert.deepEqual(pv.body.docs.site.code.snippets.map((s) => s.id), ["sn_chat", "sn_pv"]);
    await call(`/api/admin/content/previews/${c.body.preview.id}`, { method: "DELETE", token: superT });
    // a scripts-only role may create preview links to try its code
    assert.equal((await call("/api/admin/content/previews", { method: "POST", token: codeT, body: { label: "try", hours: 1 } })).status, 201);
  });

  test("discard and restore keep script drafts someone else may not touch", async () => {
    const before = await site();
    await setCode(superT, [...before.data.code.snippets, snip({ id: "sn_draft", code: "<script>draft()</script>" })]);
    await call("/api/admin/content/doc/site", { method: "PATCH", token: webT, body: { footer: { motto: "Temporary" } } });
    const d = await call("/api/admin/content/doc/site/discard", { method: "POST", token: webT });
    assert.equal(d.status, 200);
    assert.deepEqual(d.body.kept, ["code"]);
    let doc = await site();
    assert.equal(doc.data.footer.motto, doc.published.footer.motto, "the footer change was discarded");
    assert.ok(doc.data.code.snippets.some((s) => s.id === "sn_draft"), "the script draft was kept");
    assert.equal(doc.status.dirty, true);
    // the scripts-only role discards only what it may edit
    await call("/api/admin/content/doc/site", { method: "PATCH", token: webT, body: { footer: { motto: "Keep me" } } });
    const d2 = await call("/api/admin/content/doc/site/discard", { method: "POST", token: codeT });
    assert.deepEqual(d2.body.kept, ["footer"]);
    doc = await site();
    assert.equal(doc.data.footer.motto, "Keep me");
    assert.ok(!doc.data.code.snippets.some((s) => s.id === "sn_draft"), "script draft discarded by someone allowed to");
    // the super admin discards everything
    assert.deepEqual((await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT })).body.kept, []);
    assert.equal((await site()).status.dirty, false);

    // restore: an older revision with different scripts
    const revs = (await call("/api/admin/content/doc/site/revisions", { token: superT })).body.revisions;
    const oldest = revs[revs.length - 1];
    const old = (await call(`/api/admin/content/doc/site/revisions/${oldest.rev}`, { token: superT })).body.revision.data;
    assert.notDeepEqual(old.code, (await site()).published.code, "the oldest revision has other scripts");
    const r = await call("/api/admin/content/doc/site/restore", { method: "POST", token: webT, body: { rev: oldest.rev } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.kept, ["code"]);
    doc = await site();
    assert.deepEqual(doc.data.code, doc.published.code, "restoring by a website admin leaves the scripts alone");
    assert.equal((await publishSite(webT)).status, 200, "and so it can still be published by them");
    const r2 = await call("/api/admin/content/doc/site/restore", { method: "POST", token: superT, body: { rev: oldest.rev } });
    assert.deepEqual(r2.body.kept, []);
    assert.deepEqual((await site()).data.code, old.code, "the super admin restores the scripts too");
    await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT });
  });

  test("script edits are in the audit trail", async () => {
    const r = await call("/api/admin/audit?limit=500", { token: superT });
    const e = r.body.entries.find((x) => x.action === "content.scripts_edited");
    assert.ok(e, "content.scripts_edited recorded");
    assert.ok(e.userEmail);
  });

  test("a schedule with a script change is refused when its creator lost the permission", async () => {
    // a custom role that loses site.code after scheduling
    const role = await call("/api/admin/roles", { method: "POST", token: superT, body: { name: "Temp Scripts", permissions: ["site.code", "site.publish"] } });
    const t = await member("temp-scripts@example.com", role.body.role.id);
    const live = await liveSnippets();
    await setCode(t, [...live, snip({ id: "sn_sched", code: "<script>scheduled()</script>" })]);
    const s = await call("/api/admin/content/schedules", { method: "POST", token: t, body: { docIds: ["site"], at: new Date(Date.now() + 61_000).toISOString() } });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    assert.equal((await call(`/api/admin/roles/${role.body.role.id}`, { method: "PATCH", token: superT, body: { permissions: ["site.publish"] } })).status, 200);
    const file = path.join(dataDir, "content/schedules.json");
    const list = JSON.parse(fs.readFileSync(file, "utf8"));
    list.find((x) => x.id === s.body.schedule.id).at = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(file, JSON.stringify(list));
    svc.content.runDueSchedules();
    assert.ok(!(await liveSnippets()).some((x) => x.id === "sn_sched"), "the scheduled script must not go live");
    const after = (await call("/api/admin/content/schedules", { token: superT })).body.schedules.find((x) => x.id === s.body.schedule.id);
    assert.equal(after.status, "failed");
    await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT });
  });

  test("undo back to before the first script removes the scripts from the draft", async () => {
    await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT });
    const live = await liveSnippets();
    // a site whose live version has no scripts: start from a clean draft without them
    await setCode(superT, []);
    let doc = await site();
    assert.equal(doc.data.code, undefined, "an empty list is stored as no scripts");
    // the editor sends null for a section that no longer exists in its draft
    await setCode(superT, [snip({ id: "sn_undo" })]);
    const r = await call("/api/admin/content/doc/site", { method: "PATCH", token: superT, body: { code: null } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    doc = await site();
    assert.equal(doc.data.code, undefined);
    assert.ok(!JSON.stringify(doc.data).includes("sn_undo"));
    // removing scripts is a script change: not for people without the permission
    assert.equal((await call("/api/admin/content/doc/site", { method: "PATCH", token: webT, body: { code: null } })).status, 403);
    // put the live scripts back for the next tests
    await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT });
    assert.deepEqual((await liveSnippets()).map((s) => s.id), live.map((s) => s.id));
  });

  test("a schedule saved before scripts existed keeps the live scripts", async () => {
    await call("/api/admin/content/doc/site", { method: "PATCH", token: superT, body: { footer: { motto: "Old-style schedule" } } });
    const s = await call("/api/admin/content/schedules", { method: "POST", token: superT, body: { docIds: ["site"], at: new Date(Date.now() + 61_000).toISOString() } });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    // make it look like one saved by the previous release: no liveCode, no scripts in the snapshot
    const file = path.join(dataDir, "content/schedules.json");
    let list = JSON.parse(fs.readFileSync(file, "utf8"));
    const old = list.find((x) => x.id === s.body.schedule.id);
    delete old.liveCode;
    delete old.snapshot.site.code;
    old.at = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(file, JSON.stringify(list));
    const before = (await liveSnippets()).map((x) => x.id);
    assert.ok(before.length > 0);
    svc.content.runDueSchedules();
    list = (await call("/api/admin/content/schedules", { token: superT })).body.schedules;
    assert.equal(list.find((x) => x.id === s.body.schedule.id).status, "done");
    assert.equal((await site()).published.footer.motto, "Old-style schedule");
    assert.deepEqual((await liveSnippets()).map((x) => x.id), before, "the live scripts survived");
    await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT });
  });

  test("status names the changed site sections; a scripts-only site draft is skipped in a bigger publish", async () => {
    await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT });
    const live = await liveSnippets();
    await setCode(superT, [...live, snip({ id: "sn_pending" })]);
    let doc = await site();
    assert.deepEqual(doc.status.changed, ["code"]);
    // the website admin publishes a page together with the site settings:
    // the page goes live, the site (only scripts pending) is left as a draft
    assert.equal((await call("/api/admin/content/doc/page:privacy", { method: "PATCH", token: webT, body: { fields: { title: "Privacy (multi publish)" } } })).status, 200);
    const p = await call("/api/admin/content/publish", { method: "POST", token: webT, body: { docIds: ["page:privacy", "site"] } });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.deepEqual(p.body.keptAsDraft, ["site"]);
    assert.equal((await call("/api/content/published")).body.docs["page:privacy"].fields.title, "Privacy (multi publish)");
    assert.ok(!(await liveSnippets()).some((s) => s.id === "sn_pending"));
    // same for schedules: the site is left out of the snapshot
    await call("/api/admin/content/doc/page:privacy", { method: "PATCH", token: webT, body: { fields: { title: "Privacy (scheduled)" } } });
    const s = await call("/api/admin/content/schedules", { method: "POST", token: webT, body: { docIds: ["page:privacy", "site"], at: new Date(Date.now() + 3600_000).toISOString() } });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    assert.deepEqual(s.body.schedule.docIds, ["page:privacy"]);
    assert.equal((await call(`/api/admin/content/schedules/${s.body.schedule.id}`, { method: "DELETE", token: webT })).status, 200);
    doc = await site();
    assert.deepEqual(doc.status.changed, ["code"], "the script draft is untouched");
    await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT });
    await call("/api/admin/content/doc/page:privacy/discard", { method: "POST", token: superT });
    assert.deepEqual((await site()).status.changed, []);
  });

  test("a scripts-only role sees the preview links it can create and revoke", async () => {
    const c = await call("/api/admin/content/previews", { method: "POST", token: codeT, body: { label: "mine", hours: 1 } });
    assert.equal(c.status, 201);
    const l = await call("/api/admin/content/previews", { token: codeT });
    assert.equal(l.status, 200);
    assert.ok(l.body.previews.some((p) => p.id === c.body.preview.id));
    assert.equal((await call(`/api/admin/content/previews/${c.body.preview.id}`, { method: "DELETE", token: codeT })).status, 200);
  });

  test("a scheduled footer change never rolls back scripts published after it was scheduled", async () => {
    await call("/api/admin/content/doc/site", { method: "PATCH", token: webT, body: { footer: { motto: "Scheduled motto" } } });
    const s = await call("/api/admin/content/schedules", { method: "POST", token: webT, body: { docIds: ["site"], at: new Date(Date.now() + 61_000).toISOString() } });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    // meanwhile the super admin publishes a new script
    await call("/api/admin/content/doc/site/discard", { method: "POST", token: superT });
    const live = await liveSnippets();
    await setCode(superT, [...live, snip({ id: "sn_later", code: "<script>later()</script>" })]);
    assert.equal((await publishSite(superT)).status, 200);
    const file = path.join(dataDir, "content/schedules.json");
    const list = JSON.parse(fs.readFileSync(file, "utf8"));
    list.find((x) => x.id === s.body.schedule.id).at = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(file, JSON.stringify(list));
    svc.content.runDueSchedules();
    const after = (await call("/api/admin/content/schedules", { token: superT })).body.schedules.find((x) => x.id === s.body.schedule.id);
    assert.equal(after.status, "done", after.error);
    const doc = await site();
    assert.equal(doc.published.footer.motto, "Scheduled motto");
    assert.ok((await liveSnippets()).some((x) => x.id === "sn_later"), "the later script publish is still live");
  });
});

describe("security hardening", () => {
  let superT;
  // creates a user, replaces the temporary password and returns a token
  const member = async (email, roleId, extra = {}) => {
    const r = await call("/api/admin/users", { method: "POST", token: superT, body: { email, password: "Password12345", roleId, ...extra } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const t = await login(email, "Password12345");
    assert.equal((await call("/api/admin/password", { method: "POST", token: t, body: { current: "Password12345", next: "Chosen12345678" } })).status, 200);
    return { t, id: r.body.user.id };
  };
  before(async () => { superT = await login(ADMIN.email, ADMIN.password); });

  test("a temporary password only allows choosing a new one", async () => {
    await call("/api/admin/users", { method: "POST", token: superT, body: { email: "temp@example.com", password: "Password12345", roleId: "website_admin" } });
    const t = await login("temp@example.com", "Password12345");
    const r = await call("/api/admin/content/docs", { token: t });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, "PASSWORD_CHANGE_REQUIRED");
    assert.equal((await call("/api/admin/me", { token: t })).status, 200);
  });

  test("team managers can't take over stronger accounts or promote themselves", async () => {
    const roles = await call("/api/admin/roles", { token: superT });
    assert.equal(roles.status, 200);
    const viewerPerms = roles.body.roles.find((r) => r.id === "viewer").permissions;
    const mk = await call("/api/admin/roles", { method: "POST", token: superT, body: { name: "People Ops", permissions: [...viewerPerms, "users.manage"] } });
    assert.equal(mk.status, 201, JSON.stringify(mk.body));
    const hr = await member("hr@example.com", mk.body.role.id);
    const strong = await member("strong@example.com", "website_admin");
    const weak = await member("weak2@example.com", "viewer");
    // can't reset the password of someone with more rights
    assert.equal((await call(`/api/admin/users/${strong.id}`, { method: "PATCH", token: hr.t, body: { password: "Hijacked123456" } })).status, 403);
    // can't hand out a role stronger than their own, or change their own role
    assert.equal((await call(`/api/admin/users/${weak.id}`, { method: "PATCH", token: hr.t, body: { roleId: "website_admin" } })).status, 403);
    assert.equal((await call(`/api/admin/users/${hr.id}`, { method: "PATCH", token: hr.t, body: { roleId: "viewer" } })).status, 400);
    assert.equal((await call("/api/admin/users", { method: "POST", token: hr.t, body: { email: "new@example.com", password: "Password12345", roleId: "website_admin" } })).status, 403);
    // but can manage people within their own rights
    assert.equal((await call(`/api/admin/users/${weak.id}`, { method: "PATCH", token: hr.t, body: { name: "Renamed" } })).status, 200);
  });

  test("chatbot buttons can't carry javascript: links to visitors", async () => {
    const put = await call("/api/admin/settings", { method: "PUT", token: superT, body: { chatbot: { intents: [{ id: "x", keywords: "hi", answer: "hello", actions: [{ label: "Bad", type: "link", href: "javascript:alert(document.cookie)" }, { label: "Good", type: "link", href: "/contact" }, { label: "Odd", type: "eval" }] }] } } });
    assert.equal(put.status, 200);
    const pub = await call("/api/settings");
    const actions = pub.body.chatbot.intents.find((i) => i.id === "x").actions;
    assert.deepEqual(actions, [{ label: "Good", type: "link", href: "/contact" }]);
  });

  test("changing the SMTP server drops the saved password", async () => {
    await call("/api/admin/settings", { method: "PUT", token: superT, body: { notifications: { smtp: { host: "smtp.example.com", port: "587", user: "a@example.com", pass: "SecretPass1" } } } });
    await call("/api/admin/settings", { method: "PUT", token: superT, body: { notifications: { smtp: { host: "attacker.example.net", port: "587", user: "a@example.com" } } } });
    const s = JSON.parse(fs.readFileSync(path.join(dataDir, "settings.json"), "utf8"));
    assert.equal(s.notifications.smtp.pass, "");
  });

  test("public content never includes internal notification addresses", async () => {
    const pub = await call("/api/content/published");
    for (const f of pub.body.docs.forms.forms) assert.equal(f.notify, undefined);
    assert.equal((await call("/api/forms/demo")).body.form.notify, undefined);
  });

  test("view-only roles can't create preview links", async () => {
    const v = await member("viewer2@example.com", "viewer");
    assert.equal((await call("/api/admin/content/previews", { method: "POST", token: v.t, body: { label: "x" } })).status, 403);
  });

  test("the link checker refuses private addresses in every notation", async () => {
    const urls = ["http://127.0.0.1/", "http://[::ffff:7f00:1]/", "http://[::ffff:a9fe:a9fe]/", "http://0x7f000001/", "http://2130706433/", "http://localhost/"];
    const r = await call("/api/admin/seo/check-links", { method: "POST", token: superT, body: { urls } });
    assert.equal(r.status, 200);
    for (const x of r.body.results) assert.match(x.error || "", /Blocked/, x.url);
  });

  test("a schedule fails if its creator lost publish rights", async () => {
    const pub = await member("publisher@example.com", "website_admin");
    await call("/api/admin/content/doc/page:privacy", { method: "PATCH", token: pub.t, body: { fields: { title: "Scheduled by a demoted user" } } });
    const s = await call("/api/admin/content/schedules", { method: "POST", token: pub.t, body: { docIds: ["page:privacy"], at: new Date(Date.now() + 61_000).toISOString() } });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    assert.equal((await call(`/api/admin/users/${pub.id}`, { method: "PATCH", token: superT, body: { roleId: "viewer" } })).status, 200);
    const file = path.join(dataDir, "content/schedules.json");
    const list = JSON.parse(fs.readFileSync(file, "utf8"));
    list.find((x) => x.id === s.body.schedule.id).at = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(file, JSON.stringify(list));
    svc.content.runDueSchedules();
    const after = (await call("/api/admin/content/schedules", { token: superT })).body.schedules.find((x) => x.id === s.body.schedule.id);
    assert.equal(after.status, "failed");
    assert.notEqual((await call("/api/content/published")).body.docs["page:privacy"]?.fields?.title, "Scheduled by a demoted user");
  });
});

describe("form spam timer", () => {
  const values = { name: "Timer Test", email: "timer@example.com", message: "hello" };
  test("too-fast submissions are refused using the browser-measured time", async () => {
    const r = await call("/api/forms/contact/submit", { method: "POST", body: { values, elapsedMs: 400 } });
    assert.equal(r.status, 400);
  });
  test("a visitor whose clock runs ahead is not blocked", async () => {
    const r = await call("/api/forms/contact/submit", { method: "POST", body: { values, startedAt: Date.now() + 5 * 60_000 } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });
});

// Runs last: it changes the Super Admin password of the shared test data.
describe("admin account recovery", () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "../scripts/admin.mjs");
  const run = (args, dir = dataDir) => execFileSync(process.execPath, [script, ...args], { env: { ...process.env, DATA_DIR: dir }, encoding: "utf8" });

  test("status lists accounts without revealing password hashes", () => {
    const out = run(["status"]);
    assert.match(out, /livexperttechnologies@gmail\.com/);
    const users = JSON.parse(fs.readFileSync(path.join(dataDir, "users.json"), "utf8"));
    for (const u of users) assert.ok(!out.includes(u.passwordHash), "hash leaked");
  });

  test("console reset gives a working temporary password and signs out old sessions", async () => {
    const before = await login(ADMIN.email, ADMIN.password);
    assert.equal((await call("/api/admin/me", { token: before })).status, 200);
    const out = run(["reset-password"]);
    const temp = /Temporary password: (\S+)/.exec(out)?.[1];
    assert.ok(temp, out);
    assert.equal((await call("/api/admin/me", { token: before })).status, 401, "old session must be signed out");
    assert.equal(await login(ADMIN.email, ADMIN.password), undefined, "old password must stop working");
    const t = await login(ADMIN.email, temp);
    assert.ok(t, "temporary password must work");
    const me = await call("/api/admin/me", { token: t });
    assert.equal(me.body.user.mustChangePassword, true);
    assert.equal((await call("/api/admin/content/docs", { token: t })).body.code, "PASSWORD_CHANGE_REQUIRED");
    assert.equal((await call("/api/admin/password", { method: "POST", token: t, body: { current: temp, next: "Recovered12345" } })).status, 200);
    ADMIN.password = "Recovered12345";
    assert.equal((await call("/api/admin/content/docs", { token: t })).status, 200, "same session keeps working after choosing a password");
  });

  test("console reset can set a chosen password and re-creates a missing Super Admin", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kibo360-reset-"));
    try {
      assert.throws(() => run(["reset-password", "--password", "Chosen98765abc"], dir), (e) => /does not look like the server's data folder/.test(e.stderr));
      const out = run(["reset-password", "--password", "Chosen98765abc", "--create"], dir);
      assert.match(out, /Created the Super Admin/);
      assert.match(out, /Data folder:/);
      const users = JSON.parse(fs.readFileSync(path.join(dir, "users.json"), "utf8"));
      assert.equal(users.length, 1);
      assert.equal(users[0].roleId, "superadmin");
      assert.equal(users[0].mustChangePassword, true);
      assert.throws(() => run(["reset-password", "--password", "short"], dir), (e) => /Password rejected/.test(e.stderr));
      // never a second Super Admin
      const again = run(["reset-password"], dir);
      assert.match(again, /Password reset for livexperttechnologies@gmail\.com/);
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "users.json"), "utf8")).length, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test("KIBO_ADMIN_RESET_PASSWORD resets once, not on every restart", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kibo360-envreset-"));
    const start = async () => {
      const made = await createApp({ dataDir: dir });
      const server = await new Promise((res) => { const s = made.app.listen(0, () => res(s)); });
      return { made, server, url: `http://localhost:${server.address().port}` };
    };
    const signIn = async (url, password) => (await (await fetch(`${url}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ADMIN.email, password }) })).json()).token;
    process.env.KIBO_ADMIN_RESET_PASSWORD = "EnvReset12345";
    try {
      let a = await start();
      const t = await signIn(a.url, "EnvReset12345");
      assert.ok(t, "env password must work");
      const ch = await fetch(`${a.url}/api/admin/password`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ current: "EnvReset12345", next: "MyOwnPass12345" }) });
      assert.equal(ch.status, 200);
      a.server.close(); a.made.close();
      a = await start(); // restart with the variable still set
      assert.ok(await signIn(a.url, "MyOwnPass12345"), "a restart must not reset the chosen password again");
      assert.equal(await signIn(a.url, "EnvReset12345"), undefined);
      a.server.close(); a.made.close();
    } finally {
      delete process.env.KIBO_ADMIN_RESET_PASSWORD;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("sign-in throttling", () => {
  const signIn = (email, password, ip) => call("/api/admin/login", { method: "POST", body: { email, password }, headers: { "X-Forwarded-For": ip } });
  let email;
  before(async () => {
    const superT = await login(ADMIN.email, ADMIN.password);
    email = "throttle@example.com";
    await call("/api/admin/users", { method: "POST", token: superT, body: { email, password: "Throttle12345", roleId: "viewer" } });
  });
  test("missing email or password is a 400, not a failed attempt", async () => {
    assert.equal((await call("/api/admin/login", { method: "POST", body: { email } })).status, 400);
    assert.equal((await call("/api/admin/login", { method: "POST", raw: "email=x", headers: { "Content-Type": "text/plain" } })).status, 400);
  });
  test("strangers failing from other networks can't lock out the right password", async () => {
    for (let i = 0; i < 14; i++) assert.equal((await signIn(email, "WrongPassword1", `203.0.113.${i + 1}`)).status, 401);
    const ok = await signIn(email, "Throttle12345", "198.51.100.7");
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  });
  test("one network is paused after repeated failures, with a real wait time", async () => {
    for (let i = 0; i < 5; i++) await signIn(email, "WrongPassword1", "192.0.2.50");
    const r = await signIn(email, "Throttle12345", "192.0.2.50");
    assert.equal(r.status, 429);
    assert.ok(Number(r.headers.get("retry-after")) > 0);
    assert.match(r.body.error, /Try again in/);
    assert.equal((await signIn(email, "Throttle12345", "192.0.2.51")).status, 200, "another network is not affected");
  });
});

describe("sign-in hardening, round 2", () => {
  const signIn = (email, password, ip) => call("/api/admin/login", { method: "POST", body: { email, password }, headers: { "X-Forwarded-For": ip } });
  let superT;
  before(async () => { superT = await login(ADMIN.email, ADMIN.password); });

  test("an IPv6 /64 counts as one network", async () => {
    const email = "ipv6@example.com";
    await call("/api/admin/users", { method: "POST", token: superT, body: { email, password: "Ipv6Test12345", roleId: "viewer" } });
    for (let i = 1; i <= 5; i++) await signIn(email, "WrongPassword1", `2001:db8:1:2::${i}`);
    assert.equal((await signIn(email, "Ipv6Test12345", "2001:db8:1:2::99")).status, 429, "same /64 is paused");
    assert.equal((await signIn(email, "Ipv6Test12345", "2001:db8:1:3::1")).status, 200, "another /64 is not");
  });

  test("attempts refused while the queue is full do not keep the owner out", async () => {
    const email = "queue@example.com";
    await call("/api/admin/users", { method: "POST", token: superT, body: { email, password: "QueueTest12345", roleId: "viewer" } });
    for (let i = 1; i <= 11; i++) await signIn(email, "WrongPassword1", `198.18.${i}.1`); // > 10 failures: queueing starts
    // a burst of refused / queued attempts from many networks...
    await Promise.all(Array.from({ length: 30 }, (_, i) => signIn(email, "WrongPassword1", `198.19.${i}.1`)));
    // ...must not leave a stale gate: the right password gets in within a few seconds
    const t0 = Date.now();
    const ok = await signIn(email, "QueueTest12345", "192.0.2.200");
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.ok(Date.now() - t0 < 15_000, "no long wait after the burst");
  });

  test("changing your own password through the team screen is refused", async () => {
    const me = await call("/api/admin/me", { token: superT });
    const r = await call(`/api/admin/users/${me.body.user.id}`, { method: "PATCH", token: superT, body: { password: "SomethingNew12345" } });
    assert.equal(r.status, 400);
  });

  test("the old public default is refused as a reset password and flagged when still in use", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kibo360-default-"));
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "../scripts/admin.mjs");
    const run = (args) => execFileSync(process.execPath, [script, ...args], { env: { ...process.env, DATA_DIR: dir }, encoding: "utf8" });
    try {
      assert.throws(() => run(["reset-password", "--create", "--password", "Kibo360@Admin"]), (e) => /publicly known/.test(e.stderr));
      // an account the previous release already upgraded (scrypt of the public default)
      const { hashPassword } = await import("../lib/security.js");
      fs.writeFileSync(path.join(dir, "users.json"), JSON.stringify([{ id: "u_x", email: ADMIN.email, name: "Owner", roleId: "superadmin", extraPermissions: [], passwordHash: hashPassword("Kibo360@Admin"), active: true }]));
      assert.match(run(["status"]), /old public default/);
      const made = await createApp({ dataDir: dir });
      const server = await new Promise((res) => { const s = made.app.listen(0, () => res(s)); });
      try {
        const r = await (await fetch(`http://localhost:${server.address().port}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ADMIN.email, password: "Kibo360@Admin" }) })).json();
        assert.equal(r.user.mustChangePassword, true, "must choose a new password even with a scrypt hash");
      } finally { server.close(); made.close(); }
      process.env.KIBO_ADMIN_RESET_PASSWORD = "Kibo360@Admin";
      const made2 = await createApp({ dataDir: dir }); // ignored with a clear log line, not applied
      made2.close();
      const users = JSON.parse(fs.readFileSync(path.join(dir, "users.json"), "utf8"));
      assert.equal(users[0].resetHash, undefined);
    } finally {
      delete process.env.KIBO_ADMIN_RESET_PASSWORD;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
