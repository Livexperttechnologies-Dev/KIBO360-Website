import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Small UI kit for the Super Admin (buttons, fields, dialogs, toasts...).
// ---------------------------------------------------------------------------

const ICONS = {
  dashboard: "M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z",
  pages: "M6 2h9l5 5v15H6zM14 2v6h6",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  image: "M3 5h18v14H3zM3 16l5-5 5 5 3-3 5 5M15.5 9.5h.01",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  layout: "M3 4h18v16H3zM3 9h18M3 15h18",
  menu: "M4 6h16M4 12h16M4 18h16",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15 8a5 5 0 0 1 0 8M18 5a9 9 0 0 1 0 14",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  form: "M5 3h14v18H5zM9 8h6M9 12h6M9 16h3",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v7H2v-7l3.5-7Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  chat: "M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12Z",
  shield: "M12 3 5 6v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Z",
  key: "M15 7a4 4 0 1 1-3.9 5H9v3H6v3H3v-4l7.1-7.1A4 4 0 0 1 15 7ZM16 7h.01",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  check: "M5 12l5 5L20 7",
  trash: "M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  copy: "M8 8h12v12H8zM4 16V4h12",
  upload: "M12 16V4M7 9l5-5 5 5M4 17v3h16v-3",
  download: "M12 4v12M7 11l5 5 5-5M4 17v3h16v-3",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  tablet: "M6 3h12v18H6zM11 18h2",
  phone: "M8 2h8v20H8zM11 18h2",
  columns: "M3 4h18v16H3zM12 4v16",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16v-4M12 8h.01",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  up: "M12 19V5M5 12l7-7 7 7",
  down: "M12 5v14M5 12l7 7 7-7",
  grip: "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
  layers: "M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5",
  refresh: "M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5",
  folder: "M3 6h6l2 2h10v11H3z",
  tag: "M20 12 12 20l-9-9V3h8l9 9ZM7.5 7.5h.01",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.3 21a1.9 1.9 0 0 0 3.4 0",
  bellOff: "M3 3l18 18M8.7 3.9A6 6 0 0 1 18 8c0 3 .7 5 1.4 6.2M17 17H3s3-1 3-8c0-.6.1-1.3.3-1.9M10.3 21a1.9 1.9 0 0 0 3.4 0",
  map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  robot: "M5 8h14v11H5zM12 4v4M9 13h.01M15 13h.01M9 16h6",
  redirect: "M17 3l4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4M21 13v2a2 2 0 0 1-2 2H3",
  code: "M8 6 2 12l6 6M16 6l6 6-6 6",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z",
  whatsapp: "M20.5 12A8.5 8.5 0 0 1 8 19.5L3.5 21l1.5-4.3A8.5 8.5 0 1 1 20.5 12ZM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8a4 4 0 0 1-2.3-2.3l.8-1-1-2L9.5 8Z",
  filter: "M3 5h18l-7 8v6l-4 2v-8L3 5Z",
  calendar: "M4 5h16v16H4zM4 10h16M9 3v4M15 3v4",
  video: "M3 6h13v12H3zM16 10l5-3v10l-5-3",
  cursor: "M5 3l14 7-6 2-2 6-6-15Z",
};

export function I({ n, size = 16, stroke = 2, className = "", title }) {
  const d = ICONS[n];
  if (!d) return null;
  return (
    <svg className={`ai ${className}`} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}

export function Button({ variant = "default", size, icon, iconAfter, children, className = "", busy, disabled, ...rest }) {
  return (
    <button type="button" className={`a-btn a-btn-${variant} ${size ? `a-btn-${size}` : ""} ${className}`} {...rest} disabled={!!(busy || disabled)} aria-busy={busy || undefined}>
      {busy ? <span className="a-spin" aria-hidden="true" /> : icon && <I n={icon} size={size === "sm" ? 14 : 16} />}
      {children && <span>{children}</span>}
      {iconAfter && <I n={iconAfter} size={14} />}
    </button>
  );
}
export const IconButton = ({ icon, label, className = "", size = 16, ...rest }) => (
  <button type="button" className={`a-icon-btn ${className}`} aria-label={label} title={label} {...rest}><I n={icon} size={size} /></button>
);

export function Field({ label, hint, error, children, className = "", counter, htmlFor }) {
  return (
    <div className={`a-field ${error ? "has-error" : ""} ${className}`}>
      {(label || counter) && (
        <div className="a-field-top">
          {label && <label htmlFor={htmlFor}>{label}</label>}
          {counter}
        </div>
      )}
      {children}
      {error ? <p className="a-field-error" role="alert">{error}</p> : hint ? <p className="a-hint">{hint}</p> : null}
    </div>
  );
}

/** Text input bound to a value; `onChange` receives the string. */
export function Input({ value, onChange, className = "", ...rest }) {
  return <input className={`a-input ${className}`} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} {...rest} />;
}
export function Textarea({ value, onChange, className = "", rows = 3, ...rest }) {
  return <textarea className={`a-input ${className}`} rows={rows} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} {...rest} />;
}
export function Select({ value, onChange, options, className = "", ...rest }) {
  return (
    <select className={`a-input a-select ${className}`} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} {...rest}>
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>))}
    </select>
  );
}
export function Toggle({ checked, onChange, label, hint, disabled }) {
  const id = useId();
  return (
    <div className={`a-toggle-row ${disabled ? "disabled" : ""}`}>
      <button id={id} type="button" role="switch" aria-checked={!!checked} className={`a-toggle ${checked ? "on" : ""}`} disabled={disabled} onClick={() => onChange(!checked)}>
        <span />
      </button>
      <label htmlFor={id} onClick={() => !disabled && onChange(!checked)}>
        {label}
        {hint && <small>{hint}</small>}
      </label>
    </div>
  );
}
export function Check({ checked, onChange, label, disabled }) {
  return (
    <label className={`a-check ${disabled ? "disabled" : ""}`}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Counter({ value, min, max }) {
  const n = String(value || "").length;
  const tone = !n ? "" : (min && n < min) || (max && n > max) ? "warn" : "good";
  return <span className={`a-counter ${tone}`}>{n}{max ? ` / ${max}` : ""}</span>;
}

export function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <div className={`a-tabs ${className}`} role="tablist">
      {tabs.filter(Boolean).map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={value === t.id ? "active" : ""} onClick={() => onChange(t.id)}>
          {t.icon && <I n={t.icon} size={15} />}
          {t.label}
          {t.badge ? <span className="a-tab-badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export const Badge = ({ tone = "gray", children, title }) => <span className={`a-badge a-badge-${tone}`} title={title}>{children}</span>;
export const Spinner = ({ label = "Loading…" }) => <div className="a-loading"><span className="a-spin" aria-hidden="true" /> {label}</div>;

export function Card({ title, subtitle, actions, children, className = "", pad = true }) {
  return (
    <div className={`a-card ${pad ? "" : "nopad"} ${className}`}>
      {(title || actions) && (
        <header className="a-card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="a-muted">{subtitle}</p>}
          </div>
          {actions && <div className="a-card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
}

export function Empty({ icon = "info", title, text, action }) {
  return (
    <div className="a-empty">
      <I n={icon} size={28} stroke={1.6} />
      {title && <strong>{title}</strong>}
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function PageHead({ title, subtitle, actions, children }) {
  return (
    <div className="a-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="a-page-actions">{actions}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, width = 560, className = "" }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Runs once per opening: parents pass inline onClose arrows and re-render
  // often (save status...), which must not yank focus back to the first field.
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector("input, textarea, select, button:not(.a-modal-x)");
    (first || el)?.focus?.();
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); closeRef.current?.(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, []);
  return createPortal(
    <div className="a-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`a-modal ${className}`} style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <header className="a-modal-head">
          <h2>{title}</h2>
          {onClose && <IconButton icon="x" label="Close" className="a-modal-x" onClick={onClose} />}
        </header>
        <div className="a-modal-body">{children}</div>
        {footer && <footer className="a-modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

// ------------------------------------------------ toasts + confirmations
const FeedbackCtx = createContext({ toast: () => {}, confirm: async () => false, prompt: async () => null });
export const useToast = () => useContext(FeedbackCtx).toast;
export const useConfirm = () => useContext(FeedbackCtx).confirm;
export const usePrompt = () => useContext(FeedbackCtx).prompt;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const toast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, message, tone: opts.tone || (opts.error ? "error" : "ok"), action: opts.action };
    setToasts((l) => [...l.slice(-3), t]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), opts.duration || (t.tone === "error" ? 7000 : 3800));
  }, []);
  const confirm = useCallback((o) => new Promise((resolve) => setDialog({ kind: "confirm", ...(typeof o === "string" ? { message: o } : o), resolve })), []);
  const prompt = useCallback((o) => new Promise((resolve) => setDialog({ kind: "prompt", value: o.value || "", ...o, resolve })), []);
  const close = (v) => { dialog?.resolve(v); setDialog(null); };
  return (
    <FeedbackCtx.Provider value={{ toast, confirm, prompt }}>
      {children}
      {createPortal(
        <div className="a-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`a-toast ${t.tone}`}>
              <I n={t.tone === "error" ? "alert" : "check"} size={16} />
              <span>{t.message}</span>
              {t.action && <button type="button" onClick={t.action.onClick}>{t.action.label}</button>}
            </div>
          ))}
        </div>,
        document.body
      )}
      {dialog && (
        <Modal
          title={dialog.title || (dialog.kind === "prompt" ? "Enter a value" : "Are you sure?")}
          onClose={() => close(dialog.kind === "prompt" ? null : false)}
          width={460}
          footer={
            <>
              <Button onClick={() => close(dialog.kind === "prompt" ? null : false)}>Cancel</Button>
              <Button
                variant={dialog.danger ? "danger" : "primary"}
                onClick={() => close(dialog.kind === "prompt" ? dialog.value : true)}
                disabled={dialog.kind === "prompt" && dialog.required && !String(dialog.value).trim()}
              >
                {dialog.confirmLabel || (dialog.kind === "prompt" ? "OK" : "Confirm")}
              </Button>
            </>
          }
        >
          {dialog.message && <div className="a-dialog-msg">{dialog.message}</div>}
          {dialog.kind === "prompt" && (
            <Field label={dialog.label} hint={dialog.hint}>
              <Input
                value={dialog.value}
                type={dialog.type || "text"}
                placeholder={dialog.placeholder}
                onChange={(v) => setDialog((d) => ({ ...d, value: v }))}
                onKeyDown={(e) => { if (e.key === "Enter" && (!dialog.required || String(dialog.value).trim())) close(dialog.value); }}
                autoFocus
              />
            </Field>
          )}
        </Modal>
      )}
    </FeedbackCtx.Provider>
  );
}

// ------------------------------------------------------------- helpers
export function CopyButton({ text, label = "Copy", size = "sm", variant = "default" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      icon={done ? "check" : "copy"}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch {
          const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

export function timeAgo(iso) {
  if (!iso) return "never";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-");
export function fmtBytes(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

/** Re-render periodically (for "saved 5s ago" labels). */
export function useNow(ms = 15000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}

/** Load data with loading/error state; returns [data, { loading, error, reload, setData }]. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (n === seq.current) setState({ data, loading: false, error: null });
      return data;
    } catch (e) {
      if (n === seq.current) setState((s) => ({ ...s, loading: false, error: e }));
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  const setData = useCallback((d) => setState((s) => ({ ...s, data: typeof d === "function" ? d(s.data) : d })), []);
  return [state.data, { loading: state.loading, error: state.error, reload, setData }];
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="a-alert error" role="alert">
      <I n="alert" size={16} />
      <span>{error.message || String(error)}</span>
      {onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
export function Alert({ tone = "info", children, icon }) {
  return <div className={`a-alert ${tone}`}><I n={icon || (tone === "error" || tone === "warn" ? "alert" : "info")} size={16} /><div>{children}</div></div>;
}
