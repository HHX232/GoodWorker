"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Phase = "work" | "short-break" | "long-break";
export interface PomodoroSettings { work: number; shortBreak: number; longBreak: number; }

interface Ctx {
  phase: Phase; timeLeft: number; isRunning: boolean;
  session: number; settings: PomodoroSettings; progress: number;
  toggle: () => void; reset: () => void; skip: () => void;
  applySettings: (s: PomodoroSettings) => void;
  // widget
  btnVisible: boolean;   // clock button shown in header
  modalOpen: boolean;
  setModalOpen: (v: boolean) => void;
  // dark theme
  isDark: boolean;
  setDark: (v: boolean) => void;
}

const PomodoroCtx = createContext<Ctx | null>(null);

export function usePomodoroCtx() {
  const ctx = useContext(PomodoroCtx);
  if (!ctx) throw new Error("usePomodoroCtx must be used inside PomodoroProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
const DEFAULT: PomodoroSettings = { work: 25, shortBreak: 5, longBreak: 15 };

function total(p: Phase, s: PomodoroSettings) {
  if (p === "work")        return s.work * 60;
  if (p === "short-break") return s.shortBreak * 60;
  return s.longBreak * 60;
}

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT);
  const [phase, setPhase]       = useState<Phase>("work");
  const [timeLeft, setTimeLeft] = useState(DEFAULT.work * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [session, setSession]   = useState(1);
  const [btnVisible, setBtnVisible] = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [isDark, setDark]           = useState(false);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync dark class on html element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("pomodoro-dark");
    } else {
      document.documentElement.classList.remove("pomodoro-dark");
    }
  }, [isDark]);

  // Show button when timer is running
  useEffect(() => { if (isRunning) setBtnVisible(true); }, [isRunning]);

  const advance = useCallback(() => {
    setIsRunning(false);
    setPhase(prev => {
      let next: Phase; let nextSess = session;
      if (prev === "work") {
        if (session >= 4) { next = "long-break"; nextSess = 1; }
        else              { next = "short-break"; nextSess = session + 1; }
      } else { next = "work"; }
      setSession(nextSess);
      setTimeLeft(total(next, settings));
      return next;
    });
  }, [session, settings]);

  useEffect(() => {
    if (!isRunning) { clearInterval(ivRef.current!); return; }
    ivRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(ivRef.current!); advance(); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(ivRef.current!);
  }, [isRunning, advance]);

  const toggle = () => setIsRunning(r => !r);

  const reset = useCallback(() => {
    setIsRunning(false); setTimeLeft(total(phase, settings));
  }, [phase, settings]);

  const skip = useCallback(() => advance(), [advance]);

  const applySettings = useCallback((s: PomodoroSettings) => {
    setSettings(s); setIsRunning(false); setPhase("work"); setSession(1); setTimeLeft(s.work * 60);
  }, []);

  const progress = 1 - timeLeft / total(phase, settings);

  // ── Global Ctrl+P → M shortcut ─────────────────────────────────────────────
  useEffect(() => {
    let pendingP = false;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        pendingP = true;
        clearTimeout(timer);
        timer = setTimeout(() => { pendingP = false; }, 1200);
        return;
      }
      if (pendingP && e.key.toLowerCase() === "m") {
        e.preventDefault(); pendingP = false; clearTimeout(timer);
        setBtnVisible(true);
        setModalOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer); };
  }, []);

  return (
    <PomodoroCtx.Provider value={{
      phase, timeLeft, isRunning, session, settings, progress,
      toggle, reset, skip, applySettings,
      btnVisible, modalOpen, setModalOpen,
      isDark, setDark,
    }}>
      {children}
    </PomodoroCtx.Provider>
  );
}
