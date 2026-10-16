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

## Changing a page's address (URL)

Visual editor → open the page → **Page** tab → *Page address (URL)* → **Change**.
Every page can be moved, except Home, which always stays at `/`.

- **Main pages** (Products, HMS, CMS, About, Contact, Privacy, Terms, Thank You):
  - The new address is a draft until the page is published.
  - After that, the original address forwards to the new one with a permanent
    301 that keeps the query string, so `utm_*` tags survive. The old short
    URLs (`/hms`, `/his`, `/cms`, `/products/hms`, `/products/cms`) follow
    the page too.
  - Menu links, footer links, buttons, breadcrumbs, canonical tags, sitemap,
    llms.txt and the static build all use the new address.
  - Banners and header/footer scripts limited to that page keep showing on it.
  - **Restore the original address** puts the page back.
  - A page may use its own old short URL (HMS at `/hms`), but never another
    page's address or another page's old short URL.
- **Landing pages and copies:** the same field (plus the page name).
- **Moving a page that is already live at a new address:** when such a page
  (main or landing) moves again, the editor offers a 301 redirect from the
  address it was live at. That redirect goes live with the SEO settings.
  - Moving a page back onto an address it had before removes the old redirect
    from that address, so no loop is created.
  - Redirects that pointed at the page's previous address are pointed at the
    new one, so there are no chains.
- **Restores and schedules:** restoring an old revision never moves the page;
  only Page settings change an address. A schedule publishes the address that
  is live when it runs, unless the schedule itself was made to change it.
- **Links and redirects follow:** links to an address that has a rule in
  SEO → Redirects go straight to the target. A rule pointing at a moved main
  page's original address forwards in one hop. Redirects keep the query string
  (placed before any `#anchor`), and so do the static build's redirect pages.
- **Preview links and Compare:** preview links to a page's old address keep
  the preview open. Compare in the editor shows the live page at its live
  address next to the draft.
- **Addresses** are at most 120 characters. robots.txt blocks only Super Admin
  (`/admin` and `/admin/…`), so pages like `/administration` stay crawlable.
- **Where checks happen:** the server checks addresses again on publish, so an
  address that clashes with another live page, or belongs to the website
  itself, can't go live.

## Duplicating a page

Pages & Content → **Duplicate** (or **Duplicate this page** in the visual
editor) makes a new page with the same design, sections and content:

- **Built-in pages** (Home, HMS, CMS, About, …): the copy uses the same page
  design (`meta.template` = the original's id). You can change its text,
  images, buttons and lists, rearrange or hide sections and add new ones.
  Changes to the copy never touch the original.
- **Landing pages**: the copy gets the same blocks in the same order.
- If the page has unpublished changes, you choose whether to copy the current
  draft or the live version.
- The copy is a draft at its own address until you publish it. Its search
  title, description, social preview and schema start fresh, so the two pages
  don't compete in search. Robots settings are kept, and a copy of the Thank
  You page stays out of search like the original. Of the original's automatic
  structured data, only the FAQ is carried over, built from the copy's own FAQ.
- Duplicating needs the "Create and delete custom pages" permission.

## Two ways to serve the public site

| | Static hosting (current) | Node site server (recommended) |
|---|---|---|
| How | `npm run build` in `frontend/`, upload `frontend/dist/` | backend with `SITE_DIST` set serves the site |
| Published text/images | visitors get them within seconds (the page checks `/api/content/version`) | server-rendered immediately |
| Search engines / social previews / "view page source" | after the next build - or about a second after publishing with `STATIC_SITE_DIR` (below) | see it immediately |
| Redirect manager | client-side redirects + stub pages | real 301/302/307/308/410 responses |
| robots.txt / sitemap.xml / llms.txt | written at build time - and after every publish with `STATIC_SITE_DIR` | always live |

### Keep static files current after every publish (STATIC_SITE_DIR)

With static hosting, the HTML files contain the content of the build. A new
SEO title or description is applied in the browser after publishing, but
"view page source", Facebook/LinkedIn/WhatsApp previews and other crawlers
that don't run JavaScript keep reading the old file.

If the backend runs on the same server as the website files (kibo360.in and
api.kibo360.in share one server behind Caddy), let the backend rewrite them:

- `STATIC_SITE=1` - the web server serves `frontend/dist` of this repository
- or `STATIC_SITE_DIR=/path/the/web/server/serves` - plus
  `STATIC_SITE_BUNDLE=/path/to/frontend/dist-server` if that folder is a copy
  somewhere else

The backend then rewrites every page's HTML, the redirect pages, sitemap.xml,
robots.txt and llms.txt:

- about a second after each publish (scheduled publishes too);
- when it starts;
- within 30 seconds of a new frontend build being deployed.

Files of deleted or unpublished pages are removed. The user the backend runs
as needs write access to that folder. If writing fails, the Super Admin
dashboard shows an error. Images keep coming from
`STATIC_MEDIA_BASE` (default `https://api.kibo360.in`).

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
| `STATIC_SITE_DIR` | unset | static hosting: folder your web server serves - rewritten after every publish so page source / link previews are current (see above) |
| `STATIC_SITE=1` | unset | shortcut: `STATIC_SITE_DIR=../frontend/dist` |
| `STATIC_SITE_BUNDLE` | `<STATIC_SITE_DIR>/../dist-server` | the build's `dist-server` folder |
| `STATIC_MEDIA_BASE` | `https://api.kibo360.in` | where uploaded images are served for those files |
| `ALLOWED_ORIGINS` | – | extra CORS origins, comma separated (e.g. a staging domain) |
| `SITE_FORM_ACTION` | – | Node site server only: extra `https://` origins (space separated) that forms on the site may post to, e.g. a newsletter form added under Header & footer scripts |
| `KIBO_ADMIN_PASSWORD` | generated | fresh installs only: first Super Admin password. If unset, a random one is printed once in the server log. It must be changed at first sign-in (enforced by the API). |

The backend trusts exactly one reverse proxy for the client IP (`X-Forwarded-For`,
used by login throttling and rate limits). Put it behind one proxy (nginx, a load
balancer) and don't expose its port directly to the internet.

Image optimisation (WebP + responsive sizes, EXIF/GPS removal) uses `sharp`
(installed with `npm install` in `backend/`). Without it uploads still work, unoptimised.

## Keep content when deploying (important)

Everything saved in Super Admin lives in **one folder**, `DATA_DIR` (default
`backend/data`). The code in the repository only holds the built-in default
content. That folder contains:

- drafts, published pages and revisions;
- SEO settings, header/footer scripts and forms;
- uploaded images, leads, chats and admin accounts.

If a deploy starts the backend with an empty data folder, the website goes back
to its default content, all drafts disappear, and the Super Admin password
changes (a new temporary one is printed in the server log).

- **Hosting panel / containers** (Coolify, Dokploy, CapRover, Easypanel, plain
  Docker): every deploy creates a new container. Add **persistent storage (a
  volume)** to the backend app:
  - either mount it at the data folder (e.g. `/app/backend/data`);
  - or mount it anywhere (e.g. `/data`) and set `DATA_DIR=/data`.

  Then redeploy once.
- **VPS with `git pull` + pm2/systemd:** `git pull` keeps `backend/data`, because
  it isn't in git. Never delete or re-upload the whole folder. Safer: move the
  data to a folder outside the app, e.g. `/var/lib/kibo360`, and set
  `DATA_DIR` to it.

### Dokploy (how kibo360.in is deployed)

Backend app:

1. **Advanced → Volumes/Mounts → Volume Mount**:
   - Volume Name `kibo360-data`
   - Mount Path `/data`
2. **Environment**:
   - `DATA_DIR=/data`
   - `KIBO_ADMIN_PASSWORD=<a strong temporary password>` - used only while the
     data folder is still empty; it must be changed at first sign-in.

   Save.
3. **Deploy.** From now on pushes keep all content and the password. The log
   shows `[storage] content is stored in /data (persistent volume at /data)`.

Website app (static, served by Caddy):

4. **Environment**: `CONTENT_API=https://api.kibo360.in`, so every build bakes
   the published titles and descriptions into the HTML. The build log should
   show `content: vN from https://api.kibo360.in`, not "CONTENT_API not set".
5. **Deployments**: copy the **Webhook URL**.

Back in the backend app:

6. **Environment**: `SITE_DEPLOY_HOOK=<that webhook URL>` and
   `SITE_DEPLOY_BRANCH=<the website app's branch, e.g. main>`, then **Deploy**.
   Publishing in Super Admin now rebuilds the website about 15 seconds later
   (at most once a minute). "View page source" and link previews follow within
   a minute or two. If the rebuild request fails, the dashboard says so.

The backend checks storage at every start. If the data folder is inside a container
without a volume, the log prints a large warning, and the Super Admin dashboard
shows "Your content will be erased on the next deploy" to people who manage the
team.

Before changing anything on the server, make a copy of the data folder.

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
