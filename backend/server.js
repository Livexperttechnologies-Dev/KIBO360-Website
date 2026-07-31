import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5001;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "submissions.json");

function loadSubmissions() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveSubmissions(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}

const app = express();
app.use(cors({ origin: ["http://localhost:3001", "http://127.0.0.1:3001"] }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kibo360-backend", time: new Date().toISOString() });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

app.post("/api/contact", (req, res) => {
  const { name, email, phone, organization, product, message } = req.body || {};
  const errors = {};

  if (!name || !String(name).trim()) errors.name = "Name is required.";
  if (!email || !EMAIL_RE.test(String(email).trim())) errors.email = "A valid email is required.";
  if (!message || !String(message).trim()) errors.message = "Message is required.";

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  const submission = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    name: String(name).trim().slice(0, 200),
    email: String(email).trim().slice(0, 200),
    phone: String(phone || "").trim().slice(0, 40),
    organization: String(organization || "").trim().slice(0, 200),
    product: String(product || "General").trim().slice(0, 80),
    message: String(message).trim().slice(0, 5000),
  };

  const list = loadSubmissions();
  list.push(submission);
  saveSubmissions(list);

  console.log(`[contact] ${submission.receivedAt} — ${submission.name} <${submission.email}> (${submission.product})`);
  res.status(201).json({ ok: true, id: submission.id });
});

// Dev aid: view stored submissions
app.get("/api/submissions", (_req, res) => {
  res.json({ ok: true, count: loadSubmissions().length, submissions: loadSubmissions() });
});

app.listen(PORT, () => {
  console.log(`KIBO360 backend running at http://localhost:${PORT}`);
});
