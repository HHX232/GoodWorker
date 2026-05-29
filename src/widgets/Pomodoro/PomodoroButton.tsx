"use client";

import { useEffect, useRef } from "react";
import { usePomodoroCtx } from "./PomodoroContext";
import { PomodoroCore } from "./PomodoroCore";
import styles from "./PomodoroButton.module.scss";

export function PomodoroButton() {
  const { btnVisible, modalOpen, setModalOpen } = usePomodoroCtx();
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) setModalOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modalOpen, setModalOpen]);

  if (!btnVisible) return null;

  return (
    <div className={styles.wrap} ref={modalRef}>
      <button
        className={`${styles.clockBtn} ${modalOpen ? styles.clockBtnActive : ""}`}
        onClick={() => setModalOpen(!modalOpen)}
        title="Помодоро (Ctrl+P → M)"
        aria-label="Помодоро таймер"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </button>

      {modalOpen && (
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <span className={styles.modalTitle}>Помодоро</span>
            <button className={styles.closeBtn} onClick={() => setModalOpen(false)} aria-label="Закрыть">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <PomodoroCore compact />
        </div>
      )}
    </div>
  );
}
