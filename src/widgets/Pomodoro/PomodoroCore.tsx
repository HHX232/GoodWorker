"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Phase, PomodoroSettings, usePomodoroCtx } from "./PomodoroContext";
import styles from "./PomodoroCore.module.scss";

const R   = 72;
const C   = 2 * Math.PI * R;
const PAD = 20;
const SIZE = (R + PAD) * 2;

const PHASE_COLOR: Record<Phase, string> = {
  "work":        "#e74c3c",
  "short-break": "#27ae60",
  "long-break":  "#2980b9",
};

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

interface Props {
  compact?: boolean;
}

export function PomodoroCore({ compact = false }: Props) {
  const t = useTranslations("Pomodoro");
  const { phase, timeLeft, isRunning, session, settings, progress, toggle, reset, skip, applySettings } =
    usePomodoroCtx();
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState<PomodoroSettings>(settings);

  const phaseLabel: Record<Phase, string> = {
    "work":        t("phase_work"),
    "short-break": t("phase_short"),
    "long-break":  t("phase_long"),
  };

  const color  = PHASE_COLOR[phase];
  const offset = C * (1 - progress);

  const saveSettings = () => {
    applySettings(draft);
    setShowSettings(false);
  };

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ""}`}>
      {/* Phase tabs */}
      <div className={styles.tabs}>
        {(["work", "short-break", "long-break"] as Phase[]).map(p => (
          <span key={p} className={`${styles.tab} ${phase === p ? styles.tabActive : ""}`}
            style={phase === p ? { color, borderColor: color } : {}}>
            {phaseLabel[p]}
          </span>
        ))}
      </div>

      {/* Ring */}
      <div className={styles.ringWrap}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={SIZE/2} cy={SIZE/2} r={R} className={styles.ringBg} />
          <circle
            cx={SIZE/2} cy={SIZE/2} r={R}
            className={styles.ringFg}
            stroke={color}
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{ transition: isRunning ? "stroke-dashoffset 1s linear" : "none" }}
          />
        </svg>
        <div className={styles.ringInner}>
          <div className={styles.time}>{fmt(timeLeft)}</div>
          <div className={styles.phaseLabel} style={{ color }}>{phaseLabel[phase]}</div>
        </div>
      </div>

      {/* Session dots */}
      <div className={styles.sessions}>
        {[1,2,3,4].map(i => (
          <span key={i} className={styles.dot} style={{ background: i <= session ? color : undefined }} />
        ))}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button className={styles.btn} onClick={reset} title={t("reset")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
        </button>
        <button className={styles.btnPrimary} onClick={toggle} style={{ background: color }}>
          {isRunning
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>
        <button className={styles.btn} onClick={skip} title={t("skip")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
      </div>

      {/* Settings toggle */}
      <button className={styles.settingsToggle} onClick={() => { setDraft(settings); setShowSettings(s => !s); }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        {t("settings")}
      </button>

      {showSettings && (
        <div className={styles.settingsPanel}>
          {([
            ["work",       "setting_work"],
            ["shortBreak", "setting_short"],
            ["longBreak",  "setting_long"],
          ] as const).map(([key, labelKey]) => (
            <label key={key} className={styles.settingRow}>
              <span>{t(labelKey)}</span>
              <div className={styles.settingInput}>
                <input
                  type="number" min={1} max={60}
                  value={draft[key as keyof PomodoroSettings]}
                  onChange={e => setDraft(d => ({ ...d, [key]: Math.max(1, +e.target.value) }))}
                />
                <span>{t("setting_min")}</span>
              </div>
            </label>
          ))}
          <button className={styles.saveBtn} onClick={saveSettings}>{t("apply")}</button>
        </div>
      )}
    </div>
  );
}
