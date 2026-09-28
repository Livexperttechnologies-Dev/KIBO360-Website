// ---------------------------------------------------------------------------
// Role-based access control. Every admin endpoint checks one of these keys
// server-side; the UI only hides what the server would refuse anyway.
// Editing and publishing are always separate permissions.
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  { key: "dashboard.view", group: "General", label: "View dashboard" },

  { key: "pages.view", group: "Pages & Content", label: "View pages and drafts" },
  { key: "pages.edit", group: "Pages & Content", label: "Edit page drafts" },
  { key: "pages.publish", group: "Pages & Content", label: "Publish / schedule / unpublish pages" },
  { key: "pages.create", group: "Pages & Content", label: "Create and delete custom pages" },

  { key: "media.view", group: "Media Library", label: "Browse media" },
  { key: "media.upload", group: "Media Library", label: "Upload and replace media" },
  { key: "media.edit", group: "Media Library", label: "Edit media details" },
  { key: "media.delete", group: "Media Library", label: "Delete media" },

  { key: "seo.view", group: "SEO", label: "View SEO data and reports" },
  { key: "seo.edit", group: "SEO", label: "Edit SEO drafts (pages, redirects, robots, schema)" },
  { key: "seo.publish", group: "SEO", label: "Publish SEO changes" },

  { key: "site.edit", group: "Website", label: "Edit header, footer, menus, banners, settings" },
  { key: "site.publish", group: "Website", label: "Publish header, footer, menus, banners, settings" },

  { key: "forms.edit", group: "Forms & Leads", label: "Edit form drafts" },
  { key: "forms.publish", group: "Forms & Leads", label: "Publish forms" },
  { key: "submissions.view", group: "Forms & Leads", label: "View form submissions" },
  { key: "leads.view", group: "Forms & Leads", label: "View leads" },
  { key: "leads.edit", group: "Forms & Leads", label: "Update leads (status, notes, owner)" },
  { key: "leads.delete", group: "Forms & Leads", label: "Delete leads and submissions" },
  { key: "leads.export", group: "Forms & Leads", label: "Export leads (CSV)" },

  { key: "chats", group: "Chat & Support", label: "Live chat with visitors" },
  { key: "chatbot", group: "Chat & Support", label: "Chatbot settings" },
  { key: "whatsapp", group: "Chat & Support", label: "WhatsApp settings" },
  { key: "notifications", group: "Chat & Support", label: "Email notification settings" },

  { key: "users.manage", group: "Administration", label: "Manage team members" },
  { key: "roles.manage", group: "Administration", label: "Manage roles and permissions" },
  { key: "audit.view", group: "Administration", label: "View change history (audit log)" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
const ALL = new Set(PERMISSION_KEYS);
const views = PERMISSION_KEYS.filter((k) => k.endsWith(".view"));

export const BUILTIN_ROLES = [
  {
    id: "superadmin",
    name: "Super Admin",
    description: "Full access to everything, including team and role management. Cannot be restricted.",
    builtin: true,
    locked: true,
    permissions: PERMISSION_KEYS,
  },
  {
    id: "website_admin",
    name: "Website Admin",
    description: "Runs the whole website: content, media, SEO, navigation, forms and publishing. No team/role management.",
    builtin: true,
    permissions: PERMISSION_KEYS.filter((k) => !["users.manage", "roles.manage"].includes(k)),
  },
  {
    id: "content_manager",
    name: "Content Manager",
    description: "Edits page content and media. Cannot publish.",
    builtin: true,
    permissions: ["dashboard.view", "pages.view", "pages.edit", "pages.create", "media.view", "media.upload", "media.edit", "seo.view"],
  },
  {
    id: "seo_manager",
    name: "SEO Manager",
    description: "Manages and publishes SEO: metadata, schema, redirects, robots.txt and sitemap.",
    builtin: true,
    permissions: ["dashboard.view", "pages.view", "media.view", "seo.view", "seo.edit", "seo.publish"],
  },
  {
    id: "marketing_manager",
    name: "Marketing Manager",
    description: "Edits and publishes pages, banners, forms; works leads and live chat.",
    builtin: true,
    permissions: [
      "dashboard.view", "pages.view", "pages.edit", "pages.publish", "pages.create",
      "media.view", "media.upload", "media.edit", "seo.view",
      "site.edit", "site.publish", "forms.edit", "forms.publish",
      "submissions.view", "leads.view", "leads.edit", "leads.export", "chats", "chatbot",
    ],
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to the dashboard, pages, media, SEO and leads.",
    builtin: true,
    permissions: [...views, "submissions.view"],
  },
];

/** Legacy per-user flags from the old admin -> new permission keys. */
export const LEGACY_MAP = {
  leads: ["leads.view", "leads.edit", "leads.delete", "leads.export", "submissions.view"],
  chats: ["chats"],
  whatsapp: ["whatsapp"],
  chatbot: ["chatbot"],
  notifications: ["notifications"],
};

export function cleanPermissionList(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((k) => ALL.has(k)))];
}

/** Effective permission set for a user given the role table. */
export function effectivePermissions(user, roles) {
  if (!user) return new Set();
  if (user.roleId === "superadmin") return new Set(PERMISSION_KEYS);
  const role = roles.find((r) => r.id === user.roleId);
  const perms = new Set(role ? cleanPermissionList(role.permissions) : []);
  for (const k of cleanPermissionList(user.extraPermissions)) perms.add(k);
  return perms;
}
