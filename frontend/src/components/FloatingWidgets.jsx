import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useDemoModal } from "./DemoModalContext.jsx";
import { company } from "../data/siteData.js";
import { API_BASE } from "../lib/apiBase.js";

// ---------------------------------------------------------------------------
// Floating WhatsApp button (bottom-left) + chatbot (bottom-right).
// The bot answers instantly from built-in knowledge; every conversation is
// also synced to the backend so support users can watch and reply live from
// the admin console. Once a human agent replies, the auto-bot steps aside.
// Config comes from /api/settings (managed in the admin panel); sensible
// defaults apply when the backend is unreachable.
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  whatsapp: { enabled: true, number: "918008005672", greeting: "Hi! I'd like to know more about KIBO360." },
  chatbot: {
    enabled: true,
    botName: "Kibo Assistant",
    welcome: "Hi! I'm your KIBO360 assistant. Ask me about our products or pricing - or I can book your free demo right here in the chat.",
    quickReplies: null, // null -> built-in QUICK_REPLIES
    fallback: null,     // null -> built-in fallback text
    intents: null,      // null -> built-in INTENTS
    customFaqs: [],
    nudgeSeconds: 30,
    nudgeDefault: null,
    nudges: null,
  },
};

const QUICK_REPLIES = ["Our Products", "Book a Demo", "Pricing", "HMS", "CMS", "Talk to Support"];

// Offline fallback knowledge - the served copy lives in the backend settings
// (admin console -> Chatbot) and takes priority when reachable.
const INTENTS = [
  {
    keywords: ["hello", "hi", "hey", "namaste", "good morning", "good afternoon", "good evening"],
    answer:
      "Hello! Great to have you here. I can walk you through our products, share how pricing works, or book your free demo right in this chat. What would you like to do?",
    actions: [
      { label: "View Products", type: "link", href: "/products" },
      { label: "Book a Free Demo", type: "demo" },
    ],
  },
  {
    keywords: ["product", "solution", "software", "what do you", "offer", "our products"],
    answer:
      "Kibo360 puts your whole business on one platform:\n• HMS - complete Hospital Management Software (live)\n• CMS - Clinical Management System for clinics (live)\n• ERP, CRM, LIS and Inventory - launching soon\n\nEvery product shares one intelligent database, so your teams stop juggling disconnected tools - and you simply add products as you grow.",
    actions: [
      { label: "View All Products", type: "link", href: "/products" },
      { label: "Book a Free Demo", type: "demo" },
    ],
  },
  {
    keywords: ["hms", "hospital"],
    answer:
      "KIBO360 HMS runs your entire hospital on one intelligent database - OPD/IPD, EMR/EHR, diagnostics, pharmacy, billing, finance, HR & payroll and AI-powered analytics, with ABHA health IDs built in. Want to see it working on your own workflows?",
    actions: [
      { label: "Explore HMS", type: "link", href: "/products/hms" },
      { label: "Book a Free Demo", type: "demo" },
    ],
  },
  {
    keywords: ["cms", "clinic"],
    answer:
      "KIBO360 CMS keeps your clinic running smoothly - appointments, queue & token, doctor EMR, e-prescriptions, GST billing, pharmacy and WhatsApp reminders. Most clinics go live within days, and you can upgrade to the full HMS anytime without migrating data.",
    actions: [
      { label: "Explore CMS", type: "link", href: "/products/cms" },
      { label: "Book a Free Demo", type: "demo" },
    ],
  },
  {
    keywords: ["price", "pricing", "cost", "charges", "fees", "quote", "subscription", "plan"],
    answer:
      "Fair question! Pricing depends on your facility's size and the modules you pick, so we prepare a personalised quote for every customer. Book a free demo right here in the chat and you'll have your tailored quote within one business day.",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
  {
    keywords: ["demo", "book", "trial", "see it", "appointment"],
    answer:
      "Excellent choice! I can book your free demo right here in the chat - I'll just ask for a few details and your preferred date and time. Ready when you are!",
    actions: [{ label: "Book My Demo", type: "demo" }],
  },
  {
    keywords: ["contact", "support", "help", "talk", "human", "agent", "team", "call", "phone", "email"],
    answer: `Our team is happy to help:\n• Call ${company.phone}\n• Email ${company.email}\n• Or message us on WhatsApp\n\nYou can also simply keep typing here - our support team sees this chat and can jump in anytime.`,
    actions: [
      { label: "WhatsApp Us", type: "wa" },
      { label: `Call ${company.phone}`, type: "tel" },
      { label: "Book a Free Demo", type: "demo" },
    ],
  },
  {
    keywords: ["certif", "iso", "cmmi", "quality"],
    answer:
      "We take quality seriously. Livexpert Technologies is ISO 9001:2015 certified for Quality Management Systems and appraised at CMMI Level 3, and Kibo360 holds ABHA certification. You'll find the details on our About page.",
    actions: [{ label: "About Us", type: "link", href: "/about" }],
  },
  {
    keywords: ["abha", "compliance", "secure", "security", "data", "privacy"],
    answer:
      "Your data is in safe hands. Kibo360 is ABHA certified and protects every record with AES-256 encryption, role-based access, two-factor authentication, full audit logs and disaster recovery.",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
  {
    keywords: ["address", "location", "office", "where"],
    answer: `You'll find us at ${company.address}. Drop by any time - or book a demo and we'll bring Kibo360 to you, virtually!`,
    actions: [{ label: "Contact Us", type: "link", href: "/contact" }],
  },
  {
    keywords: ["thank", "thanks", "great", "ok", "okay"],
    answer: "You're most welcome! Anything else I can help with - products, pricing, or a quick demo?",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
];

// Admin-managed intents (settings.chatbot.intents) take priority; the built-in
// INTENTS above are only the offline fallback when the backend is unreachable.
function matchIntent(text, chatbot) {
  const q = text.toLowerCase();
  for (const f of chatbot.customFaqs || []) {
    const kws = String(f.keywords || f.q || "").toLowerCase().split(",").map((k) => k.trim()).filter(Boolean);
    if (kws.some((k) => k && q.includes(k))) return { answer: f.a, actions: [] };
  }
  const intents = chatbot.intents?.length
    ? chatbot.intents.map((i) => ({
        keywords: Array.isArray(i.keywords)
          ? i.keywords
          : String(i.keywords || "").toLowerCase().split(",").map((k) => k.trim()).filter(Boolean),
        answer: i.answer,
        actions: i.actions || [],
      }))
    : INTENTS;
  for (const intent of intents) {
    if (intent.keywords.some((k) => q.includes(k))) return intent;
  }
  return {
    answer:
      chatbot.fallback ||
      "That's a good question - and our team will have the answer! I've shared your message with them. Meanwhile I can book you a demo right here in chat, or you can reach us on WhatsApp or by phone.",
    actions: [
      { label: "Book a Free Demo", type: "demo" },
      { label: "WhatsApp Us", type: "wa" },
      { label: `Call ${company.phone}`, type: "tel" },
    ],
  };
}

// Proactive nudge shown when a visitor lingers on a page for 30 seconds
const NUDGES = [
  { path: "/products/hms", text: "I see you're exploring KIBO360 HMS! Ask me anything - modules, pricing, implementation - or I can book you a quick demo right here." },
  { path: "/products/cms", text: "Checking out our Clinical Management System? Happy to answer anything - features, pricing, go-live time - or book you a quick demo right here." },
  { path: "/products", text: "Finding the right fit? Tell me a little about your organisation and I'll point you to the right product - or show you everything in a quick demo." },
  { path: "/contact", text: "Need a hand reaching us? I can connect you with the team right here in chat, or book you a demo at a time that suits you." },
  { path: "/about", text: "Getting to know Kibo360? Ask me anything about the platform, our certifications, or the team behind it." },
];
const NUDGE_DEFAULT = "Welcome to Kibo360! Can I help you find the right solution for your business - or book you a free demo right here in the chat?";

// In-chat demo booking wizard
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_SLOTS = ["10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM"];
const dateChips = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + 1 + i);
    return {
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
      type: "wizard",
      value: d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    };
  });
const timeChips = () => TIME_SLOTS.map((t) => ({ label: t, type: "wizard", value: t }));

function getVisitorId() {
  try {
    let id = localStorage.getItem("kibo360-visitor-id");
    if (!id || !/^[a-z0-9-]{10,64}$/i.test(id)) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
      localStorage.setItem("kibo360-visitor-id", id);
    }
    return id;
  } catch {
    return `v-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function WhatsAppGlyph({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.1.6 4.1 1.6 5.9L4 29l8.4-1.6c1.7.9 3.6 1.4 5.6 1.4 6.6 0 12-5.3 12-11.9S22.6 3 16 3Zm0 21.8c-1.8 0-3.5-.5-5-1.3l-.4-.2-5 1 1-4.8-.3-.4a9.7 9.7 0 0 1-1.5-5.2c0-5.4 4.5-9.9 10.1-9.9s10.1 4.4 10.1 9.9c.1 5.4-4.4 9.9-10 9.9Zm5.5-7.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1-1.1 2.5s1.1 2.9 1.3 3.1c.2.2 2.2 3.4 5.4 4.7.8.3 1.4.5 1.8.7.8.2 1.5.2 2 .1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4Z" />
    </svg>
  );
}

export default function FloatingWidgets() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {from:"bot"|"user"|"agent", text, name?, actions?}
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [agentOnline, setAgentOnline] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);
  const [started, setStarted] = useState(() => {
    try { return localStorage.getItem("kibo360-chat-started") === "1"; } catch { return false; }
  });
  const [booking, setBooking] = useState(null); // { step, data } while the demo wizard runs
  const bookingRef = useRef(null);
  useEffect(() => { bookingRef.current = booking; }, [booking]);
  const { openDemo } = useDemoModal();
  const { pathname } = useLocation();
  const bodyRef = useRef(null);
  const visitorIdRef = useRef(getVisitorId());
  // Cursor = how many server messages we've already seen. Persisted so a page
  // reload doesn't re-count the whole history as "new" (phantom unread badge).
  const cursorRef = useRef((() => {
    try { const v = Number(localStorage.getItem("kibo360-chat-cursor")); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; }
  })());
  const cursorKnownRef = useRef(cursorRef.current > 0);
  // Visitors who chatted before cursor persistence existed: baseline once
  // instead of replaying their whole history as "new". A visitor with no
  // local chat at all (agent reached out proactively) must NOT baseline -
  // the agent's message is genuinely new to them.
  const legacyRef = useRef(cursorRef.current === 0 && (() => {
    try { return localStorage.getItem("kibo360-chat-started") === "1"; } catch { return false; }
  })());
  const startedRef = useRef(false);     // does a server-side chat session exist?
  const openRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const pollBusyRef = useRef(false);
  const pendingRef = useRef([]);        // messages that failed to sync, retried later

  const setCursor = (n) => {
    cursorRef.current = n;
    cursorKnownRef.current = true;
    try { localStorage.setItem("kibo360-chat-cursor", String(n)); } catch { /* ignore */ }
  };
  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    try { localStorage.setItem("kibo360-chat-started", "1"); } catch { /* ignore */ }
  };

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { startedRef.current = started; }, [started]);

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setConfig({ whatsapp: { ...DEFAULT_CONFIG.whatsapp, ...d.whatsapp }, chatbot: { ...DEFAULT_CONFIG.chatbot, ...d.chatbot } });
      })
      .catch(() => { /* offline: keep defaults */ });
  }, []);

  // Presence heartbeat: lets the team see live visitors (count, page, location)
  useEffect(() => {
    const ping = () => {
      fetch(`${API_BASE}/api/presence/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: visitorIdRef.current, page: window.location.pathname }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.ok) return;
          setAgentOnline(!!d.agentOnline);
          // An agent proactively opened a chat with this visitor: start
          // polling so their message pops up in the widget.
          if (d.hasChat) markStarted();
        })
        .catch(() => { /* offline */ });
    };
    ping();
    const iv = setInterval(ping, 15000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull new messages from the server (agent replies appear here)
  useEffect(() => {
    if (!started && !open) return undefined;
    const poll = () => {
      if (!startedRef.current || pollBusyRef.current || (open && !historyLoadedRef.current)) return;
      pollBusyRef.current = true;
      const requestAfter = cursorRef.current;
      fetch(`${API_BASE}/api/chat/messages?visitorId=${encodeURIComponent(visitorIdRef.current)}&after=${requestAfter}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.ok) return;
          // Discard stale responses: something else (send, restore) moved the
          // cursor while this request was in flight.
          if (cursorRef.current !== requestAfter) return;
          setAgentOnline(!!d.agentOnline);
          setAgentJoined(!!d.agentJoined);
          const baseline = !cursorKnownRef.current && requestAfter === 0 && legacyRef.current;
          legacyRef.current = false;
          setCursor(d.total);
          if (baseline) return; // pre-update visitor: don't replay their history as "new"
          const fresh = (d.messages || []).filter((m) => m.from === "agent");
          if (fresh.length > 0) {
            setMessages((m) => [...m, ...fresh.map((f) => ({ from: "agent", name: f.name, text: f.text }))]);
            if (!openRef.current) setUnread((u) => u + fresh.length);
          }
        })
        .catch(() => { /* offline */ })
        .finally(() => { pollBusyRef.current = false; flushPending(); });
    };
    poll();
    const iv = setInterval(poll, open ? 3500 : 12000);
    return () => clearInterval(iv);
  }, [open, started]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore the conversation after a reload so the thread continues
  useEffect(() => {
    if (!open || historyLoadedRef.current) return;
    if (!startedRef.current) {
      historyLoadedRef.current = true;
      setMessages((m) => (m.length === 0 ? [{ from: "bot", text: config.chatbot.welcome }] : m));
      return;
    }
    const fallback = () => {
      historyLoadedRef.current = false; // retry on the next open
      setMessages((m) => (m.length === 0 ? [{ from: "bot", text: config.chatbot.welcome }] : m));
    };
    historyLoadedRef.current = true;
    fetch(`${API_BASE}/api/chat/messages?visitorId=${encodeURIComponent(visitorIdRef.current)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.ok) { fallback(); return; }
        setCursor(d.total);
        setAgentJoined(!!d.agentJoined);
        setAgentOnline(!!d.agentOnline);
        const restored = (d.messages || []).map((m) => ({
          from: m.from === "visitor" ? "user" : m.from,
          name: m.name,
          text: m.text,
        }));
        setMessages([{ from: "bot", text: config.chatbot.welcome }, ...restored]);
      })
      .catch(fallback);
  }, [open, config.chatbot.welcome]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Proactive engagement: after 30s on one page (once per browser session),
  // the bot opens with a page-aware message. Skipped when the visitor already
  // chats with us, has the panel open, or the demo popup is showing.
  useEffect(() => {
    if (!config.chatbot.enabled) return undefined;
    const delayMs = Math.max(5, Number(config.chatbot.nudgeSeconds) || 30) * 1000;
    const t = setTimeout(() => {
      try { if (sessionStorage.getItem("kibo360-bot-nudged") === "1") return; } catch { /* ignore */ }
      if (openRef.current || startedRef.current || document.querySelector(".modal-overlay")) return;
      try { sessionStorage.setItem("kibo360-bot-nudged", "1"); } catch { /* ignore */ }
      const rules = config.chatbot.nudges?.length ? config.chatbot.nudges : NUDGES;
      const nudge =
        rules.find((n) => n.path && pathname.startsWith(n.path))?.text ||
        config.chatbot.nudgeDefault || NUDGE_DEFAULT;
      setMessages((m) => [
        ...m,
        { from: "bot", text: nudge, actions: [{ label: "Book a Free Demo", type: "demo" }] },
      ]);
      setOpen(true);
    }, delayMs);
    return () => clearTimeout(t);
  }, [pathname, config.chatbot]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const waHref = `https://wa.me/${config.whatsapp.number}?text=${encodeURIComponent(config.whatsapp.greeting)}`;

  const postMessage = (from, text) =>
    fetch(`${API_BASE}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: visitorIdRef.current, from, text, page: window.location.pathname }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

  const syncMessage = async (from, text) => {
    markStarted();
    const d = await postMessage(from, text);
    if (!d) {
      // Backend unreachable or throttled: queue so support still gets it later
      if (pendingRef.current.length < 20) pendingRef.current.push({ from, text });
    }
    return d;
  };

  const flushPending = async () => {
    while (pendingRef.current.length > 0) {
      const next = pendingRef.current[0];
      const d = await postMessage(next.from, next.text); // eslint-disable-line no-await-in-loop
      if (!d) return; // still down - keep the queue for the next poll tick
      pendingRef.current.shift();
    }
  };

  const botSay = (text, actions = []) => {
    setMessages((m) => [...m, { from: "bot", text, actions }]);
    syncMessage("bot", text);
  };

  const submitBooking = (data) => {
    botSay("One moment - booking your demo…");
    fetch(`${API_BASE}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone || "",
        organization: data.organization || "",
        product: "Demo Booking (Chat)",
        message: `Demo booked via the chatbot for ${data.date} at ${data.time}.`,
        preferredDate: data.date,
        preferredTime: data.time,
      }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok && d.ok })))
      .then(({ ok }) => {
        if (ok) {
          setBooking(null);
          botSay(
            `You're booked, ${data.name}! We've noted ${data.date} at ${data.time}. Our team will confirm on ${data.email}${data.phone ? ` or ${data.phone}` : ""} shortly. Anything else I can help with?`
          );
        } else {
          botSay("Hmm, that didn't go through. Want to try again?", [
            { label: "Try Again", type: "wizard", value: "confirm" },
            { label: "Cancel", type: "wizard", value: "cancel" },
          ]);
        }
      })
      .catch(() =>
        botSay("I couldn't reach the server just now. Want to try again?", [
          { label: "Try Again", type: "wizard", value: "confirm" },
          { label: "Cancel", type: "wizard", value: "cancel" },
        ])
      );
  };

  const handleBookingInput = (raw) => {
    const b = bookingRef.current;
    if (!b) return;
    const text = String(raw).trim();
    const lower = text.toLowerCase();
    if (lower === "cancel") {
      setBooking(null);
      botSay("No problem - booking cancelled. Ask me anything else, or type 'book a demo' whenever you're ready.");
      return;
    }
    if (lower === "restart") {
      setBooking({ step: "name", data: {} });
      botSay("Sure, let's start over. What's your name?");
      return;
    }
    const data = { ...b.data };
    switch (b.step) {
      case "name":
        if (text.length < 2) { botSay("Could you share your name? (or type 'cancel' to stop)"); return; }
        data.name = text.slice(0, 120);
        setBooking({ step: "email", data });
        botSay(`Nice to meet you, ${data.name}! What's your email address?`);
        return;
      case "email":
        if (!EMAIL_RE.test(text)) { botSay("That doesn't look like an email address - could you check it? (or type 'cancel')"); return; }
        data.email = text.slice(0, 200);
        setBooking({ step: "phone", data });
        botSay("Got it. What's your phone number? (type 'skip' to leave it out)");
        return;
      case "phone":
        data.phone = lower === "skip" ? "" : text.slice(0, 40);
        setBooking({ step: "organization", data });
        botSay("Which hospital, clinic or organisation are you from? (or type 'skip')");
        return;
      case "organization":
        data.organization = lower === "skip" ? "" : text.slice(0, 200);
        setBooking({ step: "date", data });
        botSay("What date works best for your demo? Pick one below or type a date:", dateChips());
        return;
      case "date":
        if (text.length < 3) { botSay("Please pick a date below or type one:", dateChips()); return; }
        data.date = text.slice(0, 60);
        setBooking({ step: "time", data });
        botSay("And what time suits you?", timeChips());
        return;
      case "time":
        if (text.length < 2) { botSay("Please pick a time below or type one:", timeChips()); return; }
        data.time = text.slice(0, 40);
        setBooking({ step: "confirm", data });
        botSay(
          `Here's your demo booking:\n• Name: ${data.name}\n• Email: ${data.email}\n• Phone: ${data.phone || "-"}\n• Organisation: ${data.organization || "-"}\n• Date: ${data.date}\n• Time: ${data.time}\n\nShall I confirm it?`,
          [
            { label: "Confirm Booking", type: "wizard", value: "confirm" },
            { label: "Start Over", type: "wizard", value: "restart" },
            { label: "Cancel", type: "wizard", value: "cancel" },
          ]
        );
        return;
      case "confirm":
        if (lower === "confirm" || lower === "yes" || lower === "ok" || lower === "okay") { submitBooking(data); return; }
        botSay("Tap Confirm Booking to finish, Start Over to re-enter details, or Cancel to stop.", [
          { label: "Confirm Booking", type: "wizard", value: "confirm" },
          { label: "Start Over", type: "wizard", value: "restart" },
          { label: "Cancel", type: "wizard", value: "cancel" },
        ]);
        return;
      default:
        setBooking(null);
    }
  };

  const startBooking = () => {
    if (bookingRef.current) return;
    setBooking({ step: "name", data: {} });
    botSay("Great - let's book your free demo right here! First, what's your name? (type 'cancel' anytime to stop)");
  };

  const runAction = (a) => {
    if (a.type === "demo") { startBooking(); }
    else if (a.type === "wizard") {
      setMessages((m) => [...m, { from: "user", text: a.label || a.value }]);
      syncMessage("visitor", a.label || a.value);
      handleBookingInput(a.value);
    }
    else if (a.type === "wa") window.open(waHref, "_blank", "noopener");
    else if (a.type === "tel") window.location.href = `tel:${company.phone.replace(/[^+\d]/g, "")}`;
    else if (a.type === "link") { window.location.href = a.href; }
  };

  const send = async (text) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    setMessages((m) => [...m, { from: "user", text: clean }]);
    setInput("");
    if (bookingRef.current) {
      // The demo wizard owns the conversation until it finishes or is cancelled
      syncMessage("visitor", clean);
      handleBookingInput(clean);
      return;
    }
    const synced = await syncMessage("visitor", clean);
    const joined = synced ? !!synced.agentJoined : agentJoined;
    if (synced) { setAgentJoined(joined); setAgentOnline(!!synced.agentOnline); }
    if (joined) return; // a human agent has this conversation - let them answer
    const reply = matchIntent(clean, config.chatbot);
    setMessages((m) => [...m, { from: "bot", text: reply.answer, actions: reply.actions }]);
    syncMessage("bot", reply.answer);
  };

  const quickReplies = config.chatbot.quickReplies?.length ? config.chatbot.quickReplies : QUICK_REPLIES;

  return (
    <>
      {config.whatsapp.enabled && (
        <a
          className="float-btn float-wa"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          title="Chat on WhatsApp"
        >
          <WhatsAppGlyph />
        </a>
      )}

      {config.chatbot.enabled && (
        <>
          <button
            type="button"
            className="float-btn float-bot"
            aria-label={open ? "Close chat assistant" : "Open chat assistant"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? "close" : "message"} size={24} strokeWidth={1.9} />
            {unread > 0 && !open && <span className="float-unread" aria-label={`${unread} new messages`}>{unread}</span>}
          </button>

          {open && (
            <div className="chatbot-panel" role="dialog" aria-label={config.chatbot.botName}>
              <div className="chatbot-head">
                <span className="chatbot-avatar"><Icon name="cpu" size={18} /></span>
                <div>
                  <strong>{config.chatbot.botName}</strong>
                  <span>
                    {agentOnline ? (
                      <span className="chat-live"><span className="chat-live-dot" aria-hidden="true" /> Support team online</span>
                    ) : (
                      "Typically replies instantly"
                    )}
                  </span>
                </div>
                <button type="button" className="chatbot-close" aria-label="Close" onClick={() => setOpen(false)}>
                  <Icon name="close" size={16} strokeWidth={2.2} />
                </button>
              </div>

              <div className="chatbot-body" ref={bodyRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.from}`}>
                    {m.from === "agent" && <span className="chat-agent-name">{m.name || "Support"} · Kibo360 Team</span>}
                    <p>{m.text}</p>
                    {m.actions?.length > 0 && (
                      <div className="chat-actions">
                        {m.actions.map((a) => (
                          <button key={a.label} type="button" onClick={() => runAction(a)}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!booking && (
                  <div className="chat-quick">
                    {quickReplies.map((q) => (
                      <button key={q} type="button" onClick={() => send(q)}>{q}</button>
                    ))}
                  </div>
                )}
              </div>

              <form
                className="chatbot-input"
                onSubmit={(e) => { e.preventDefault(); send(input); }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your question…"
                  aria-label="Type your question"
                />
                <button type="submit" aria-label="Send">
                  <Icon name="chevron-right" size={18} strokeWidth={2.4} />
                </button>
              </form>

              <button
                type="button"
                className="chatbot-support"
                onClick={() => send("talk to support")}
              >
                <Icon name="users" size={14} /> Talk to Support
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
