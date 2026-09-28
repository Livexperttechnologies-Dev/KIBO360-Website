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
- **Documents:** `site` (header, footer, menus, banners, settings), `seo`
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
3. Build and start staging (either mode above) on e.g. `staging.kibo360.in`, add
   it to `ALLOWED_ORIGINS` if the API runs on another host.
4. Sign in at `/admin` with the super admin account. Accounts with the old password
   format are upgraded to scrypt automatically at their next sign-in. New team
   members must set their own password at first sign-in. Sessions stay alive
   while someone is working (12 h idle timeout, 7 day maximum); if one expires
   mid-edit, Super Admin asks for the password again and keeps unsaved changes.
5. Walk through: edit a page → Preview link → Publish → check the live page; SEO →
   Health check; upload an image; submit the demo form and find it under Leads.
6. When staging looks right, deploy the same build to production.

## Permissions

Roles (Team Access → Roles & Permissions): Super Admin, Website Admin, Content
Manager, SEO Manager, Marketing Manager, Viewer, plus custom roles. Editing and
publishing are separate permissions for pages, SEO, site settings and forms; every
API route checks them on the server, and every change is written to the audit log
(Change History).

## Developer notes

- Isolated local test: `KIBO_DEV_PORT=4600 KIBO_API_TARGET=http://localhost:5098 npm run dev`
  in `frontend/` with a backend started as `PORT=5098 DATA_DIR=<copy of data> node server.js`.
- `backend/lib/sanitize.js` and `frontend/src/cms/sanitize.js` must stay identical
  (a test checks this) - the same sanitizer runs in the browser, SSR and the API.
- New editable content in code: wrap text in `<T k="…">`, rich text in `<R k="…">`,
  images in `<Img k="…">`, buttons in `<Btn k="…">`, repeating items in `<List>`,
  page sections in `<Sec id="…">` inside `<Sections>`. Keys must stay stable -
  renaming a key orphans its saved edits.
