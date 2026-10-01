# KIBO360 Website Management (Super Admin CMS)

Super Admin lives at `/admin`. The marketing team can edit the whole site there
without code: **Edit → Save draft (automatic) → Preview → Publish → Live**.
Nothing a visitor sees changes until someone with publish rights publishes.

## How it works

- **Same components everywhere.** The live site, secure previews and the visual
  editor all render the real React pages (`frontend/src/pages`). The editor opens a
  page in an iframe with `?kibo_editor=1`; clicks and typing there are applied to
  the draft by the admin window.
- **Code keeps the defaults, the CMS stores overrides.** Page text, images and
  buttons fall back to what is in the code, so an empty CMS shows the original site.
- **Documents:** `site` (header, footer, menus, banners, settings, scripts), `seo`
  (defaults, redirects, robots, sitemap, schema, llms.txt, IndexNow), `forms`, and
  one `page:<id>` per page (`page:c-…` for pages created in the admin).
- **Drafts vs live:** drafts in `DATA_DIR/content/drafts/`, everything live in ONE
  file, `DATA_DIR/content/published.json`, replaced atomically on publish (a failed
  publish leaves the live site untouched). Every publish is kept in
  `content/revisions/` (last 100 per document) and can be restored to a draft.

## Two ways to serve the public site

| | Static hosting (current) | Node site server (recommended) |
|---|---|---|
| How | `npm run build` in `frontend/`, upload `frontend/dist/` | backend with `SITE_DIST` set serves the site |
| Published text/images | visitors get them within seconds (the page checks `/api/content/version`) | server-rendered immediately |
| Search engines / social previews | see new content after the next build | see it immediately |
| Redirect manager | client-side redirects + stub pages | real 301/302/307/308/410 responses |
| robots.txt / sitemap.xml / llms.txt | written at build time | always live |

Static build that bakes in the published content:

```bash
cd frontend
CONTENT_API=https://api.kibo360.in npm run build
```

Node site server (serves `/`, `/api`, `/uploads` from one process):

```bash
cd frontend && npm run build
cd ../backend && SITE_DIST=../frontend/dist PORT=5001 node server.js
```

## Backend environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5001` | listen port |
| `DATA_DIR` | `backend/data` | JSON stores, uploads, drafts, revisions, audit log. **Back this up.** |
| `SITE_DIST` | unset | path to `frontend/dist` to also serve the website (SSR mode) |
| `SERVE_SITE=1` | unset | shortcut: serve `../frontend/dist` if it exists |
| `ALLOWED_ORIGINS` | – | extra CORS origins, comma separated (e.g. a staging domain) |
| `SITE_FORM_ACTION` | – | Node site server only: extra `https://` origins (space separated) that forms on the site may post to, e.g. a newsletter form added under Header & footer scripts |
| `KIBO_ADMIN_PASSWORD` | generated | fresh installs only: first Super Admin password. If unset, a random one is printed once in the server log. It must be changed at first sign-in (enforced by the API). |

The backend trusts exactly one reverse proxy for the client IP (`X-Forwarded-For`,
used by login throttling and rate limits). Put it behind one proxy (nginx, a load
balancer) and don't expose its port directly to the internet.

Image optimisation (WebP + responsive sizes, EXIF/GPS removal) uses `sharp`
(installed with `npm install` in `backend/`). Without it uploads still work, unoptimised.

## Rolling out (staging first)

1. Copy the production `backend/data` to the staging server (it contains leads -
   keep it private). Existing leads/submissions are migrated automatically on first
   start; a backup is written to `submissions.legacy-backup.json`.
2. `cd backend && npm install && npm test` (all tests must pass).
3. Build and start staging on e.g. `staging.kibo360.in`, preferably with the Node
   site server (`SITE_DIST`), so the site and its API share one origin. Only
   `kibo360.in` / `www.kibo360.in` talk to the production API; every other host uses
   its own origin, so staging can never sign in to or publish on the live site. To
   point a static build at a different API, build with `VITE_API_BASE=https://…` and
   add the site's origin to that API's `ALLOWED_ORIGINS`.
4. Sign in at `/admin` with the super admin account. Accounts with the old password
   format are upgraded to scrypt automatically at their next sign-in. New team
   members must set their own password at first sign-in. Sessions stay alive
   while someone is working (12 h idle timeout, 7 day maximum); if one expires
   mid-edit, Super Admin asks for the password again and keeps unsaved changes.
5. Walk through: edit a page → Preview link → Publish → check the live page; SEO →
   Health check; upload an image; submit the demo form and find it under Leads.
6. When staging looks right, deploy the same build to production.

## Locked out of the admin?

Run these on the server, in the `backend/` folder (with the same `DATA_DIR` the
server uses, if it sets one):

```bash
npm run admin -- status
npm run admin -- reset-password
```

`status` shows which data folder is used, the accounts in it and their state
(never password hashes), plus lead/submission counts, so you can tell whether
the old data came along with the deploy. `reset-password` sets a new
**temporary** password for the Super Admin (prints it once), re-activates the
account and signs out its old sessions; you choose your own password at the next
sign-in. Reset someone else with `npm run admin -- reset-password name@example.com`.

No shell on the host? Set `KIBO_ADMIN_RESET_PASSWORD=<temporary password>` and
restart once. It is applied a single time per value (restarts don't keep
resetting it). Remove the variable after signing in.

Other causes of "Invalid email or password":
- **The deploy started with an empty data folder.** The server then creates the
  Super Admin with a random temporary password, printed once in the server log
  (`[auth] Temporary password: …`). If so, your old leads and settings are still in
  the previous data folder: stop the server and copy that folder back.
- **Too many failed attempts.** After 8 failures in 10 minutes from one network (or
  5 for the same email from one network) that network pauses; the message says for
  how long. Other networks are not affected, and failures from strangers only slow
  sign-in down, never lock the right password out. Restarting the server clears it.
- **A "Session expired" box right after signing in** was a bug in the first CMS
  release (an old sign-in left in the browser); fixed. If you see it, enter the
  password you are using now.

## Header & footer scripts

Website → **Header & Footer Scripts** (`/admin/site/code`) adds custom code to the
public site: tag managers, pixels, chat widgets, custom CSS, structured data. Each
snippet has:

- **Where:** inside `<head>`, right after `<body>`, or just before `</body>`.
  Within each position snippets run top to bottom.
- **Show on:** all pages, or only the pages you tick.
- **Needs cookie consent:** loads only after the visitor accepts cookies (and
  makes the cookie banner appear). If consent is switched off under Website
  Settings → Analytics, it loads for everyone.
- **Also run on preview links:** off by default - only the live site runs it.
- **On/Off:** new snippets start off. Switched-off snippets are never sent to
  visitors.

Snippets are part of the `site` document, so they follow Edit → Preview →
Publish like everything else. How they run:

- They are added in the browser after the page loads, never written into the
  static/SSR HTML (that HTML also serves `/admin`). They never run in Super
  Admin or in the visual editor.
- `<script>` tags execute like code written into the page, also when nested
  in other markup: an external script without `async` finishes loading before
  the next part runs, and `document.write` output is inserted in place.
  `<noscript>` parts are dropped (this code only runs with JavaScript on).
  Code that waits for `DOMContentLoaded` or the window `load` event (already
  over when snippets run) is called right after its script.
- Page-limited snippets are removed when the visitor navigates away and run
  again when they come back, like on a page load; anything a script already
  started keeps running until a reload.
- A statically built page first checks with the API that its content is
  current. If a newer version exists, the new scripts run - never the old ones,
  even if the new version can't be downloaded. If the API can't be reached at
  all, the page's own (build-time) scripts run. Pages from the Node site server
  are always current and don't wait.
- Following a link from the public site into `/admin` always loads Super Admin
  in a fresh page, so code that ran on the site never runs next to it.
- Search engines that don't run JavaScript don't see these snippets. For site
  verification use Website Settings → Search engine verification.
- With the Node site server, forms may only post to the website itself. A
  third-party form (newsletter, CRM) that posts to another site needs that
  origin in `SITE_FORM_ACTION` (see Backend environment). JavaScript-based
  embeds don't need it.

**Who can change them:** the `site.code` permission ("Header & footer scripts").
Only the Super Admin has it by default; give it only to people you trust with the
whole website: a script runs with the website's own access, so it can read
everything a visitor types and could misuse an admin session open in the same
browser. Without `site.code`:

- people still edit and publish the rest of the site settings, and their publish
  keeps the live scripts as they are;
- someone else's script draft stays a draft;
- discard and restore leave scripts alone;
- a schedule that doesn't change scripts uses whatever scripts are live when it
  runs.

Script edits appear in Change History (`content.scripts_edited`).

## Permissions

Roles (Team Access → Roles & Permissions): Super Admin, Website Admin, Content
Manager, SEO Manager, Marketing Manager, Viewer, plus custom roles. Editing and
publishing are separate permissions for pages, SEO, site settings and forms; every
API route checks them on the server, and every change is written to the audit log
(Change History). Header & footer scripts have their own permission (`site.code`),
see above.

## Developer notes

- Isolated local test: `KIBO_DEV_PORT=4600 KIBO_API_TARGET=http://localhost:5098 npm run dev`
  in `frontend/` with a backend started as `PORT=5098 DATA_DIR=<copy of data> node server.js`.
- `backend/lib/sanitize.js` and `frontend/src/cms/sanitize.js` must stay identical
  (a test checks this) - the same sanitizer runs in the browser, SSR and the API.
- New editable content in code: wrap text in `<T k="…">`, rich text in `<R k="…">`,
  images in `<Img k="…">`, buttons in `<Btn k="…">`, repeating items in `<List>`,
  page sections in `<Sec id="…">` inside `<Sections>`. Keys must stay stable -
  renaming a key orphans its saved edits.
