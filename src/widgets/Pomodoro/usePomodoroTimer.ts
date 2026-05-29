"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Phase = "work" | "short-break" | "long-break";

export interface PomodoroSettings {
  work: number;       // minutes
  shortBreak: number;
  longBreak: number;
}

const DEFAULT: PomodoroSettings = { work: 25, shortBreak: 5, longBreak: 15 };

export function usePomodoroTimer() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT);
  const [phase, setPhase]       = useState<Phase>("work");
  const [timeLeft, setTimeLeft] = useState(DEFAULT.work * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [session, setSession]   = useState(1); // 1–4
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = useCallback((p: Phase, s: PomodoroSettings) => {
    if (p === "work")         return s.work * 60;
    if (p === "short-break")  return s.shortBreak * 60;
    return s.longBreak * 60;
  }, []);

  const advance = useCallback(() => {
    setIsRunning(false);
    setPhase(prev => {
      let next: Phase;
      let nextSession = session;
      if (prev === "work") {
        if (session >= 4) { next = "long-break"; nextSession = 1; }
        else              { next = "short-break"; nextSession = session + 1; }
      } else {
        next = "work";
      }
      setSession(nextSession);
      setTimeLeft(totalSeconds(next, settings));
      return next;
    });
    // browser notification
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Pomodoro", { body: "Время вышло! Переходим к следующей фазе." });
    }
  }, [session, settings, totalSeconds]);

  useEffect(() => {
    if (!isRunning) { clearInterval(intervalRef.current!); return; }
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(intervalRef.current!); advance(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [isRunning, advance]);

  const toggle = () => setIsRunning(r => !r);

  const reset = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(totalSeconds(phase, settings));
  }, [phase, settings, totalSeconds]);

  const skip = useCallback(() => advance(), [advance]);

  const applySettings = useCallback((s: PomodoroSettings) => {
    setSettings(s);
    setIsRunning(false);
    setPhase("work");
    setSession(1);
    setTimeLeft(s.work * 60);
  }, []);

  const progress = 1 - timeLeft / totalSeconds(phase, settings);

  return { phase, timeLeft, isRunning, session, settings, progress, toggle, reset, skip, applySettings };
}
