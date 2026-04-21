"use client";

import React, { useEffect, useRef } from "react";
import styles from "./hero-section.module.scss";

const colors = {
  50: "#f8f7f5",
  100: "#e6e1d7",
  200: "#c8b4a0",
  300: "#a89080",
  400: "#8a7060",
  500: "#6b5545",
  600: "#544237",
  700: "#3c4237",
  800: "#2a2e26",
  900: "#1a1d18",
};

const wordStyle: React.CSSProperties = {
  display: "inline-block",
  opacity: 0,
  cursor: "default",
  transition: "text-shadow 0.2s",
};

export function HeroComponent() {
  const gradientRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const words = document.querySelectorAll<HTMLElement>("[data-word]");
    words.forEach((word) => {
      const delay = parseInt(word.getAttribute("data-delay") || "0", 10);
      setTimeout(() => {
        word.style.animation = `wordAppear 0.8s ease-out forwards`;
      }, delay);
    });

    const gradient = gradientRef.current;
    function onMouseMove(e: MouseEvent) {
      if (gradient) {
        gradient.style.left = e.clientX - 192 + "px";
        gradient.style.top = e.clientY - 192 + "px";
        gradient.style.opacity = "1";
      }
    }
    function onMouseLeave() {
      if (gradient) gradient.style.opacity = "0";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);

    words.forEach((word) => {
      word.addEventListener("mouseenter", () => {
        word.style.textShadow = "0 0 20px rgba(200, 180, 160, 0.5)";
      });
      word.addEventListener("mouseleave", () => {
        word.style.textShadow = "none";
      });
    });

    function onClick(e: MouseEvent) {
      const ripple = document.createElement("div");
      ripple.style.cssText = `
        position:fixed;left:${e.clientX}px;top:${e.clientY}px;
        width:4px;height:4px;background:rgba(200,180,160,0.6);
        border-radius:50%;transform:translate(-50%,-50%);
        pointer-events:none;animation:pulseGlow 1s ease-out forwards;
      `;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 1000);
    }
    document.addEventListener("click", onClick);

    let scrolled = false;
    function onScroll() {
      if (!scrolled) {
        scrolled = true;
        document.querySelectorAll<HTMLElement>(`.${styles.floatingElement}`).forEach((el, i) => {
          setTimeout(() => {
            el.style.animationPlayState = "running";
          }, i * 200);
        });
      }
    }
    window.addEventListener("scroll", onScroll);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className={styles.root}>
      <svg className={styles.svgBg} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(200,180,160,0.08)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <line x1="0" y1="20%" x2="100%" y2="20%" className={styles.gridLine} style={{ animationDelay: "0.5s" }} />
        <line x1="0" y1="80%" x2="100%" y2="80%" className={styles.gridLine} style={{ animationDelay: "1s" }} />
        <line x1="20%" y1="0" x2="20%" y2="100%" className={styles.gridLine} style={{ animationDelay: "1.5s" }} />
        <line x1="80%" y1="0" x2="80%" y2="100%" className={styles.gridLine} style={{ animationDelay: "2s" }} />
        <circle cx="20%" cy="20%" r="2" className={styles.detailDot} style={{ animationDelay: "3s" }} />
        <circle cx="80%" cy="20%" r="2" className={styles.detailDot} style={{ animationDelay: "3.2s" }} />
        <circle cx="20%" cy="80%" r="2" className={styles.detailDot} style={{ animationDelay: "3.4s" }} />
        <circle cx="80%" cy="80%" r="2" className={styles.detailDot} style={{ animationDelay: "3.6s" }} />
      </svg>

      <div className={`${styles.cornerElement} ${styles.cornerTL}`} style={{ animationDelay: "4s" }}>
        <div className={styles.cornerDot} />
      </div>
      <div className={`${styles.cornerElement} ${styles.cornerTR}`} style={{ animationDelay: "4.2s" }}>
        <div className={styles.cornerDot} />
      </div>
      <div className={`${styles.cornerElement} ${styles.cornerBL}`} style={{ animationDelay: "4.4s" }}>
        <div className={styles.cornerDot} />
      </div>
      <div className={`${styles.cornerElement} ${styles.cornerBR}`} style={{ animationDelay: "4.6s" }}>
        <div className={styles.cornerDot} />
      </div>

      <div className={styles.floatingElement} style={{ top: "25%", left: "15%", animationDelay: "5s" }} />
      <div className={styles.floatingElement} style={{ top: "60%", left: "85%", animationDelay: "5.5s" }} />
      <div className={styles.floatingElement} style={{ top: "40%", left: "10%", animationDelay: "6s" }} />
      <div className={styles.floatingElement} style={{ top: "75%", left: "90%", animationDelay: "6.5s" }} />

      <div className={styles.content}>
        {/* Top tagline */}
        <div className={styles.taglineTop}>
          <h2 className={styles.taglineText} style={{ color: colors[200] }}>
            <span data-word data-delay="0" style={wordStyle}>Welcome</span>
            {" "}
            <span data-word data-delay="200" style={wordStyle}>to</span>
            {" "}
            <span data-word data-delay="400" style={wordStyle}><b>StackPilot</b></span>
            {" "}
            <span data-word data-delay="600" style={wordStyle}>—</span>
            {" "}
            <span data-word data-delay="800" style={wordStyle}>Powering</span>
            {" "}
            <span data-word data-delay="1000" style={wordStyle}>your</span>
            {" "}
            <span data-word data-delay="1200" style={wordStyle}>digital</span>
            {" "}
            <span data-word data-delay="1400" style={wordStyle}>transformation.</span>
          </h2>
          <div
            className={styles.divider}
            style={{ background: `linear-gradient(to right, transparent, ${colors[200]}, transparent)` }}
          />
        </div>

        {/* Main headline */}
        <div className={styles.headline}>
          <h1 className={styles.h1} style={{ color: colors[50] }}>
            <div className={styles.h1Row}>
              <span data-word data-delay="1600" style={wordStyle}>Supercharge</span>
              {" "}
              <span data-word data-delay="1750" style={wordStyle}>your</span>
              {" "}
              <span data-word data-delay="1900" style={wordStyle}>productivity</span>
              {" "}
              <span data-word data-delay="2050" style={wordStyle}>with</span>
              {" "}
              <span data-word data-delay="2200" style={wordStyle}>AI-driven</span>
              {" "}
              <span data-word data-delay="2350" style={wordStyle}>automation.</span>
            </div>
            <div className={styles.h1Sub} style={{ color: colors[200] }}>
              <span data-word data-delay="2600" style={wordStyle}>Integrate,</span>
              {" "}
              <span data-word data-delay="2750" style={wordStyle}>orchestrate,</span>
              {" "}
              <span data-word data-delay="2900" style={wordStyle}>and</span>
              {" "}
              <span data-word data-delay="3050" style={wordStyle}>scale</span>
              {" "}
              <span data-word data-delay="3200" style={wordStyle}>your</span>
              {" "}
              <span data-word data-delay="3350" style={wordStyle}>business</span>
              {" "}
              <span data-word data-delay="3500" style={wordStyle}>— all</span>
              {" "}
              <span data-word data-delay="3650" style={wordStyle}>in</span>
              {" "}
              <span data-word data-delay="3800" style={wordStyle}>one</span>
              {" "}
              <span data-word data-delay="3950" style={wordStyle}>secure</span>
              {" "}
              <span data-word data-delay="4100" style={wordStyle}>platform.</span>
            </div>
          </h1>
        </div>

        {/* Bottom tagline */}
        <div className={styles.taglineBottom}>
          <div
            className={styles.divider}
            style={{ background: `linear-gradient(to right, transparent, ${colors[200]}, transparent)` }}
          />
          <h2 className={styles.taglineText} style={{ color: colors[200] }}>
            <span data-word data-delay="4400" style={wordStyle}>Real-time</span>
            {" "}
            <span data-word data-delay="4550" style={wordStyle}>analytics,</span>
            {" "}
            <span data-word data-delay="4700" style={wordStyle}>seamless</span>
            {" "}
            <span data-word data-delay="4850" style={wordStyle}>integrations,</span>
            {" "}
            <span data-word data-delay="5000" style={wordStyle}>enterprise-grade</span>
            {" "}
            <span data-word data-delay="5150" style={wordStyle}>security.</span>
          </h2>
          <div
            className={styles.dots}
            style={{ animationDelay: "4.5s" }}
          >
            <div className={styles.dot} style={{ background: colors[200], opacity: 0.4 }} />
            <div className={styles.dot} style={{ background: colors[200], opacity: 0.6 }} />
            <div className={styles.dot} style={{ background: colors[200], opacity: 0.4 }} />
          </div>
        </div>
      </div>

      <div
        id="mouse-gradient"
        ref={gradientRef}
        className={styles.mouseGradient}
        style={{ background: `radial-gradient(circle, ${colors[500]}1A 0%, transparent 100%)` }}
      />
    </div>
  );
}