import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { useDemoModal } from "./DemoModalContext.jsx";
import { company } from "../data/siteData.js";

// ---------------------------------------------------------------------------
// Floating WhatsApp button (bottom-left) + auto-answer chatbot (bottom-right).
// Config comes from https://api.kibo360.in/api/settings (managed in the admin panel); sensible
// defaults apply when the backend is unreachable.
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  whatsapp: { enabled: true, number: "918008005672", greeting: "Hi! I'd like to know more about KIBO360." },
  chatbot: {
    enabled: true,
    botName: "Kibo Assistant",
    welcome: "Hi! I'm the Kibo360 assistant. Ask me about our products, demos or support - or pick an option below.",
    customFaqs: [],
  },
};

const QUICK_REPLIES = ["Our Products", "Book a Demo", "HMS", "CMS", "Contact & Support"];

// Built-in knowledge: [keywords[], answer, actions?]
const INTENTS = [
  {
    keywords: ["hello", "hi", "hey", "namaste", "good morning", "good afternoon", "good evening"],
    answer: "Hello! How can I help you today? You can ask about our products, book a demo, or talk to our support team.",
  },
  {
    keywords: ["product", "solution", "software", "what do you", "offer", "our products"],
    answer:
      "Kibo360 brings business software together on one platform:\n• HMS - Hospital Management Software (live)\n• CMS - Clinic Management Software (live)\n• ERP, CRM, LIS and Inventory - coming soon\n\nEverything shares one intelligent database, so you can add products as you grow.",
    actions: [{ label: "View All Products", type: "link", href: "/products" }],
  },
  {
    keywords: ["hms", "hospital"],
    answer:
      "KIBO360 HMS runs your whole hospital - OPD/IPD, EMR/EHR, diagnostics, pharmacy, billing, finance, HR & payroll and AI analytics on one intelligent database. It's ABDM/ABHA-ready with NABH-aligned workflows.",
    actions: [
      { label: "Explore HMS", type: "link", href: "/products/hms" },
      { label: "Book a Demo", type: "demo" },
    ],
  },
  {
    keywords: ["cms", "clinic"],
    answer:
      "KIBO360 CMS is built for clinics - appointments, queue & token, doctor EMR, e-prescriptions, GST billing, pharmacy and WhatsApp reminders. Live in days, and it upgrades to full HMS without any data migration.",
    actions: [
      { label: "Explore CMS", type: "link", href: "/products/cms" },
      { label: "Book a Demo", type: "demo" },
    ],
  },
  {
    keywords: ["price", "pricing", "cost", "charges", "fees", "quote", "subscription"],
    answer:
      "Pricing depends on your facility size and the modules you need. Book a free demo and our team will prepare a quote tailored to you - usually within one business day.",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
  {
    keywords: ["demo", "book", "trial", "see it"],
    answer: "Happy to set that up! Click below and tell us a little about your facility - we respond within one business day.",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
  {
    keywords: ["contact", "support", "help", "talk", "human", "agent", "team", "call", "phone", "email"],
    answer: `You can reach our team directly:\n• Call ${company.phone}\n• Email ${company.email}\n• Or chat with us on WhatsApp`,
    actions: [
      { label: "WhatsApp Us", type: "wa" },
      { label: `Call ${company.phone}`, type: "tel" },
      { label: "Send a Message", type: "demo" },
    ],
  },
  {
    keywords: ["certif", "iso", "cmmi", "quality"],
    answer:
      "Livexpert Technologies is ISO 9001:2015 certified (Quality Management Systems) and appraised at CMMI Level 3. Kibo360 also holds ABHA certification under the Ayushman Bharat Digital Mission.",
    actions: [{ label: "About Us", type: "link", href: "/about" }],
  },
  {
    keywords: ["abdm", "abha", "nabh", "dpdp", "compliance", "secure", "security", "data"],
    answer:
      "Kibo360 is ABDM/ABHA-ready with NABH-aligned workflows, and data handling aligned with India's DPDP Act 2023 - AES-256 encryption, role-based access, 2FA, audit logs and disaster recovery.",
  },
  {
    keywords: ["address", "location", "office", "where"],
    answer: `We're at ${company.address}.`,
  },
  {
    keywords: ["thank", "thanks", "great", "ok", "okay"],
    answer: "You're welcome! Anything else I can help with?",
  },
];

function matchIntent(text, customFaqs) {
  const q = text.toLowerCase();
  for (const f of customFaqs || []) {
    const kws = String(f.keywords || f.q || "").toLowerCase().split(",").map((k) => k.trim()).filter(Boolean);
    if (kws.some((k) => k && q.includes(k))) return { answer: f.a, actions: [] };
  }
  for (const intent of INTENTS) {
    if (intent.keywords.some((k) => q.includes(k))) return intent;
  }
  return {
    answer:
      "I'm not sure about that one - but our team will know! You can book a demo, message us on WhatsApp, or call us and we'll help right away.",
    actions: [
      { label: "Talk to Support (WhatsApp)", type: "wa" },
      { label: "Book a Demo", type: "demo" },
      { label: `Call ${company.phone}`, type: "tel" },
    ],
  };
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
  const [messages, setMessages] = useState([]); // {from:"bot"|"user", text, actions?}
  const [input, setInput] = useState("");
  const { openDemo } = useDemoModal();
  const bodyRef = useRef(null);

  useEffect(() => {
    fetch("https://api.kibo360.in/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setConfig({ whatsapp: { ...DEFAULT_CONFIG.whatsapp, ...d.whatsapp }, chatbot: { ...DEFAULT_CONFIG.chatbot, ...d.chatbot } });
      })
      .catch(() => { /* offline: keep defaults */ });
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ from: "bot", text: config.chatbot.welcome }]);
    }
  }, [open, messages.length, config.chatbot.welcome]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const waHref = `https://wa.me/${config.whatsapp.number}?text=${encodeURIComponent(config.whatsapp.greeting)}`;

  const runAction = (a) => {
    if (a.type === "demo") { setOpen(false); openDemo(); }
    else if (a.type === "wa") window.open(waHref, "_blank", "noopener");
    else if (a.type === "tel") window.location.href = `tel:${company.phone.replace(/[^+\d]/g, "")}`;
    else if (a.type === "link") { window.location.href = a.href; }
  };

  const send = (text) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    const reply = matchIntent(clean, config.chatbot.customFaqs);
    setMessages((m) => [
      ...m,
      { from: "user", text: clean },
      { from: "bot", text: reply.answer, actions: reply.actions },
    ]);
    setInput("");
  };

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
          </button>

          {open && (
            <div className="chatbot-panel" role="dialog" aria-label={config.chatbot.botName}>
              <div className="chatbot-head">
                <span className="chatbot-avatar"><Icon name="cpu" size={18} /></span>
                <div>
                  <strong>{config.chatbot.botName}</strong>
                  <span>Typically replies instantly</span>
                </div>
                <button type="button" className="chatbot-close" aria-label="Close" onClick={() => setOpen(false)}>
                  <Icon name="close" size={16} strokeWidth={2.2} />
                </button>
              </div>

              <div className="chatbot-body" ref={bodyRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.from}`}>
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
                <div className="chat-quick">
                  {QUICK_REPLIES.map((q) => (
                    <button key={q} type="button" onClick={() => send(q)}>{q}</button>
                  ))}
                </div>
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
