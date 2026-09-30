#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Super Admin account recovery - run it ON THE SERVER, in the same
// environment as the running backend (same machine / container, same
// DATA_DIR), from the backend/ folder.
//
//   npm run admin -- status
//       Which data folder is used, which accounts exist and their state, and
//       whether the old leads/chats are there. Never prints password hashes.
//
//   npm run admin -- reset-password [email] [--create]
//       Sets a new TEMPORARY password (printed once), re-activates the account
//       and signs out its sessions. The person chooses their own password at
//       the next sign-in. Without an email the Super Admin is reset.
//       --create   allow creating the Super Admin / data folder when missing
//                  (normally a sign you are pointing at the wrong folder).
//       --password <pw>   use this instead of a generated one (avoid: it ends
//                  up in shell history and npm logs).
//
// Uses DATA_DIR when set, otherwise backend/data.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createStore } from "../lib/store.js";
import { hashPassword, verifyPassword, passwordProblem, newId } from "../lib/security.js";
import { SUPER_ADMIN_EMAIL } from "../lib/auth.js";

const OLD_DEFAULT_PASSWORD = "Kibo360@Admin"; // published in the old server's source

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(here, "..", "data"));
const [cmd, ...rest] = process.argv.slice(2);
const where = `Data folder: ${dataDir}${process.env.DATA_DIR ? " (from DATA_DIR)" : " (default - if the server runs with DATA_DIR, set the same value here)"}`;

function usage(code = 0) {
  console.log(`Usage:
  npm run admin -- status
  npm run admin -- reset-password [email] [--create] [--password <pw>]

${where}`);
  process.exit(code);
}
const die = (msg) => { console.error(`\n${msg}`); process.exit(1); };

/** Readable but strong temporary password, e.g. "Kibo-7hQx-2mPa-9vLc". */
function tempPassword() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const group = () => Array.from(crypto.randomBytes(4), (b) => abc[b % abc.length]).join("");
  let pw;
  do pw = `Kibo-${group()}-${group()}-${group()}`; while (passwordProblem(pw));
  return pw;
}

const hashFormat = (h) => (typeof h !== "string" || !h ? "none" : h.startsWith("scrypt$") ? "current (scrypt)" : /^[a-f0-9]{64}$/.test(h) ? "old format (upgraded at next sign-in)" : "unknown");
const count = (store, rel) => { try { const v = store.readJson(rel, null); return Array.isArray(v) ? v.length : v ? 1 : 0; } catch (e) { return `unreadable (${e.code || e.message})`; } };
const looksLikeServerData = (dir) => ["users.json", "sessions.json", "settings.json", "content", "leads.json", "submissions.json"].some((n) => fs.existsSync(path.join(dir, n)));

function readUsers(store) {
  let users;
  try { users = store.readJson("users.json", null); } catch (e) { die(`users.json cannot be read (${e.message}). Nothing was changed.`); }
  if (users != null && !Array.isArray(users)) die("users.json does not contain a list of accounts - fix or restore it from users.json.bak. Nothing was changed.");
  return users || [];
}

function status() {
  console.log(where);
  if (!fs.existsSync(dataDir)) { console.log("\nThis folder does not exist. If the server really uses it, it will create a new Super Admin at start-up (temporary password printed once in the server log)."); return; }
  const store = createStore(dataDir);
  const users = readUsers(store);
  console.log(`Leads: ${count(store, "leads.json")} · form submissions: ${count(store, "submissions.json")} · chats: ${count(store, "chats.json")} · media files: ${count(store, "media.json")}`);
  if (!users.length) {
    console.log("\nNo accounts yet - the server creates a Super Admin at start-up and prints its temporary password once in the server log.");
    return;
  }
  console.log(`\n${users.length} account(s):`);
  for (const u of users) {
    const role = u.roleId || (u.role ? `${u.role} (migrated at the next server start)` : "?");
    const flags = [u.active === false ? "DEACTIVATED" : "active", u.mustChangePassword ? "must choose a new password at next sign-in" : null].filter(Boolean).join(", ");
    const publicDefault = verifyPassword(OLD_DEFAULT_PASSWORD, u.passwordHash).ok;
    console.log(`- ${u.email || "(no email)"}  role: ${role}  ${flags}\n    password: ${hashFormat(u.passwordHash)} · last sign-in: ${u.lastLoginAt || "never (with the new admin)"} · created: ${u.createdAt || "?"}`);
    if (publicDefault) console.log("    WARNING: still uses the old public default password - it must be changed at the next sign-in; reset it now if you didn't set it.");
  }
  console.log("\nIf the right password gets \"Too many failed attempts\", restart the server (that pause is kept in memory) or wait.");
}

function resetPassword(args) {
  let email = null;
  let pw = null;
  let create = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--password") pw = args[++i];
    else if (args[i].startsWith("--password=")) pw = args[i].slice("--password=".length);
    else if (args[i] === "--create") create = true;
    else if (!args[i].startsWith("--")) email = args[i].trim().toLowerCase();
    else usage(1);
  }
  console.log(where);
  if (pw != null) {
    const problem = pw === OLD_DEFAULT_PASSWORD ? "that password is publicly known - choose another" : passwordProblem(pw);
    if (problem) die(`Password rejected: ${problem}.`);
  }
  if (!create && (!fs.existsSync(dataDir) || !looksLikeServerData(dataDir))) {
    die("This folder does not look like the server's data folder (no users.json, sessions.json or content).\nRun this in the same place/container as the server, with the same DATA_DIR - or add --create if you really want a new account here.");
  }

  const password = pw || tempPassword();
  const hash = hashPassword(password); // slow part first, then a quick read-modify-write
  const store = createStore(dataDir);
  const isOwner = (u) => String(u.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
  const isSuper = (u) => u.roleId === "superadmin" || u.role === "superadmin";

  const apply = () => {
    const users = readUsers(store);
    let user = email ? users.find((u) => String(u.email || "").toLowerCase() === email) : users.find(isSuper) || users.find(isOwner);
    let created = false;
    if (!user) {
      if (email && email !== SUPER_ADMIN_EMAIL) die(`No account with the email ${email}. Run "npm run admin -- status" to list accounts.`);
      if (users.some(isSuper)) die(`${email} is not the Super Admin account here. Run without an email to reset the existing Super Admin.`);
      if (!create) die("There is no Super Admin in this folder. If this is really the server's folder, run again with --create.");
      user = { id: newId("u_"), email: SUPER_ADMIN_EMAIL, name: "Super Admin", roleId: "superadmin", extraPermissions: [], createdAt: new Date().toISOString() };
      users.push(user);
      created = true;
    }
    if (isOwner(user) && !isSuper(user) && !users.some((u) => u !== user && isSuper(u))) user.roleId = "superadmin"; // restore the owner's role
    user.passwordHash = hash;
    user.mustChangePassword = true;
    user.active = true;
    user.sessionEpoch = (user.sessionEpoch || 0) + 1; // signs out existing sessions
    user.passwordChangedAt = new Date().toISOString();
    delete user.sessionsNotBefore;
    store.writeJson("users.json", users, { backup: true });
    return { user, created };
  };

  const { user, created } = apply();
  // A server request that was mid-way through its own write could overwrite
  // ours with a stale copy - check that the reset stuck, re-apply if not.
  const settle = Date.now() + 1500;
  while (Date.now() < settle) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  const now = readUsers(store).find((u) => u.id === user.id);
  if (!now || !verifyPassword(password, now.passwordHash).ok) { console.log("(the server wrote at the same moment - applying again)"); apply(); }

  try {
    store.appendLine("audit.jsonl", { at: new Date().toISOString(), action: "auth.password_reset_cli", target: user.email, userId: null, userEmail: null, userName: "Server console", ip: null, details: created ? { created: true } : null });
  } catch { /* audit is best effort */ }

  console.log(`\n${created ? "Created the Super Admin" : "Password reset for"} ${user.email}.`);
  if (!pw) console.log(`Temporary password: ${password}`);
  console.log("Sign in at /admin with it - you will choose your own password straight away.");
  console.log("Existing sessions of this account are signed out.");
  console.log("If sign-in says \"Too many failed attempts\", restart the server once (that pause is kept in memory).");
}

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") usage(0);
else if (cmd === "status") status();
else if (cmd === "reset-password") resetPassword(rest);
else usage(1);
