import { useEffect, useRef, useState } from "react";
import { useDemoModal } from "./DemoModalContext.jsx";

const INTERVAL = 6000; // ms per tab before auto-advancing
const STEP = 100;

/**
 * Auto-rotating tab showcase (reference-page behavior):
 * cycles every 6s with a progress bar, pauses on hover, click to jump.
 * `tabs`: [{ label, title, text, points: [], image, alt, overlay: <jsx> }]
 */
export default function FeatureTabs({ tabs }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const paused = useRef(false);
  const { openDemo } = useDemoModal();

  useEffect(() => {
    const timer = setInterval(() => {
      if (paused.current) return;
      setProgress((p) => {
        if (p >= 100) {
          setActive((a) => (a + 1) % tabs.length);
          return 0;
        }
        return p + (STEP / INTERVAL) * 100;
      });
    }, STEP);
    return () => clearInterval(timer);
  }, [tabs.length]);

  const select = (i) => {
    setActive(i);
    setProgress(0);
  };

  const tab = tabs[active];

  return (
    <div
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      <div className="tabs-nav" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            aria-selected={i === active}
            className={`tab-chip ${i === active ? "active" : ""}`}
            onClick={() => select(i)}
          >
            <span>{t.label}</span>
            <div
              className="chip-progress"
              style={{ width: i === active ? `${progress}%` : 0 }}
            />
          </button>
        ))}
      </div>

      <div className="tabs-container">
        <div className="tab-panel split" key={tab.label}>
          <div>
            <h3>{tab.title}</h3>
            <p className="tab-desc">{tab.text}</p>
            <ul className="tab-list">
              {tab.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={openDemo}
            >
              {tab.cta || "Book a Demo"}
            </button>
          </div>
          <div className="split-visual">
            <div className="img-wrapper">
              <img src={tab.image} alt={tab.alt} className="main-img" loading="lazy" />
              <div className="img-overlay right">{tab.overlay}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
