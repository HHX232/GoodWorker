"use client";

import { useEffect } from "react";
import { PomodoroCore } from "@/widgets/Pomodoro/PomodoroCore";
import { usePomodoroCtx } from "@/widgets/Pomodoro/PomodoroContext";
import styles from "./PomodoroPage.module.scss";

const TipIcons = {
  Focus: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Coffee: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
  Leaf: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8C8 10 5.9 16.17 3.82 19.49a.5.5 0 0 0 .82.54C7.08 16.99 10.5 14 17 14"/>
      <path d="M17 8a11 11 0 0 1 4 13 11 11 0 0 1-18-8"/>
    </svg>
  ),
  Repeat: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
};

const TIPS = [
  { Icon: TipIcons.Focus,  title: "25 минут фокуса",  desc: "Работай без отвлечений один помодоро" },
  { Icon: TipIcons.Coffee, title: "5 минут перерыв",   desc: "Короткий отдых после каждой сессии" },
  { Icon: TipIcons.Leaf,   title: "Длинный перерыв",   desc: "15 минут после каждых 4 сессий" },
  { Icon: TipIcons.Repeat, title: "Повторяй циклы",    desc: "Отслеживай прогресс по точкам сессий" },
];

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export function PomodoroPage() {
  const { isDark, setDark } = usePomodoroCtx();

  // Reset dark theme when leaving the page
  useEffect(() => {
    return () => { setDark(false); };
  }, [setDark]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Помодоро</h1>
            <button
              className={styles.themeToggle}
              onClick={() => setDark(!isDark)}
              title={isDark ? "Светлая тема" : "Тёмная тема"}
              aria-label="Переключить тему"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          <p className={styles.subtitle}>
            Техника управления временем для эффективного обучения
          </p>
        </div>

        <div className={styles.card}>
          <PomodoroCore />
        </div>

        <div className={styles.tips}>
          <h2 className={styles.tipsTitle}>Как работает техника</h2>
          <div className={styles.tipGrid}>
            {TIPS.map(({ Icon, title, desc }) => (
              <div key={title} className={styles.tip}>
                <span className={styles.tipIcon}><Icon /></span>
                <div>
                  <div className={styles.tipTitle}>{title}</div>
                  <div className={styles.tipDesc}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
