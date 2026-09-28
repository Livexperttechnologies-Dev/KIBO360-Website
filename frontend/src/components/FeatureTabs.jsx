import { useEffect, useRef, useState } from "react";
import { useCms, useListItems, Scope, useScope, joinKey } from "../cms/content.jsx";
import { T, R, Btn, Img, List } from "../cms/primitives.jsx";

const INTERVAL = 6000; // ms per tab before auto-advancing
const STEP = 100;

/**
 * Auto-rotating tab showcase: cycles every 6s with a progress bar, pauses on
 * hover (and always in the editor), click to jump.
 * `tabs`: [{ label, title, text, points: [], image, alt, overlay: <jsx> }]
 * Editable keys: tabs.<id>.{label,title,text,cta,image} and tabs.<id>.points
 */
export default function FeatureTabs({ tabs }) {
  const entries = useListItems("tabs", tabs, (t) => t.label);
  const { mode } = useCms();
  const { docId, prefix } = useScope();
  const listKey = joinKey(prefix, "tabs");
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const paused = useRef(false);
  const count = entries.length;

  useEffect(() => {
    if (mode === "edit") return undefined;
    const timer = setInterval(() => {
      if (paused.current) return;
      setProgress((p) => {
        if (p >= 100) {
          setActive((a) => (a + 1) % Math.max(1, count));
          return 0;
        }
        return p + (STEP / INTERVAL) * 100;
      });
    }, STEP);
    return () => clearInterval(timer);
  }, [count, mode]);

  const select = (i) => { setActive(i); setProgress(0); };
  const cur = entries[Math.min(active, count - 1)];
  if (!cur) return null;
  const tab = cur.item;

  return (
    <div onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
      <div className="tabs-nav" role="tablist">
        {entries.map((e, i) => (
          <Scope key={e.id} k={`tabs.${e.id}`}>
            <button
              role="tab"
              aria-selected={i === active}
              className={`tab-chip ${i === active ? "active" : ""}`}
              onClick={() => select(i)}
              data-kibo-hidden={e.hidden ? "1" : undefined}
              {...(mode === "edit" ? { "data-kibo-item": e.id, "data-kibo-base": e.baseId, "data-kibo-list": listKey, "data-kibo-doc": docId } : {})}
            >
              <T k="label">{e.item.label}</T>
              <div className="chip-progress" style={{ width: i === active ? `${progress}%` : 0 }} />
            </button>
          </Scope>
        ))}
      </div>

      <Scope k={`tabs.${cur.id}`}>
        <div className="tabs-container">
          <div className="tab-panel split" key={cur.id}>
            <div>
              <T k="title" as="h3">{tab.title}</T>
              <R k="text" className="tab-desc">{tab.text}</R>
              <ul className="tab-list">
                <List k="points" items={tab.points}>{(p) => <R k="text" as="li">{p}</R>}</List>
              </ul>
              <Btn k="cta" className="btn btn-primary" action="demo" style={{ marginTop: 20 }}>{tab.cta || "Book a Demo"}</Btn>
            </div>
            <div className="split-visual">
              <div className="img-wrapper">
                <Img k="image" src={tab.image} alt={tab.alt} className="main-img" loading="lazy" />
                <div className="img-overlay right">{tab.overlay}</div>
              </div>
            </div>
          </div>
        </div>
      </Scope>
    </div>
  );
}
