'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useMe } from '@/features/hooks/User/useMe'

// ── CSS (ported from ForNewDesign/prototypes/v3-lab.html — hero H4 · steps S3 · errs E1 — with
//    the lab panel, unused hero/steps/errs variants and blueprint hero stripped out) ──────────
const CSS = `
:root{
  --bg:#f3f0ea; --ink:#0c0a08; --ink-2:#6a655c; --ink-3:#9a9488; --line:#ddd7cc; --paper:#faf8f3;
  --serif:var(--font-bodoni, "Bodoni Moda"), Georgia, "Times New Roman", serif;
  --sans:var(--font-archivo, "Archivo"), "Helvetica Neue", Arial, sans-serif;
  --mono:ui-monospace, "JetBrains Mono", monospace;
  --ease:cubic-bezier(.19,1,.22,1); --slow:1.2s;
  --step: clamp(5.5rem, 13vw, 12rem); --pad: clamp(1.25rem, 5vw, 5rem);
  --fs-hero:3.7rem; --fs-h2:2.2rem; --fs-lead:1.05rem; --fs-body:1rem;
  --tracking-display:-0.04em; --leading:1.6; --section-rhythm:6rem;
  --accent:#6e1f2e; --accent-soft:#9c4b57; --accent-ink:#4a141f; --accent-text:#ffffff;
  --btn-fg:var(--paper); --btn-fg-mid:rgba(250,248,243,.65); --btn-fg-dim:rgba(250,248,243,.5);
  --radius:0;
  /* Fixed tokens for the sections designed as a permanent dark band (scrub/demo/final) regardless
     of site theme — same values as the light palette's --ink/--bg so they render unchanged in both. */
  --dark-bg:#0c0a08; --dark-fg:#f3f0ea;
}
/* Site-wide dark mode (toggled via the header theme switch / Pomodoro focus mode) — this selector
   beats :root in specificity since it targets the same <html> element with an added class, so it
   overrides the light palette above without needing to touch every rule that consumes these tokens. */
html.theme-dark, html.pomodoro-dark{
  --bg:#15120e; --ink:#ece7dc; --ink-2:#a39a8a; --ink-3:#6e6558; --line:#332c22; --paper:#1f1a14;
  --accent-ink:#d98b98;
}
/* overflow-x is intentionally NOT set here (even to hidden) — per the CSS overflow spec, giving one
   axis a non-visible value forces the other to compute as auto, which turns .pdf3 into its own
   scroll container and breaks every position:sticky pin on the page (hero/scrub/demo). Horizontal
   overflow is instead clipped on <body> itself, outside this sticky subtree — see the mount effect
   in PdfInfoPage below. */
.pdf3{ background:var(--bg); color:var(--ink); font-family:var(--sans); font-weight:400; line-height:var(--leading); font-size:var(--fs-body); -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; position:relative; }
/* The app-wide reset (src/shared/scss/main.scss) hard-resets EVERY tag in a giant Meyer-style list —
   div/span/h1-h6/p/a/em/b/i/strong/small/li/ol/ul/details/summary/header/footer/nav/section/etc. —
   to a fixed base font-size (15px) and the app's default font-family instead of the CSS keyword
   inherit, so any of those tags that don't carry their own explicit font-family/font-size rule
   silently falls back to those reset defaults instead of inheriting from its styled ancestor.
   :where() gives this its own selector list zero specificity, so it only ever wins against the
   reset's bare-tag rules (specificity 0,0,1) and any later, real component rule for the same tag
   (e.g. .scrub__num, .brand, .btn) still overrides it normally via source order. */
.pdf3 :where(
  div, span, h1, h2, h3, h4, h5, h6, p, blockquote, a, abbr, address, cite, code, del, dfn, em, ins,
  kbd, q, s, samp, small, sub, sup, var, b, u, i, dl, dt, dd, ol, ul, li, fieldset, form, label,
  legend, article, aside, details, figcaption, figure, footer, header, hgroup, menu, nav, output,
  ruby, section, summary, time, mark, button, input, select, textarea
) { font: inherit; }
.pdf3 a:not(.btn):not(.nav-profile) { display: inline; }
.pdf3 *{ box-sizing:border-box; }
.pdf3 img{ max-width:100%; display:block; }
.pdf3 a{ color:inherit; }
.pdf3 section{ position:relative; }
.display{ font-family:var(--serif); font-weight:900; line-height:.98; letter-spacing:var(--tracking-display); margin:0; }
.display em{ font-style:italic; font-weight:700; }
.lede{ max-width:62ch; color:var(--ink-2); font-size:var(--fs-lead); line-height:1.55; margin:0; }
.wrap{ max-width:1360px; margin:0 auto; padding-left:var(--pad); padding-right:var(--pad); }
.section-pad{ padding-top:var(--section-rhythm); padding-bottom:var(--section-rhythm); }
.btn{ display:inline-flex; align-items:center; gap:.6rem; font-family:var(--sans); font-weight:600; font-size:.98rem; letter-spacing:.01em; padding:.95rem 1.6rem; border:1px solid var(--ink); text-decoration:none; border-radius:0; cursor:pointer; transition:background var(--slow) var(--ease), color var(--slow) var(--ease), transform .5s var(--ease); will-change:transform; }
.btn svg{ width:16px; height:16px; display:block; }
.btn--solid{ background:var(--accent); color:var(--accent-text); border-color:var(--accent); }
.btn--solid:hover{ background:transparent; color:var(--accent-ink); border-color:var(--accent); }
.btn--ghost{ background:transparent; color:var(--ink); border-color:var(--line); }
.btn--ghost:hover{ border-color:var(--ink); }
/* .btn--invert only appears on .final, a permanently-dark band (see --dark-bg/--dark-fg above) —
   it must stay tied to those fixed tokens rather than the theme-reactive --bg/--ink. */
.btn--invert{ background:var(--dark-fg); color:var(--dark-bg); border-color:var(--dark-fg); }
.btn--invert:hover{ background:transparent; color:var(--dark-fg); border-color:var(--dark-fg); }
.btn--vip{ background:transparent; color:var(--accent-soft); border-color:var(--accent-soft); }
.btn--vip:hover{ background:var(--accent-soft); color:var(--ink); border-color:var(--accent-soft); }
.btn[disabled]{ opacity:.55; pointer-events:none; }

.site-nav{ position:absolute; top:0; left:0; right:0; z-index:40; display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.4rem var(--pad); }
.brand{ font-family:var(--serif); font-weight:700; font-size:1.25rem; letter-spacing:-0.01em; text-decoration:none; white-space:nowrap; }
.site-nav__links{ display:flex; align-items:center; gap:2rem; }
.site-nav__links a{ font-size:.9rem; color:var(--ink-2); text-decoration:none; letter-spacing:.02em; transition:color .4s var(--ease); background:none; border:none; padding:0; font-family:inherit; cursor:pointer; }
.site-nav__links a:hover{ color:var(--ink); }
.site-nav__cta{ font-size:.85rem; font-weight:600; text-decoration:none; border-bottom:1px solid var(--accent); padding-bottom:2px; }
@media (max-width:860px){ .site-nav__links a:not(.site-nav__cta):not(.nav-profile){ display:none; } }

/* ── Nav profile widget (re-skin of widgets/ProfilePreview) ── */
.nav-profile{ display:flex; align-items:center; gap:.65rem; text-decoration:none; padding:.3rem .4rem; margin:-.3rem -.4rem; border-radius:2px; transition:background .3s var(--ease); }
.nav-profile:hover{ background:rgba(110,31,46,.06); }
.nav-profile__info{ text-align:right; }
.nav-profile__name{ margin:0; font-family:var(--serif); font-weight:700; font-size:.92rem; letter-spacing:-0.005em; color:var(--ink); white-space:nowrap; line-height:1.25; }
.nav-profile__username{ margin:0; font-family:var(--sans); font-size:.72rem; color:var(--ink-2); white-space:nowrap; }
.nav-profile__avatar{ flex-shrink:0; width:32px; height:32px; border-radius:50%; overflow:hidden; border:1px solid var(--line); }
.nav-profile__avatar-img{ width:100%; height:100%; object-fit:cover; display:block; }
.nav-profile__initials{ width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-family:var(--sans); font-weight:600; font-size:.68rem; background:var(--paper); color:var(--accent-ink); }
.nav-profile--skeleton{ display:flex; align-items:center; gap:.65rem; padding:.3rem .4rem; margin:-.3rem -.4rem; }
.nav-profile__text{ text-align:right; }
.nav-profile__line{ display:block; height:8px; width:64px; border-radius:2px; background:var(--line); margin-bottom:5px; animation:navPulse 1.5s ease-in-out infinite; }
.nav-profile__line--sm{ width:42px; margin-left:auto; margin-bottom:0; animation-delay:.2s; }
.nav-profile__avatar--skeleton{ width:32px; height:32px; border-radius:50%; background:var(--line); animation:navPulse 1.5s ease-in-out infinite; }
@keyframes navPulse{ 0%,100%{opacity:1;} 50%{opacity:.45;} }
@media (max-width:520px){ .nav-profile__info{ display:none; } }

/* ---- Reveal dictionary ---- */
[data-reveal]{ opacity:0; transform:translateY(30px); transition:opacity var(--slow) var(--ease), transform var(--slow) var(--ease); transition-delay:var(--rd,0s); }
[data-reveal].is-in{ opacity:1; transform:none; }
[data-reveal="rise"]{ transform:translateY(38px) scale(.92); transform-origin:center bottom; }
[data-reveal="rise"].is-in{ transform:none; }
[data-reveal="fade"]{ transform:none; opacity:0; }
[data-reveal="fade"].is-in{ opacity:1; }

/* ============ HERO H4 ============ */
.hero{ height:340vh; }
.hero__stage{ position:sticky; top:0; height:100vh; min-height:640px; overflow:hidden; display:grid; grid-template-columns:minmax(0,44%) minmax(0,56%); align-items:center; gap:clamp(1rem,4vw,4rem); padding:0 var(--pad); }
.hero__intro{ position:relative; z-index:5; max-width:34rem; }
.hero__title{ font-size:min(var(--fs-hero), 13vw); overflow-wrap:anywhere; }
.hero__title em{ display:block; }
.word-swap{ display:inline-block; overflow:hidden; height:1em; }
.word-swap__a11y{ position:absolute; width:1px; height:1px; margin:-1px; padding:0; border:0; clip:rect(0,0,0,0); overflow:hidden; white-space:nowrap; }
.word-swap__track{ display:flex; flex-direction:column; animation:wordSwap 10s cubic-bezier(.16,1,.3,1) infinite; }
.word-swap__track span{ display:block; height:1em; line-height:1; }
@keyframes wordSwap{ 0%,16%{transform:translateY(0);} 20%,36%{transform:translateY(-1em);} 40%,56%{transform:translateY(-2em);} 60%,76%{transform:translateY(-3em);} 80%,96%{transform:translateY(-4em);} 100%{transform:translateY(-5em);} }
@media (prefers-reduced-motion: reduce){ .word-swap__track{ animation:none; } }
.hero__sub{ margin:1.8rem 0 0; max-width:42ch; color:var(--ink-2); font-size:var(--fs-lead); line-height:1.55; }
.hero__cta{ display:flex; flex-wrap:wrap; gap:.9rem; margin-top:2.4rem; }
.hero__hint{ margin-top:3.2rem; display:inline-flex; align-items:center; gap:.6rem; font-size:.78rem; letter-spacing:.24em; text-transform:uppercase; color:var(--ink-2); }
.hero__hint svg{ width:14px; height:22px; animation:hintdrop 1.8s var(--ease) infinite; }
@keyframes hintdrop{ 0%,100%{transform:translateY(0);opacity:.4;} 50%{transform:translateY(4px);opacity:1;} }
.hero__art{ position:relative; z-index:2; height:min(76vh,660px); display:flex; align-items:center; justify-content:center; }
.stack{ position:relative; width:min(100%, 440px); height:100%; max-height:600px; }
.doc{ position:absolute; inset:0; background:var(--paper); border:1px solid var(--line); box-shadow:0 24px 70px rgba(12,10,8,.16); padding:clamp(1.4rem,3vw,2.4rem); transform-origin:center; transition:opacity var(--slow) var(--ease), transform var(--slow) var(--ease); }
.doc__tag{ font-size:.66rem; letter-spacing:.22em; text-transform:uppercase; color:var(--ink-2); display:flex; align-items:center; gap:.5rem; margin-bottom:1.1rem; }
.doc__tag svg{ width:13px; height:13px; }
.doc__photo{ width:100%; height:74px; margin-bottom:1.1rem; border:1px solid var(--line); background:#efeae1; display:block; }
.doc__lines{ display:flex; flex-direction:column; gap:.72rem; }
.ln{ height:9px; background:#2622203b; border-radius:2px; }
.ln.q{ background:#26222080; height:11px; }
.ln.w40{ width:40%; } .ln.w45{ width:45%; } .ln.w55{ width:55%; } .ln.w70{ width:70%; }
.ln.w85{ width:85%; } .ln.w100{ width:100%; } .ln.w30{ width:30%; }
.doc__group{ padding:.7rem .8rem; margin:0 -.2rem; border:1px solid transparent; border-radius:3px; transition:border-color var(--slow) var(--ease), background var(--slow) var(--ease); display:flex; flex-direction:column; gap:.6rem; }
.doc__field{ display:flex; align-items:center; gap:.65rem; }
.doc__field .ln{ flex:0 0 auto; }
.doc__ann{ display:inline-flex; align-items:center; gap:.35rem; font-size:.56rem; letter-spacing:.09em; text-transform:uppercase; font-weight:600; color:var(--accent-ink); white-space:nowrap; opacity:0; transform:translateX(-5px); transition:opacity .6s var(--ease), transform .6s var(--ease); }
.doc__ann::before{ content:""; width:14px; height:1px; background:var(--accent); flex:0 0 auto; }
.ln.correct{ transition:background var(--slow) var(--ease); }
.scan{ position:absolute; left:-2%; right:-2%; top:0; height:2px; background:var(--accent); box-shadow:0 0 0 1px rgba(12,10,8,.08); opacity:0; transition:opacity .6s var(--ease); z-index:6; }
.scan::before{ content:""; position:absolute; left:0; right:0; top:2px; height:44px; background:linear-gradient(to bottom, rgba(12,10,8,.10), rgba(12,10,8,0)); }
.cards{ position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; gap:.9rem; opacity:0; transform:translateY(26px) scale(.96); transition:opacity var(--slow) var(--ease), transform var(--slow) var(--ease); pointer-events:none; }
.qcard{ background:var(--paper); border:1px solid var(--line); box-shadow:0 18px 50px rgba(12,10,8,.14); padding:1.15rem 1.25rem; }
.qcard__meta{ display:flex; align-items:center; justify-content:space-between; font-size:.64rem; letter-spacing:.2em; text-transform:uppercase; color:var(--ink-2); margin-bottom:.9rem; }
.qcard__chip{ border:1px solid var(--line); padding:.15rem .5rem; }
.qcard__q{ font-family:var(--serif); font-weight:500; font-size:1.05rem; line-height:1.25; margin:0 0 .9rem; }
.opt{ display:flex; align-items:center; gap:.7rem; padding:.4rem 0; font-size:.92rem; color:var(--ink-2); }
.opt__dot{ width:15px; height:15px; border:1.5px solid var(--ink-2); border-radius:50%; flex:0 0 auto; position:relative; }
.opt.is-correct{ color:var(--ink); }
.opt.is-correct .opt__dot{ border-color:var(--accent); }
.opt.is-correct .opt__dot::after{ content:""; position:absolute; inset:3px; background:var(--accent); border-radius:50%; }
.hero__done{ position:absolute; left:0; right:0; bottom:-3.2rem; text-align:center; font-family:var(--serif); font-style:italic; font-weight:500; font-size:1.05rem; opacity:0; transform:translateY(8px); transition:opacity .8s var(--ease), transform .8s var(--ease); }
.callout{ position:absolute; z-index:7; font-size:.78rem; letter-spacing:.02em; color:var(--ink); white-space:nowrap; opacity:0; transform:translateY(6px); transition:opacity .7s var(--ease), transform .7s var(--ease); }
.callout.on{ opacity:1; transform:translateY(0); }
.callout b{ font-weight:600; color:var(--accent-ink); }
.callout .lead{ display:block; height:1px; width:24px; background:var(--accent); transform:scaleX(0); transition:transform .7s var(--ease); margin-bottom:.4rem; }
.callout.on .lead{ transform:scaleX(1); }
.callout--r{ text-align:right; } .callout--r .lead{ margin-left:auto; transform-origin:right; }
.callout--l{ text-align:left; } .callout--l .lead{ margin-right:auto; transform-origin:left; }
.c1{ top:1%; left:-6%; width:150px; } .c2{ top:25%; right:-7%; width:175px; } .c3{ top:58%; left:-7%; width:165px; } .c4{ top:82%; right:-6%; width:180px; }
.t1{ top:26%; right:-6%; width:160px; } .t2{ top:43%; left:-6%; width:180px; } .t3{ top:73%; right:-6%; width:160px; }
.hero__rail{ position:absolute; z-index:6; left:var(--pad); right:var(--pad); bottom:clamp(1rem,3vh,2.4rem); display:flex; align-items:center; gap:.8rem; font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); }
.hero__rail .st{ display:flex; align-items:center; gap:.8rem; transition:color .5s var(--ease); }
.hero__rail .st.on{ color:var(--accent-ink); font-weight:600; }
.hero__rail .arw{ width:22px; height:1px; background:var(--line); position:relative; }
.hero__rail .track{ flex:1; height:1px; background:var(--line); position:relative; }
.hero__rail .track::after{ content:""; position:absolute; left:0; top:0; height:1px; background:var(--accent); width:calc(var(--p,0) * 100%); }
@media (max-width:900px){ .hero__rail .arw{ width:14px; } .hero__rail{ gap:.5rem; font-size:.62rem; } }
.hero:not(.hero--static) .hero__art[data-phase="0"] .scan, .hero:not(.hero--static) .hero__art[data-phase="1"] .scan{ opacity:1; }
.hero:not(.hero--static) .scan{ top:calc(var(--p,0) * 108%); }
.hero:not(.hero--static) .hero__art[data-phase="1"] .doc__group, .hero:not(.hero--static) .hero__art[data-phase="2"] .doc__group{ border-color:var(--accent); background:rgba(200,151,46,.06); }
.hero:not(.hero--static) .hero__art[data-phase="2"] .doc__typetag, .hero:not(.hero--static) .hero__art[data-phase="3"] .doc__typetag{ opacity:1; transform:translateY(0); }
.hero:not(.hero--static) .hero__art[data-phase="2"] .doc__ann, .hero:not(.hero--static) .hero__art[data-phase="3"] .doc__ann{ opacity:1; transform:none; }
.hero:not(.hero--static) .hero__art[data-phase="2"] .ln.correct, .hero:not(.hero--static) .hero__art[data-phase="3"] .ln.correct{ background:var(--accent); }
.hero:not(.hero--static) .hero__art[data-phase="3"] .doc{ opacity:.1; transform:scale(.965); }
.hero:not(.hero--static) .hero__art[data-phase="3"] .cards{ opacity:1; transform:translateY(0) scale(1); }
.hero:not(.hero--static) .hero__art[data-phase="3"] .hero__done{ opacity:1; transform:translateY(0); }
.doc__typetag{ margin-top:1.7rem; display:inline-flex; align-items:center; gap:.45rem; font-size:.64rem; letter-spacing:.16em; text-transform:uppercase; border:1px solid var(--accent); padding:.28rem .55rem; color:var(--accent-ink); opacity:0; transform:translateY(6px); transition:opacity .7s var(--ease), transform .7s var(--ease); }
.hero--static{ height:auto; }
.hero--static .hero__stage{ position:static; height:auto; min-height:0; grid-template-columns:1fr; padding-top:calc(var(--step) * .8); padding-bottom:var(--step); gap:3.5rem; }
.hero--static .hero__art{ height:auto; }
.hero--static .stack{ height:auto; max-height:none; }
.hero--static .doc{ position:relative; opacity:1; transform:none; box-shadow:0 24px 70px rgba(12,10,8,.14); }
.hero--static .doc__group{ border-color:var(--accent); background:rgba(200,151,46,.06); }
.hero--static .doc__typetag{ opacity:1; transform:none; }
.hero--static .doc__ann{ opacity:1; transform:none; }
.hero--static .ln.correct{ background:var(--accent); }
.hero--static .scan{ display:none; }
.hero--static .cards{ position:relative; opacity:1; transform:none; margin-top:1.4rem; }
.hero--static .hero__done{ position:relative; bottom:auto; opacity:1; transform:none; margin-top:1.6rem; }
.hero--static .callout{ position:static; opacity:1; transform:none; width:auto !important; display:none; }
.hero--static .hero__rail{ display:none; }
.hero--static .hero__hint{ display:none; }
@media (max-width:480px){ .hero__title{ letter-spacing:-0.015em; line-height:1.04; overflow-wrap:anywhere; word-break:break-word; hyphens:auto; } .hero__title em{ letter-spacing:-0.01em; } }
@media (max-width:900px){
  .hero{ height:auto; }
  .hero__stage{ position:static; height:auto; min-height:0; grid-template-columns:1fr; padding-top:calc(var(--step) * .8); padding-bottom:var(--step); gap:3rem; }
  .hero__art{ height:auto; } .stack{ height:auto; max-height:none; } .doc{ position:relative; }
  .cards{ position:relative; margin-top:1.4rem; } .scan{ display:none; }
  .callout, .hero__rail, .hero__hint{ display:none; }
  .hero__done{ position:relative; bottom:auto; margin-top:1.4rem; }
}

/* ============ ТРИ ШАГА — S3 ============ */
.hows3{ border-top:1px solid var(--line); }
.hows3__head{ margin-bottom:clamp(2.4rem,6vh,5rem); }
.hows3__title{ font-size:min(var(--fs-h2), 9vw); }
.hows3__stairs{ list-style:none; margin:0; padding:0; }
.hows3__stair{ --gap:clamp(0px, 8vw, 148px); position:relative; margin-left:calc(var(--i) * var(--gap)); max-width:min(600px, 100%); display:grid; grid-template-columns:auto minmax(0,1fr); gap:clamp(1.1rem,3vw,2.2rem); align-items:start; padding:clamp(1.6rem,3.5vh,2.8rem) 0; border-top:1px solid var(--line); }
.hows3__stair:first-child{ border-top:0; }
.hows3__stair:not(:first-child)::before{ content:""; position:absolute; top:-1px; left:calc(-1 * var(--gap)); width:var(--gap); height:1px; background:var(--line); }
.hows3__stair:not(:first-child)::after{ content:""; position:absolute; top:-4px; left:-4px; width:7px; height:7px; border-radius:50%; background:var(--bg); border:1.5px solid var(--accent); }
.hows3__idx{ font-family:var(--serif); font-style:italic; font-weight:400; font-size:clamp(2.4rem,1.8rem + 4vw,4.6rem); line-height:.78; letter-spacing:-0.03em; color:var(--accent-ink); }
.hows3__ico{ color:var(--accent); margin-bottom:.95rem; }
.hows3__ico svg{ width:34px; height:34px; }
.hows3__h{ font-family:var(--serif); font-weight:700; font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem); margin:0 0 .6rem; letter-spacing:-0.01em; }
.hows3__t{ color:var(--ink-2); margin:0; font-size:var(--fs-body); max-width:46ch; }
@media (max-width:720px){
  .hows3__stair{ --gap:0px; margin-left:0; grid-template-columns:1fr; gap:.7rem; padding:1.6rem 0; }
  .hows3__stair:not(:first-child)::before, .hows3__stair:not(:first-child)::after{ display:none; }
  .hows3__idx{ font-size:clamp(2.2rem,10vw,3.2rem); line-height:1; }
}

/* ============ ТИПЫ ВОПРОСОВ ============ */
.types{ border-top:1px solid var(--line); }
.types__head{ display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:1.5rem; margin-bottom:clamp(2.5rem,6vh,5rem); }
.types__title{ font-size:min(var(--fs-h2), 9vw); max-width:16ch; }
.types__sub{ color:var(--ink-2); max-width:34ch; font-size:var(--fs-lead); }
.type-grid{ display:grid; grid-template-columns:repeat(6,1fr); gap:1px; background:var(--line); border:1px solid var(--line); }
.tcell{ background:var(--bg); padding:clamp(1.05rem,2.1vw,1.6rem); display:flex; flex-direction:column; gap:.85rem; min-height:150px; transition:background .5s var(--ease); }
.tcell:hover{ background:var(--paper); }
.tcell.big{ grid-column:span 4; } .tcell.mid{ grid-column:span 3; } .tcell.sm{ grid-column:span 2; } .tcell.tall{ min-height:178px; }
.tcell__vis{ flex:1; display:flex; align-items:center; min-height:64px; }
.tcell__vis svg{ width:100%; max-width:220px; height:auto; }
.tcell__name{ font-family:var(--serif); font-weight:700; font-size:1.1rem; letter-spacing:-0.01em; display:flex; align-items:baseline; gap:.6rem; }
.tcell__tag{ font-family:var(--sans); font-size:.62rem; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); border:1px solid var(--line); padding:.12rem .42rem; }
.tcell__d{ margin:.35rem 0 0; color:var(--ink-2); font-size:.84rem; }
@media (max-width:1000px){ .type-grid{ grid-template-columns:repeat(2,1fr); } .tcell.big,.tcell.mid,.tcell.sm{ grid-column:span 1; } }
@media (max-width:520px){ .type-grid{ grid-template-columns:1fr; } .tcell{ min-height:0; } }
.tv{ width:100%; display:flex; flex-direction:column; gap:.5rem; color:var(--ink); }
.tv-row{ display:flex; align-items:center; gap:.55rem; }
.tv-bar{ height:3px; border-radius:3px; background:currentColor; opacity:.3; flex:0 0 auto; }
.tv-radio{ width:15px; height:15px; border:1.5px solid var(--ink-2); border-radius:50%; position:relative; flex:0 0 auto; }
.tv-radio.is-correct{ border-color:var(--accent); }
.tv-radio.is-correct::after{ content:""; position:absolute; inset:3px; border-radius:50%; background:var(--accent); transform:scale(1); }
.tv-row.is-correct .tv-bar{ opacity:.55; color:var(--accent-ink); }
.tcell.is-in .tv--single .tv-radio.is-correct::after{ animation:tvDot .38s var(--ease) both; animation-delay:calc(var(--rd,0s) + .18s); }
@keyframes tvDot{ 0%{transform:scale(0);} 62%{transform:scale(1.18);} 100%{transform:scale(1);} }
.tv-check{ width:15px; height:15px; border:1.5px solid var(--ink-2); border-radius:3px; position:relative; flex:0 0 auto; }
.tv-check.is-on{ background:var(--accent); border-color:var(--accent); }
.tv-check svg{ position:absolute; inset:0; width:100%; height:100%; }
.tv-mk{ stroke:var(--paper); stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:14; stroke-dashoffset:0; }
.tcell.is-in .tv--multi .tv-check.is-on{ animation:tvBox .3s var(--ease) both; }
.tcell.is-in .tv--multi .tv-check.is-on .tv-mk{ animation:tvDraw .34s var(--ease) both; }
.tcell.is-in .tv--multi .tv-row:nth-child(1) .tv-check.is-on, .tcell.is-in .tv--multi .tv-row:nth-child(1) .tv-mk{ animation-delay:calc(var(--rd,0s) + .16s); }
.tcell.is-in .tv--multi .tv-row:nth-child(3) .tv-check.is-on, .tcell.is-in .tv--multi .tv-row:nth-child(3) .tv-mk{ animation-delay:calc(var(--rd,0s) + .34s); }
@keyframes tvBox{ 0%{background:transparent;border-color:var(--ink-2);} 100%{background:var(--accent);border-color:var(--accent);} }
@keyframes tvDraw{ 0%{stroke-dashoffset:14;} 100%{stroke-dashoffset:0;} }
.tv--match svg{ width:100%; max-width:230px; height:auto; }
.tv-node{ fill:none; stroke:var(--ink-2); stroke-width:1.4; }
.tv-wire{ fill:none; stroke:var(--accent); stroke-width:1.7; stroke-dasharray:100; stroke-dashoffset:0; }
.tcell.is-in .tv--match .tv-wire{ animation:tvWire .5s var(--ease) both; }
.tcell.is-in .tv--match .tv-wire:nth-of-type(1){ animation-delay:calc(var(--rd,0s) + .16s); }
.tcell.is-in .tv--match .tv-wire:nth-of-type(2){ animation-delay:calc(var(--rd,0s) + .30s); }
.tcell.is-in .tv--match .tv-wire:nth-of-type(3){ animation-delay:calc(var(--rd,0s) + .44s); }
@keyframes tvWire{ 0%{stroke-dashoffset:100;} 100%{stroke-dashoffset:0;} }
.tv-field{ display:inline-flex; align-items:center; border:1.5px solid var(--line); border-radius:4px; padding:.5rem .7rem; min-width:0; max-width:100%; }
.tv-typed{ display:inline-flex; align-items:center; font-family:var(--serif); font-size:1.05rem; white-space:nowrap; clip-path:inset(0 0 0 0); }
.tv-caret{ display:inline-block; width:2px; height:1.05em; margin-left:2px; background:var(--accent); animation:tvBlink 1s steps(1,end) infinite; }
.tcell.is-in .tv--fill .tv-typed{ animation:tvType .72s steps(7) both; animation-delay:calc(var(--rd,0s) + .16s); }
@keyframes tvType{ 0%{clip-path:inset(0 100% 0 0);} 100%{clip-path:inset(0 0 0 0);} }
@keyframes tvBlink{ 0%,49%{opacity:1;} 50%,100%{opacity:0;} }
.tv-num{ font-family:var(--serif); font-weight:700; font-size:.95rem; color:var(--accent-ink); width:1.1em; flex:0 0 auto; }
.tcell.is-in .tv--order .tv-row{ animation:tvSlot .44s var(--ease) both; }
.tcell.is-in .tv--order .tv-row:nth-child(1){ animation-delay:calc(var(--rd,0s) + .14s); }
.tcell.is-in .tv--order .tv-row:nth-child(2){ animation-delay:calc(var(--rd,0s) + .26s); }
.tcell.is-in .tv--order .tv-row:nth-child(3){ animation-delay:calc(var(--rd,0s) + .38s); }
@keyframes tvSlot{ 0%{transform:translateX(16px);opacity:0;} 100%{transform:none;opacity:1;} }
.tv-toggle{ display:inline-flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
.tv-toggle__lab{ font-family:var(--serif); font-size:1rem; color:var(--ink-2); }
.tv-toggle__lab--t{ color:var(--accent-ink); font-weight:600; }
.tv-toggle__track{ width:48px; height:25px; border-radius:25px; background:var(--accent); position:relative; flex:0 0 auto; }
.tv-toggle__knob{ position:absolute; top:3px; left:3px; width:19px; height:19px; border-radius:50%; background:var(--paper); box-shadow:0 1px 3px rgba(12,10,8,.25); transform:translateX(23px); }
.tcell.is-in .tv--bool .tv-toggle__knob{ animation:tvKnob .5s var(--ease) both; animation-delay:calc(var(--rd,0s) + .2s); }
.tcell.is-in .tv--bool .tv-toggle__track{ animation:tvTrack .5s var(--ease) both; animation-delay:calc(var(--rd,0s) + .2s); }
.tcell.is-in .tv--bool .tv-toggle__lab--t{ animation:tvOn .5s var(--ease) both; animation-delay:calc(var(--rd,0s) + .2s); }
@keyframes tvKnob{ 0%{transform:translateX(0);} 60%{transform:translateX(26px);} 100%{transform:translateX(23px);} }
@keyframes tvTrack{ 0%{background:var(--line);} 100%{background:var(--accent);} }
@keyframes tvOn{ 0%{color:var(--ink-2);} 100%{color:var(--accent-ink);} }
@media (max-width:900px){ .tcell .tv, .tcell .tv *{ animation:none !important; } .tv-caret{ opacity:1; } }

/* ============ ГОТОВЫЙ ТЕСТ ============ */
/* .demo is a permanently-dark band regardless of site theme — see --dark-bg/--dark-fg above. */
.demo{ background:var(--dark-bg); color:var(--dark-fg); position:relative; min-height:300vh; }
.demo__pin{ position:sticky; top:0; min-height:100vh; display:flex; align-items:center; overflow:hidden; padding:6vh 0; }
.demo__pin > .wrap{ width:100%; }
.demo__head{ margin-bottom:clamp(1.6rem,4vh,3rem); max-width:52ch; }
.demo__title{ font-size:min(var(--fs-h2), 9vw); color:var(--dark-fg); }
.demo__sub{ color:#b8b2a6; margin-top:1.2rem; }
.demo__frame{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.4fr); gap:clamp(1.5rem,4vw,4rem); border:1px solid #35312b; padding:clamp(1.6rem,4vw,3rem); }
.demo__left{ display:flex; flex-direction:column; gap:2rem; }
.demo__prog-label{ font-size:.78rem; letter-spacing:.14em; text-transform:uppercase; color:#b8b2a6; margin-bottom:.8rem; font-variant-numeric:tabular-nums; }
.demo__bar{ height:2px; background:#35312b; position:relative; overflow:hidden; }
.demo__bar i{ position:absolute; left:0; top:0; height:2px; width:100%; background:var(--accent-soft); transform-origin:left center; transform:scaleX(.083); }
.demo__nav{ display:grid; grid-template-columns:repeat(6,1fr); gap:.5rem; }
.demo__nav span{ aspect-ratio:1; display:flex; align-items:center; justify-content:center; border:1px solid #35312b; font-size:.85rem; color:#b8b2a6; transition:color .4s var(--ease), border-color .4s var(--ease), background-color .4s var(--ease); }
.demo__nav span.done{ border-color:#6a655c; color:var(--dark-fg); }
.demo__nav span.now{ background:var(--accent-soft); color:var(--dark-bg); border-color:var(--accent-soft); font-weight:700; }
.demo__stage{ position:relative; min-height:clamp(300px,44vh,440px); }
.demo__q{ position:absolute; inset:0; margin:auto 0; align-self:center; display:flex; flex-direction:column; justify-content:center; will-change:transform,opacity; opacity:0; }
.demo__q-num{ font-size:.78rem; letter-spacing:.14em; text-transform:uppercase; color:#b8b2a6; margin-bottom:1.2rem; }
.demo__q-text{ font-family:var(--serif); font-weight:500; font-size:clamp(1.3rem,1.1rem + 1.3vw,2rem); line-height:1.2; margin:0 0 2rem; letter-spacing:-0.01em; }
.match{ display:grid; grid-template-columns:minmax(0,1fr) clamp(80px,20%,150px) minmax(0,1fr); align-items:stretch; gap:0; }
.match__col{ display:grid; grid-template-rows:repeat(3,1fr); }
.match__item{ display:flex; align-items:center; min-height:56px; }
.match__col--l .match__item{ justify-content:flex-end; } .match__col--r .match__item{ justify-content:flex-start; }
.match__box{ border:1px solid #35312b; border-radius:8px; padding:.55rem .95rem; font-size:1rem; color:var(--dark-fg); background:transparent; white-space:nowrap; transition:color .4s var(--ease), border-color .4s var(--ease), background-color .4s var(--ease); }
.match__col--l .match__box{ font-family:var(--sans); font-weight:600; letter-spacing:.02em; }
.match__col--r .match__box{ font-family:var(--serif); }
.match__box.on{ color:var(--accent-soft); border-color:var(--accent-soft); background:rgba(227,195,122,.08); }
.match__wires{ width:100%; height:100%; display:block; overflow:visible; }
.match__wires .match__track{ stroke:#35312b; stroke-width:1.5; fill:none; vector-effect:non-scaling-stroke; }
.match__wires .match__draw{ stroke:var(--accent-soft); stroke-width:2; fill:none; stroke-linecap:round; vector-effect:non-scaling-stroke; }
.fill{ display:flex; flex-direction:column; gap:clamp(1rem,3vh,1.6rem); }
.fill__q{ font-size:.9rem; color:#b8b2a6; margin-bottom:.5rem; }
.fill__field{ display:flex; align-items:center; min-height:54px; border:1px solid #35312b; padding:.7rem 1rem; font-family:var(--serif); font-size:clamp(1.1rem,.9rem + 1vw,1.5rem); color:var(--dark-fg); transition:border-color .4s var(--ease); }
.fill__field.is-typing{ border-color:var(--accent-soft); } .fill__field.done{ border-color:#6a655c; }
.fill__text{ white-space:pre; }
.fill__caret{ display:inline-block; width:2px; height:1.15em; background:var(--accent-soft); margin-left:2px; opacity:0; }
.fill__field.is-typing .fill__caret{ opacity:1; animation:demoCaret 1s steps(1) infinite; }
@keyframes demoCaret{ 50%{opacity:0;} }
.demo__opts{ display:flex; flex-direction:column; }
.demo__opt{ display:flex; align-items:center; gap:1rem; padding:1rem 0; border-top:1px solid #35312b; font-size:1.05rem; color:#b8b2a6; transition:color .4s var(--ease); }
.demo__opt:last-child{ border-bottom:1px solid #35312b; }
.demo__opt .dot{ width:18px; height:18px; border:1.5px solid #6a655c; border-radius:50%; flex:0 0 auto; position:relative; transition:border-color .4s var(--ease); }
.demo__opt.is-scan{ color:var(--dark-fg); } .demo__opt.is-scan .dot{ border-color:var(--dark-fg); }
.demo__opt.correct{ color:var(--accent-soft); } .demo__opt.correct .dot{ border-color:var(--accent-soft); }
.demo__opt.correct .dot::after{ content:""; position:absolute; inset:4px; background:var(--accent-soft); border-radius:50%; }
.demo__opt .chk{ margin-left:auto; width:18px; height:18px; opacity:0; color:var(--accent-soft); transition:opacity .35s var(--ease); }
.demo__opt.correct .chk{ opacity:1; }
.demo__autocheck{ margin-top:1.6rem; display:inline-flex; align-items:center; gap:.6rem; font-size:.82rem; letter-spacing:.1em; text-transform:uppercase; color:#b8b2a6; }
.demo__autocheck svg{ width:15px; height:15px; }
.demo--static{ min-height:0; }
.demo--static .demo__pin{ position:static; min-height:0; overflow:visible; padding:0; }
.demo--static .demo__stage{ min-height:0; display:flex; flex-direction:column; gap:2.5rem; }
.demo--static .demo__q{ position:static; inset:auto; margin:0; opacity:1 !important; transform:none !important; }
.demo--static .demo__q + .demo__q{ border-top:1px solid #35312b; padding-top:2.5rem; }
@media (max-width:820px){ .demo__frame{ grid-template-columns:1fr; } .demo__nav{ grid-template-columns:repeat(12,1fr); } }
@media (max-width:520px){ .demo__nav{ grid-template-columns:repeat(6,1fr); } }
@media (max-width:900px), (max-height:640px){ .demo{ min-height:0; padding-top:var(--section-rhythm); padding-bottom:var(--section-rhythm); } .demo__pin{ position:static; min-height:0; overflow:visible; padding:0; } }

/* ============ ПРОФИЛЬ ОШИБОК — E1 ============ */
.errs{ border-top:1px solid var(--line); }
.errs__grid{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:clamp(2rem,6vw,6rem); align-items:center; }
.errs__title{ font-size:min(var(--fs-h2), 9vw); max-width:14ch; }
.errs__sub{ color:var(--ink-2); margin-top:1.5rem; max-width:46ch; font-size:var(--fs-lead); }
@media (max-width:820px){ .errs__grid{ grid-template-columns:1fr; gap:2.5rem; } }
.pcard{ background:var(--paper); border:1px solid var(--line); box-shadow:0 24px 70px rgba(12,10,8,.10); padding:clamp(1.6rem,3vw,2.4rem); position:relative; }
.pcard__flag{ position:absolute; top:1.2rem; right:1.2rem; font-size:.62rem; letter-spacing:.2em; text-transform:uppercase; color:var(--ink-2); border:1px solid var(--line); padding:.2rem .5rem; }
.pcard__name{ font-family:var(--serif); font-weight:700; font-size:1.8rem; letter-spacing:-0.01em; }
.pcard__class{ color:var(--ink-2); font-size:.9rem; margin-top:.2rem; }
.pcard__stats{ display:flex; gap:2.5rem; margin:1.8rem 0; padding:1.4rem 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.pstat b{ font-family:var(--serif); font-weight:700; font-size:2rem; display:block; line-height:1; letter-spacing:-0.02em; }
.pstat span{ font-size:.78rem; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-2); }
.pcard__weak-t{ font-size:.72rem; letter-spacing:.18em; text-transform:uppercase; color:var(--ink-2); margin-bottom:1rem; }
.weak{ position:relative; display:flex; align-items:center; justify-content:space-between; gap:.8rem; padding:.7rem 0; border-top:1px solid var(--line); overflow:hidden; }
.weak span{ font-family:var(--serif); font-style:italic; font-size:1.15rem; transition:color .35s var(--ease); }
.weak em{ font-style:normal; font-family:var(--sans); font-size:.8rem; color:var(--ink-2); }
.weak__meta{ display:flex; align-items:center; gap:.55rem; }
.weak__pct{ font-family:var(--sans); font-weight:700; font-size:.76rem; color:var(--accent-ink); opacity:0; transform:translateX(6px); transition:opacity .3s var(--ease), transform .3s var(--ease); }
.weak::after{ content:""; position:absolute; left:0; bottom:-1px; height:2px; width:var(--pct,50%); background:var(--accent); transform:scaleX(0); transform-origin:left; transition:transform .5s var(--ease); }
.weak:hover span{ color:var(--accent-ink); } .weak:hover .weak__pct{ opacity:1; transform:none; } .weak:hover::after{ transform:scaleX(1); }
.pcard--tilt{ transform:perspective(900px) rotateX(var(--tilt-x,0deg)) rotateY(var(--tilt-y,0deg)); transition:transform .4s var(--ease), box-shadow .4s var(--ease); will-change:transform; }
.pcard--tilt:hover{ box-shadow:0 34px 100px rgba(12,10,8,.18); }
.pcard--tilt::before{ content:""; position:absolute; inset:0; pointer-events:none; opacity:0; background:radial-gradient(260px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,.55), transparent 62%); mix-blend-mode:soft-light; transition:opacity .4s var(--ease); }
.pcard--tilt:hover::before{ opacity:1; }
@media (hover:none){ .pcard--tilt{ transform:none !important; } .pcard--tilt::before{ display:none; } }

/* ============ ЛИМИТЫ ============ */
.limits{ border-top:1px solid var(--line); }
.limits__title{ font-size:min(var(--fs-h2), 9vw); margin-bottom:clamp(2.5rem,6vh,4.5rem); }
.tiers{ display:grid; grid-template-columns:repeat(3,1fr); border:1px solid var(--line); background:var(--line); gap:1px; }
.tier{ background:var(--bg); padding:clamp(1.8rem,3.4vw,3rem); display:flex; flex-direction:column; }
.tier__k{ font-size:.74rem; letter-spacing:.2em; text-transform:uppercase; color:var(--ink-2); margin-bottom:1.4rem; display:flex; align-items:center; gap:.6rem; }
.tier__k svg{ width:16px; height:16px; }
.tier__k--accent{ color:var(--accent-ink); }
.tier__v{ font-family:var(--serif); font-weight:500; font-size:calc(var(--fs-lead) + .2rem); line-height:1.3; letter-spacing:-0.01em; margin:0; }
.tier__price{ margin:1.6rem 0 0; font-family:var(--serif); font-style:italic; font-size:1.15rem; color:var(--accent-ink); }
.tier__price--soon{ display:inline-flex; align-items:center; gap:.45rem; font-family:var(--sans); font-style:normal; font-weight:600; font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2); border:1px solid var(--line); border-radius:999px; padding:.4rem .8rem .4rem .65rem; }
.tier__price--soon::before{ content:""; width:6px; height:6px; border-radius:50%; background:var(--accent-soft); flex:0 0 auto; }
.tier__buy{ margin-top:1.1rem; align-self:flex-start; }
.tier--vip{ background:var(--paper); }
@media (max-width:760px){ .tiers{ grid-template-columns:1fr; } }

/* ============ FAQ ============ */
.faq{ border-top:1px solid var(--line); }
.faq__grid{ display:grid; grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr); gap:clamp(2rem,6vw,5rem); align-items:start; }
.faq__title{ font-size:min(var(--fs-h2), 9vw); position:sticky; top:2rem; }
.faq__list{ border-top:1px solid var(--line); }
.faq details{ border-bottom:1px solid var(--line); }
.faq summary{ list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:1.5rem; padding:1.6rem 0; font-family:var(--serif); font-weight:500; font-size:clamp(1.15rem,1.05rem + .6vw,1.5rem); letter-spacing:-0.01em; }
.faq summary::-webkit-details-marker{ display:none; }
.faq summary .pm{ flex:0 0 auto; width:20px; height:20px; position:relative; }
.faq summary .pm::before,.faq summary .pm::after{ content:""; position:absolute; background:var(--accent-ink); left:0; top:50%; width:100%; height:1.5px; transform:translateY(-50%); transition:transform .5s var(--ease); }
.faq summary .pm::after{ transform:translateY(-50%) rotate(90deg); }
.faq details[open] summary .pm::after{ transform:translateY(-50%) rotate(0); }
.faq__a{ padding:0 0 1.8rem; color:var(--ink-2); max-width:60ch; margin:0; font-size:var(--fs-body); }
@media (max-width:820px){ .faq__grid{ grid-template-columns:1fr; gap:2rem; } .faq__title{ position:static; } }

/* ============ ФИНАЛ + ФУТЕР ============ */
/* .final (with the .foot footer nested inside it) is a permanently-dark band — see --dark-bg/--dark-fg above. */
.final{ background:var(--dark-bg); color:var(--dark-fg); text-align:center; }
.final__inner{ padding-top:clamp(6rem,16vh,14rem); padding-bottom:clamp(6rem,16vh,14rem); }
.final__phrase{ font-family:var(--serif); font-weight:900; font-size:min(var(--fs-hero), 13vw); line-height:.95; letter-spacing:var(--tracking-display); color:var(--dark-fg); margin:0 auto; max-width:14ch; }
.final__phrase em{ font-style:italic; font-weight:400; color:var(--accent-soft); }
.final__cta{ margin-top:3rem; display:flex; flex-wrap:wrap; gap:.9rem; justify-content:center; }
.final__note{ margin:1.4rem 0 0; font-size:.82rem; letter-spacing:.02em; color:#b8b2a6; }
.final__note b{ color:var(--accent-soft); font-weight:600; }
.foot{ border-top:1px solid #35312b; }
.foot__inner{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1.2rem; padding:2rem var(--pad); }
.foot__brand{ font-family:var(--serif); font-size:.98rem; color:#b8b2a6; }
.foot__links{ display:flex; gap:1.8rem; }
.foot__links a{ font-size:.82rem; color:#b8b2a6; text-decoration:none; transition:color .4s var(--ease); }
.foot__links a:hover{ color:var(--dark-fg); }

/* ============ БЛОК B — scrub ============ */
/* .scrub is a permanently-dark band regardless of site theme — see --dark-bg/--dark-fg above. */
.scrub{ position:relative; background:var(--dark-bg); color:var(--dark-fg); min-height:240vh; }
.scrub__sticky{ position:sticky; top:0; min-height:100vh; display:flex; align-items:center; overflow:hidden; }
.scrub__inner{ width:100%; text-align:center; padding-top:6vh; padding-bottom:6vh; }
.scrub__eyebrow{ font-family:var(--sans); font-size:.76rem; font-weight:600; letter-spacing:.22em; text-transform:uppercase; color:#b8b2a6; margin:0 0 clamp(1.6rem,5vh,3rem); }
.scrub__figure{ display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:clamp(.6rem,2vw,1.6rem); max-width:820px; margin:0 auto clamp(2rem,6vh,3.4rem); }
.scrub__end{ font-family:var(--serif); font-weight:700; font-style:italic; font-size:clamp(1.1rem,.9rem + 1.4vw,1.9rem); letter-spacing:-0.01em; color:var(--accent-soft); white-space:nowrap; }
.scrub__wire{ width:100%; height:56px; display:block; overflow:visible; }
.scrub__wire .track{ stroke:#35312b; stroke-width:1.5; fill:none; }
.scrub__wire .draw{ stroke:var(--accent-soft); stroke-width:2; fill:none; stroke-linecap:round; }
.scrub__wire .wp{ fill:var(--dark-bg); stroke:#35312b; stroke-width:1.5; transition:fill .4s var(--ease), stroke .4s var(--ease); }
.scrub__wire .wp.on{ fill:var(--accent-soft); stroke:var(--accent-soft); }
.scrub__result{ position:relative; }
.scrub__payoff{ opacity:1; will-change:opacity, transform; }
.scrub__payoff-note{ position:absolute; left:0; right:0; top:50%; transform:translateY(-50%); margin:0; font-family:var(--sans); font-size:.82rem; font-weight:500; letter-spacing:.03em; color:#8b857a; text-align:center; pointer-events:none; }
.scrub__stat{ display:flex; align-items:baseline; justify-content:center; gap:clamp(.6rem,2vw,1.4rem); flex-wrap:wrap; }
.scrub__num{ font-family:var(--serif); font-weight:900; line-height:.9; font-size:clamp(5rem,18vw,15rem); letter-spacing:var(--tracking-display); color:var(--dark-fg); font-variant-numeric:tabular-nums; }
.scrub__unit{ font-family:var(--serif); font-style:italic; font-weight:400; font-size:clamp(1.4rem,1rem + 3vw,3.4rem); color:var(--accent-soft); }
.scrub__time{ margin:clamp(1.4rem,4vh,2.4rem) 0 0; color:#b8b2a6; font-size:var(--fs-lead); letter-spacing:.02em; }
.scrub__time b{ color:var(--dark-fg); font-weight:600; font-variant-numeric:tabular-nums; }
.scrub__phase{ position:relative; max-width:520px; margin:0 auto clamp(1.4rem,5vh,2.6rem); height:clamp(104px,17vh,148px); }
.scrub__ph{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:clamp(.6rem,1.6vh,1rem); opacity:0; transform:translateY(10px); transition:opacity .45s var(--ease), transform .45s var(--ease); pointer-events:none; }
.scrub__ph.on{ opacity:1; transform:none; }
.scrub__ph-label{ font-family:var(--sans); font-size:.78rem; font-weight:600; letter-spacing:.2em; text-transform:uppercase; color:var(--accent-soft); }
.scrub__bar{ width:min(300px,62vw); height:5px; border-radius:99px; background:#35312b; overflow:hidden; }
.scrub__bar-fill{ display:block; height:100%; width:100%; border-radius:99px; background:var(--accent-soft); transform:scaleX(0); transform-origin:left center; will-change:transform; }
.scrub__pct{ font-family:var(--serif); font-weight:700; font-size:clamp(1.3rem,1rem + 1.6vw,1.9rem); color:var(--dark-fg); font-variant-numeric:tabular-nums; letter-spacing:.01em; }
.scrub__spin{ width:36px; height:36px; border-radius:50%; border:3px solid #35312b; border-top-color:var(--accent-soft); }
.scrub__ph--scan.on .scrub__spin{ animation:scrubSpin .82s linear infinite; }
@keyframes scrubSpin{ to{ transform:rotate(360deg); } }
.scrub__scan{ width:min(240px,54vw); display:flex; flex-direction:column; gap:7px; }
.scrub__scan i{ height:4px; border-radius:99px; background:#35312b; position:relative; overflow:hidden; }
.scrub__scan i::after{ content:""; position:absolute; inset:0; border-radius:99px; background:var(--accent-soft); transform-origin:center; transform:scaleX(.28); opacity:.18; }
.scrub__ph--scan.on .scrub__scan i::after{ animation:scrubShimmer 1.5s var(--ease) infinite; }
.scrub__ph--scan.on .scrub__scan i:nth-child(2)::after{ animation-delay:.22s; }
.scrub__ph--scan.on .scrub__scan i:nth-child(3)::after{ animation-delay:.44s; }
@keyframes scrubShimmer{ 0%,100%{transform:scaleX(.28);opacity:.18;} 50%{transform:scaleX(1);opacity:.9;} }
.scrub__chips{ display:flex; flex-wrap:wrap; justify-content:center; gap:7px; max-width:min(300px,68vw); }
.scrub__chips i{ width:10px; height:10px; border-radius:3px; background:#35312b; opacity:.4; transform:scale(.5); transition:opacity .3s var(--ease), transform .3s var(--ease), background .3s var(--ease); }
.scrub__chips i.on{ opacity:1; transform:none; background:var(--accent-soft); }
@media (prefers-reduced-motion: reduce){ .scrub__ph--scan.on .scrub__spin{ animation:none; } .scrub__ph--scan.on .scrub__scan i::after{ animation:none; transform:scaleX(1); opacity:.55; } }
.scrub--static{ min-height:0; }
.scrub--static .scrub__sticky{ position:static; min-height:0; }
@media (max-width:900px){ .scrub{ min-height:0; padding-top:var(--section-rhythm); padding-bottom:var(--section-rhythm); } .scrub__sticky{ position:static; min-height:0; } }

/* ============ БЛОК A — prog ============ */
.prog{ background:var(--paper); border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.prog__head{ max-width:56ch; margin-bottom:clamp(2.6rem,7vh,5rem); }
.prog__title{ font-size:min(var(--fs-h2), 9vw); max-width:16ch; }
.prog__track{ position:relative; padding-left:clamp(2.8rem,6vw,5rem); }
.prog__spine{ position:absolute; left:clamp(.6rem,1.6vw,1.4rem); top:0; bottom:0; width:2px; background:var(--line); }
.prog__fill{ position:absolute; left:0; top:0; width:100%; height:100%; background:linear-gradient(var(--accent-soft), var(--accent)); transform-origin:top; transform:scaleY(1); transition:transform .12s linear; will-change:transform; }
.prog--live .prog__fill{ transform:scaleY(var(--pfill,0)); }
.prog__list{ list-style:none; margin:0; padding:0; position:relative; }
.prog__step{ position:relative; display:grid; grid-template-columns:auto minmax(0,1fr); gap:clamp(1rem,3vw,2.4rem); align-items:center; padding:clamp(1.6rem,4.5vh,3.4rem) 0; }
.prog__node{ position:absolute; left:calc(-1 * clamp(2.2rem,4.4vw,3.6rem)); top:50%; transform:translate(-50%,-50%); width:16px; height:16px; border-radius:50%; background:var(--accent); border:2px solid var(--paper); box-shadow:0 0 0 1px var(--accent); transition:background .45s var(--ease), box-shadow .45s var(--ease), transform .45s var(--ease); }
.prog__num{ font-family:var(--serif); font-weight:400; font-style:italic; font-size:clamp(2.2rem,1.6rem + 3vw,4.6rem); line-height:1; color:var(--accent-ink); letter-spacing:-0.02em; min-width:2.2ch; text-align:right; }
.prog__label{ font-family:var(--serif); font-weight:500; font-size:clamp(1.15rem,1rem + 1vw,1.9rem); line-height:1.15; letter-spacing:-0.01em; margin:0; color:var(--ink); }
.prog--live .prog__node{ background:var(--line); box-shadow:0 0 0 1px var(--line); }
.prog--live .prog__num{ color:var(--ink-2); opacity:.45; transition:opacity .45s var(--ease), color .45s var(--ease); }
.prog--live .prog__label{ color:var(--ink-2); transition:color .45s var(--ease); }
.prog--live .prog__step.is-active .prog__node{ background:var(--accent); box-shadow:0 0 0 1px var(--accent), 0 0 0 7px rgba(200,151,46,.14); transform:translate(-50%,-50%) scale(1.15); }
.prog--live .prog__step.is-active .prog__num{ color:var(--accent-ink); opacity:1; }
.prog--live .prog__step.is-active .prog__label{ color:var(--ink); }
@media (max-width:560px){ .prog__step{ grid-template-columns:1fr; gap:.4rem; } .prog__num{ text-align:left; } }

/* ============ МОДАЛКА ЗАГРУЗКИ ============ */
.upload{ position:fixed; inset:0; z-index:200; display:flex; align-items:center; justify-content:center; padding:4vh 1rem; overflow-y:auto; opacity:0; pointer-events:none; transition:opacity .35s var(--ease); }
.upload[data-open="1"]{ opacity:1; pointer-events:auto; }
.upload__backdrop{ position:fixed; inset:0; background:rgba(12,10,8,.62); cursor:pointer; }
.upload__shell{ position:relative; z-index:1; display:flex; flex-direction:column; width:100%; max-width:560px; max-height:88vh; overflow-y:auto; transform:translateY(14px) scale(.98); transition:transform .35s var(--ease); outline:none; background:var(--paper); border:1px solid var(--line); color:var(--ink); box-shadow:0 40px 120px rgba(12,10,8,.35); padding:clamp(1.8rem,4vw,2.8rem); }
.upload[data-open="1"] .upload__shell{ transform:none; }
.upload__close{ position:absolute; top:1rem; right:1rem; z-index:2; width:34px; height:34px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid var(--line); cursor:pointer; color:inherit; transition:border-color .3s var(--ease), transform .3s var(--ease); }
.upload__close:hover{ border-color:currentColor; transform:rotate(90deg); }
.upload__close svg{ width:16px; height:16px; }
.upload__step{ display:flex; flex-direction:column; align-items:center; text-align:center; }
.upload__actions{ display:flex; flex-direction:column; align-items:center; gap:.9rem; margin-top:1.6rem; width:100%; }
.m1-drop{ width:100%; border:1.5px dashed var(--line); padding:clamp(2.2rem,6vw,3.4rem) 1.5rem; display:flex; flex-direction:column; align-items:center; gap:1rem; transition:border-color .3s var(--ease), background .3s var(--ease); cursor:pointer; }
.m1-drop.is-drag{ border-color:var(--accent); background:rgba(12,10,8,.03); }
.m1-drop__ic{ width:32px; height:32px; color:var(--ink-2); }
.m1-drop__t{ margin:0; font-family:var(--serif); font-size:1.1rem; line-height:1.4; }
.m1-drop__f{ font-size:.72rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-2); }
.m1-scan{ position:relative; width:90px; height:116px; margin-bottom:1.3rem; overflow:hidden; }
.m1-scan__doc{ width:100%; height:100%; display:block; filter:drop-shadow(0 10px 24px rgba(12,10,8,.18)); }
.m1-scan__line{ position:absolute; left:-4px; right:-4px; height:2px; top:0; background:var(--accent); box-shadow:0 0 12px 1px var(--accent-soft); will-change:top; transition:top .2s linear; }
.m1-proc__label{ margin:0 0 .6rem; font-size:.78rem; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); }
.m1-proc__pct{ font-family:var(--serif); font-weight:700; font-size:2.4rem; letter-spacing:-0.01em; }
.m1-proc__file{ margin:.6rem 0 0; font-size:.82rem; color:var(--ink-2); word-break:break-all; }
.m1-result__ic{ width:40px; height:40px; color:var(--accent); margin-bottom:.9rem; }
.m1-result__t{ margin:0 0 .3rem; font-family:var(--serif); font-weight:700; font-size:1.6rem; letter-spacing:-0.01em; }
.m1-result__f{ margin:0; font-size:.84rem; color:var(--ink-2); word-break:break-all; }
.m1-result__stats{ display:flex; gap:2rem; margin:1.3rem 0 0; }
.m1-error__ic{ width:38px; height:38px; color:var(--accent-ink); margin-bottom:.9rem; }
.m1-error__f{ margin:0 0 1.6rem; font-size:.88rem; color:var(--ink-2); max-width:38ch; }
@keyframes uploadErrorShake{ 0%,100%{transform:translateX(0);} 20%{transform:translateX(-10px);} 40%{transform:translateX(8px);} 60%{transform:translateX(-6px);} 80%{transform:translateX(4px);} }
[data-upload-step="error"].is-shake{ animation:uploadErrorShake .45s cubic-bezier(.36,.07,.19,.97); }
.result-tags{ display:flex; gap:.5rem; flex-wrap:wrap; justify-content:center; margin:1.2rem 0 0; }
.result-tag{ font-family:var(--sans); font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2); padding:.28rem .6rem; border:1px solid var(--line); }
.result-preview{ width:100%; margin-top:1.4rem; text-align:left; }
.result-dots{ display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin-top:.8rem; }
.result-dot{ width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-family:var(--mono); font-size:10px; cursor:pointer; border:1px solid var(--line); background:var(--paper); color:var(--ink-2); }
.result-dot.on{ border-color:var(--accent); background:var(--accent); color:var(--accent-text); }
.result-guest{ margin-top:1.2rem; padding:.8rem 1rem; border:1px dashed var(--line); font-size:.82rem; color:var(--ink-2); line-height:1.5; text-align:left; width:100%; }
@media (max-width:560px){ .upload{ padding:0; align-items:flex-end; } .upload__shell{ max-width:none; max-height:92vh; } }

/* ============ Полноэкранная drop-зона (глобальный drag&drop файла) ============ */
.drop-overlay{ position:fixed; inset:1vh 1vw; z-index:250; border:2px dashed var(--accent); background:transparent; display:flex; align-items:center; justify-content:center; pointer-events:none; animation:dropOverlayIn .18s var(--ease) both; }
.drop-overlay__box{ display:flex; flex-direction:column; align-items:center; text-align:center; background:var(--paper); border:1px solid var(--line); padding:2rem 2.8rem; box-shadow:0 30px 80px rgba(12,10,8,.22); }
.drop-overlay__ic{ width:44px; height:44px; color:var(--accent); margin:0 auto 1rem; }
.drop-overlay__t{ font-family:var(--serif); font-weight:700; font-size:clamp(1.4rem,3.2vw,2rem); letter-spacing:-0.01em; color:var(--accent); margin:0; }
.drop-overlay__f{ display:block; margin-top:.5rem; font-size:.78rem; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2); }
@keyframes dropOverlayIn{ from{opacity:0;} to{opacity:1;} }
@media (prefers-reduced-motion: reduce){ .drop-overlay{ animation:none; } }

/* ============ Reduced-motion ============ */
@media (prefers-reduced-motion: reduce){
  .pdf3 *,.pdf3 *::before,.pdf3 *::after{ animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
  [data-reveal]{ opacity:1 !important; transform:none !important; }
  .callout{ opacity:1 !important; transform:none !important; }
  .hero__hint svg{ animation:none; }
}
`

// ── Question types returned by /api/pdf-to-test ────────────────
type PQ =
  | { type: 'single'; question: string; options: string[]; correct: number }
  | { type: 'multi';  question: string; options: string[]; correct: number[] }
  | { type: 'match';  question?: string; pairs: [string, string][] }
  | { type: 'fill';   question: string; answer: string }
  | { type: 'bool';   statement: string; correct: boolean }
  | { type: 'order';  question?: string; items: string[] }

interface TestResult {
  title: string
  questions: PQ[]
  pageCount: number
  ocr: boolean
  isGuest: boolean
  guestLimit: number | null
  totalChars: number
}

// ── Interactive preview primitives (real /api/check-answer wired for fill-in) ──────────────
function SingleChoice({ question, options, correct }: { question?: string; options: string[]; correct: number }) {
  const t = useTranslations('PdfInfoPage')
  const [sel, setSel] = useState<number | null>(null)
  return (
    <div>
      {question && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--ink)', lineHeight: 1.4 }}>{question}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((o, i) => {
          const on = sel === i
          const isCorrect = correct === i
          const showState = sel !== null && (on || isCorrect)
          return (
            <button key={i} type="button" onClick={() => setSel(i)} style={{
              display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', cursor: 'pointer',
              border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : 'var(--paper)',
              color: on ? 'var(--btn-fg)' : 'var(--ink)', padding: '11px 13px', borderRadius: 'var(--radius)',
              font: 'inherit', fontSize: 14, transition: 'border-color .12s, background .12s', width: '100%',
            }}>
              <span style={{ width: 18, height: 18, flexShrink: 0, border: `1.5px solid ${on ? 'var(--btn-fg)' : 'var(--ink-3)'}`, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 10 }}>
                {on ? '✓' : String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: 1 }}>{o}</span>
              {showState && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', opacity: 0.8 }}>{isCorrect ? t('sc_correct') : (on ? t('sc_wrong') : '')}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MultiChoice({ options }: { options: string[] }) {
  const [sel, setSel] = useState([1])
  const toggle = (i: number) => setSel(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {options.map((o, i) => {
        const on = sel.includes(i)
        return (
          <button key={i} type="button" onClick={() => toggle(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', font: 'inherit', fontSize: 13.5, border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--paper)', color: 'var(--ink)', padding: '9px 11px', borderRadius: 'var(--radius)', width: '100%' }}>
            <span style={{ width: 16, height: 16, flexShrink: 0, border: `1.5px solid ${on ? 'var(--ink)' : 'var(--ink-3)'}`, background: on ? 'var(--ink)' : 'var(--paper)', color: 'var(--btn-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{on ? '✓' : ''}</span>
            {o}
          </button>
        )
      })}
    </div>
  )
}

function MatchPairs({ left, right }: { left: string[]; right: string[] }) {
  const t = useTranslations('PdfInfoPage')
  const [val, setVal] = useState(left.map(() => ''))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {left.map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13.5, flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg)' }}>{l}</span>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', fontSize: 13 }}>→</span>
          <select value={val[i]} onChange={e => setVal(v => v.map((x, j) => j === i ? e.target.value : x))} style={{ flex: 1, font: 'inherit', fontSize: 13.5, padding: 8, border: `1px solid ${val[i] ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 'var(--radius)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
            <option value="">{t('match_select')}</option>
            {right.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      ))}
    </div>
  )
}

function FillIn({ answer, placeholder, question }: { answer: string; placeholder: string; question?: string }) {
  const t = useTranslations('PdfInfoPage')
  const [v, setV] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'wrong'>('idle')
  const [hint, setHint] = useState<string | null>(null)

  const check = async () => {
    if (!v.trim()) return
    setStatus('loading')
    setHint(null)
    try {
      const res = await fetch('/api/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAnswer: v, correctAnswer: answer, question }),
      })
      const data = await res.json()
      setStatus(data.ok ? 'ok' : 'wrong')
      setHint(data.hint ?? null)
    } catch {
      const ok = v.trim().toLowerCase() === answer.trim().toLowerCase()
      setStatus(ok ? 'ok' : 'wrong')
    }
  }

  const borderColor = status === 'ok' ? 'var(--ink)' : status === 'wrong' ? 'var(--ink-3)' : 'var(--line)'
  const statusText =
    status === 'loading' ? '…' :
    status === 'ok'      ? t('fill_ok') :
    status === 'wrong'   ? `✗ ${hint ?? t('fill_try')}` :
    t('fill_idle')

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={v}
          placeholder={placeholder}
          onChange={e => { setV(e.target.value); setStatus('idle'); setHint(null) }}
          onKeyDown={e => e.key === 'Enter' && check()}
          style={{ flex: 1, font: 'inherit', fontSize: 14, padding: '10px 12px', border: `1px solid ${borderColor}`, borderRadius: 'var(--radius)', outline: 'none', background: 'var(--paper)', color: 'var(--ink)', transition: 'border-color .15s' }}
        />
        <button type="button" onClick={check} disabled={status === 'loading'} className="btn btn--solid" style={{ padding: '10px 14px', fontSize: 13, opacity: status === 'loading' ? 0.6 : 1 }}>
          {status === 'loading' ? '…' : 'OK'}
        </button>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 9, color: status === 'ok' ? 'var(--ink)' : status === 'wrong' ? 'var(--ink-3)' : 'var(--ink-2)', minHeight: 14, transition: 'color .15s' }}>
        {statusText}
      </div>
    </div>
  )
}

function OrderingQ({ items: init }: { items: string[] }) {
  const [items, setItems] = useState(init)
  const move = (i: number, d: number) => setItems(arr => {
    const j = i + d; if (j < 0 || j >= arr.length) return arr
    const next = arr.slice();[next[i], next[j]] = [next[j], next[i]]; return next
  })
  const ordBtn: React.CSSProperties = { font: 'inherit', fontSize: 9, lineHeight: 1, cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', width: 20, height: 13, color: 'var(--ink-2)', padding: 0 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((it, i) => (
        <div key={it} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--paper)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', width: 14 }}>{i + 1}</span>
          <span style={{ fontSize: 13.5, flex: 1 }}>{it}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button type="button" onClick={() => move(i, -1)} style={ordBtn}>▲</button>
            <button type="button" onClick={() => move(i, 1)} style={ordBtn}>▼</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function TrueFalseQ({ statement }: { statement: string }) {
  const t = useTranslations('PdfInfoPage')
  const [v, setV] = useState<boolean | null>(null)
  return (
    <div>
      <div style={{ fontSize: 13.5, lineHeight: 1.45, marginBottom: 14, color: 'var(--ink)' }}>{statement}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[[t('tf_true'), true], [t('tf_false'), false]].map(([lbl, val]) => {
          const on = v === val
          return (
            <button key={String(lbl)} type="button" onClick={() => setV(val as boolean)} style={{ flex: 1, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '11px 0', border: `1.5px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : 'var(--paper)', color: on ? 'var(--btn-fg)' : 'var(--ink)', borderRadius: 'var(--radius)' }}>{lbl}</button>
          )
        })}
      </div>
    </div>
  )
}

function QuestionPreview({ q, idx, total }: { q: PQ; idx: number; total: number }) {
  const t = useTranslations('PdfInfoPage')
  const label = { single: t('qtype_single'), multi: t('qtype_multi'), match: t('qtype_match'), fill: t('qtype_fill'), bool: t('qtype_bool'), order: t('qtype_order') }[q.type]
  return (
    <div className="result-preview">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: 10 }}>{t('done_q_num', { idx: idx + 1, total, label })}</div>
      {q.type === 'single' && <SingleChoice question={q.question} options={q.options} correct={q.correct} />}
      {q.type === 'multi' && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>{q.question}</div>
          <MultiChoice options={q.options} />
        </div>
      )}
      {q.type === 'bool' && <TrueFalseQ statement={q.statement} />}
      {q.type === 'fill' && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>{q.question}</div>
          <FillIn answer={q.answer} placeholder={t('fill_placeholder')} question={q.question} />
        </div>
      )}
      {q.type === 'match' && (
        <div>
          {q.question && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{q.question}</div>}
          <MatchPairs left={q.pairs.map(p => p[0])} right={q.pairs.map(p => p[1])} />
        </div>
      )}
      {q.type === 'order' && (
        <div>
          {q.question && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{q.question}</div>}
          <OrderingQ items={q.items} />
        </div>
      )}
    </div>
  )
}

// ── Site nav ─────────────────────────────────────────────────
// Re-skinned copy of widgets/ProfilePreview for this page's own site-nav (same useMe()/Header
// i18n logic, restyled to the page's serif/sans + bordo palette instead of the app-wide header CSS).
function ProfileNav() {
  const t = useTranslations('Header')
  const { data: user, isLoading } = useMe()

  if (isLoading) {
    return (
      <div className="nav-profile nav-profile--skeleton" aria-hidden="true">
        <div className="nav-profile__text">
          <span className="nav-profile__line" />
          <span className="nav-profile__line nav-profile__line--sm" />
        </div>
        <div className="nav-profile__avatar nav-profile__avatar--skeleton" />
      </div>
    )
  }

  if (!user) {
    return (
      <Link href="/login" className="nav-profile">
        <div className="nav-profile__info">
          <p className="nav-profile__name">{t('loginTitle')}</p>
          <p className="nav-profile__username">{t('loginSub')}</p>
        </div>
        <div className="nav-profile__avatar">
          <span className="nav-profile__initials">?</span>
        </div>
      </Link>
    )
  }

  const href = user.role === 'TEACHER' ? '/teacher-profile' : '/student-profile'
  const username = user.email.split('@')[0]

  return (
    <Link href={href} className="nav-profile">
      <div className="nav-profile__info">
        <p className="nav-profile__name">{user.name}</p>
        <p className="nav-profile__username">@{username}</p>
      </div>
      <div className="nav-profile__avatar">
        {user.avatarUrl
          ? <Image width={72} height={72} src={user.avatarUrl} alt={user.name} className="nav-profile__avatar-img" />
          : <span className="nav-profile__initials">{user.name.slice(0, 2).toUpperCase()}</span>}
      </div>
    </Link>
  )
}

function SiteNav({ onOpenUpload }: { onOpenUpload: () => void }) {
  const t = useTranslations('PdfInfoPage')
  return (
    <header className="site-nav">
      <Link className="brand" href="/">{t('nav_brand')}</Link>
      <nav className="site-nav__links" aria-label={t('nav_brand')}>
        <a href="#how">{t('nav_how')}</a>
        <a href="#types">{t('nav_types')}</a>
        <a href="#demo">{t('nav_demo')}</a>
        <a href="#errs">{t('nav_errs')}</a>
        <a href="#limits">{t('nav_limits')}</a>
        <button type="button" className="site-nav__cta" onClick={onOpenUpload}>{t('nav_cta')}</button>
        <ProfileNav />
      </nav>
    </header>
  )
}

// ── Hero H4 — pinned document → test morph ──────────────────────
function Hero({ heroRef, onOpenUpload }: { heroRef: React.RefObject<HTMLElement | null>; onOpenUpload: () => void }) {
  const t = useTranslations('PdfInfoPage')
  const words = ['PDF', 'DOCX', 'TXT', 'XLSX', 'MD']
  return (
    <section className="hero" id="hero" data-hero="4" ref={heroRef} aria-label={t('hero_sub')}>
      <div className="hero__stage">
        <div className="hero__intro">
          <h1 className="hero__title display">
            {t('hero_prefix')}{' '}
            <span className="word-swap">
              <span className="word-swap__a11y">{words.join(', ')}</span>
              <span className="word-swap__track" aria-hidden="true">
                {[...words, words[0]].map((w, i) => <span key={i}>{w}</span>)}
              </span>
            </span>
            {' '}{t('hero_dash')}<em>{t('hero_em')}</em>{t('hero_suffix')}
          </h1>
          <p className="hero__sub">{t('hero_sub')}</p>
          <div className="hero__cta">
            <button type="button" className="btn btn--solid" onClick={onOpenUpload}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>
              {t('hero_cta')}
            </button>
            <a className="btn btn--ghost" href="#how">{t('hero_cta2')}</a>
          </div>
          <div className="hero__hint">
            {t('hero_hint')}
            <svg viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><line x1="7" y1="2" x2="7" y2="16"/><path d="M2 12l5 5 5-5"/></svg>
          </div>
        </div>

        <div className="hero__art" data-hero-art data-phase="0">
          <div className="stack">
            <div className="doc">
              <div className="doc__tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>
                exam.pdf
              </div>
              <svg className="doc__photo" viewBox="0 0 200 74" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <rect width="200" height="74" fill="#efeae1"/>
                <circle cx="58" cy="30" r="15" fill="none" stroke="#26222055" strokeWidth="1.4"/>
                <path d="M30 74c0-18 12-27 28-27s28 9 28 27" fill="none" stroke="#26222055" strokeWidth="1.4"/>
                <path d="M112 20h58M112 34h58M112 48h40" stroke="#26222040" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div className="doc__lines">
                <div className="doc__field">
                  <div className="ln q w45" />
                  <span className="doc__ann">{t('hero_ann_question')}</span>
                </div>
                <div className="doc__group">
                  <div className="doc__field">
                    <div className="ln w40" />
                    <span className="doc__ann">{t('hero_ann_options')}</span>
                  </div>
                  <div className="ln w70" />
                  <div className="ln w55" />
                  <div className="doc__field">
                    <div className="ln correct w40" />
                    <span className="doc__ann doc__ann--ok">{t('hero_ann_correct')}</span>
                  </div>
                </div>
                <div className="ln q w55" />
                <div className="ln w100" />
                <div className="ln w70" />
              </div>
              <div className="doc__typetag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M9 12l2 2 4-4"/></svg>
                {t('hero_typetag')}
              </div>
            </div>

            <div className="scan" aria-hidden="true" />

            <div className="cards" aria-hidden="true">
              <div className="qcard">
                <div className="qcard__meta"><span>{t('hero_qcard1_meta')}</span><span className="qcard__chip">{t('hero_qcard1_chip')}</span></div>
                <p className="qcard__q">{t('hero_qcard1_q')}</p>
                <div className="opt is-correct"><span className="opt__dot" />{t('hero_qcard1_opt1')}</div>
                <div className="opt"><span className="opt__dot" />{t('hero_qcard1_opt2')}</div>
              </div>
              <div className="qcard">
                <div className="qcard__meta"><span>{t('hero_qcard2_meta')}</span><span className="qcard__chip">{t('hero_qcard2_chip')}</span></div>
                <p className="qcard__q">{t('hero_qcard2_q')}</p>
                <div className="opt is-correct"><span className="opt__dot" />{t('hero_qcard2_opt1')}</div>
                <div className="opt"><span className="opt__dot" />{t('hero_qcard2_opt2')}</div>
              </div>
            </div>

            <div className="hero__done">{t('hero_done')}</div>

            <div className="callout callout--l c1"><span className="lead" /><b>{t('hero_c1_b')}</b> {t('hero_c1_t')}</div>
            <div className="callout callout--r c2"><span className="lead" />{t('hero_c2_pre')} <b>{t('hero_c2_b')}</b></div>
            <div className="callout callout--l c3"><span className="lead" />{t('hero_c3_pre')} <b>{t('hero_c3_b')}</b></div>
            <div className="callout callout--r c4"><span className="lead" />{t('hero_c4_pre')} <b>{t('hero_c4_b')}</b></div>
            <div className="callout callout--r t1"><span className="lead" /><b>{t('hero_t1_b')}</b> {t('hero_t1_suf')}</div>
            <div className="callout callout--l t2"><span className="lead" /><b>{t('hero_t2_b')}</b> {t('hero_t2_suf')}</div>
            <div className="callout callout--r t3"><span className="lead" /><b>{t('hero_t3_b')}</b> {t('hero_t3_suf')}</div>
          </div>
        </div>

        <div className="hero__rail" aria-hidden="true">
          <span className="st on" data-st="0">{t('hero_rail_pdf')}</span>
          <span className="arw" />
          <span className="st" data-st="1">{t('hero_rail_scan')}</span>
          <span className="arw" />
          <span className="st" data-st="2">{t('hero_rail_recog')}</span>
          <span className="arw" />
          <span className="st" data-st="3">{t('hero_rail_test')}</span>
          <span className="track" />
        </div>
      </div>
    </section>
  )
}

// ── Три шага — S3 ────────────────────────────────────────────
function StepsS3() {
  const t = useTranslations('PdfInfoPage')
  const steps = [
    { h: t('steps_1_h'), d: t('steps_1_t'), icon: <path d="M24 30V8m0 0l-7 7m7-7l7 7M8 30v8a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2v-8" /> },
    { h: t('steps_2_h'), d: t('steps_2_t'), icon: <><rect x="8" y="6" width="32" height="36" rx="2"/><path d="M14 16h20M14 24h20M14 32h12"/><path d="M6 24h36" strokeDasharray="2 3"/></> },
    { h: t('steps_3_h'), d: t('steps_3_t'), icon: <><circle cx="24" cy="24" r="18"/><path d="M16 24l6 6 12-12"/></> },
  ]
  return (
    <section className="hows3 section-pad" id="how" data-steps="3" aria-label={t('steps_title')}>
      <div className="wrap">
        <div className="hows3__head" data-reveal>
          <h2 className="hows3__title display">{t('steps_title')}</h2>
        </div>
        <ol className="hows3__stairs">
          {steps.map((s, i) => (
            <li key={i} className="hows3__stair" data-reveal="rise" style={{ '--i': i, '--rd': i ? `${i * 0.1}s` : undefined } as React.CSSProperties}>
              <div className="hows3__idx">{String(i + 1).padStart(2, '0')}</div>
              <div className="hows3__body">
                <div className="hows3__ico"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">{s.icon}</svg></div>
                <h3 className="hows3__h">{s.h}</h3>
                <p className="hows3__t">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ── Блок B — scrub «Один файл → тест» ───────────────────────
function Scrub({ scrubRef }: { scrubRef: React.RefObject<HTMLElement | null> }) {
  const t = useTranslations('PdfInfoPage')
  return (
    <section className="scrub" data-scrub ref={scrubRef} data-note1={t('scrub_note1')} data-note2={t('scrub_note2')} aria-label={t('scrub_eyebrow')}>
      <div className="scrub__sticky">
        <div className="wrap scrub__inner">
          <p className="scrub__eyebrow">{t('scrub_eyebrow')}</p>
          <div className="scrub__figure" aria-hidden="true">
            <span className="scrub__end">{t('scrub_end_pdf')}</span>
            <svg className="scrub__wire" viewBox="0 0 600 56" preserveAspectRatio="none" aria-hidden="true">
              <path className="track" d="M4 28 C 150 4, 200 52, 300 28 S 450 4, 596 28" />
              <path className="draw" data-scrub-path d="M4 28 C 150 4, 200 52, 300 28 S 450 4, 596 28" />
              <circle className="wp" data-scrub-wp="0" cx="4" cy="28" r="5" />
              <circle className="wp" data-scrub-wp="0.34" cx="200" cy="34" r="5" />
              <circle className="wp" data-scrub-wp="0.66" cx="400" cy="10" r="5" />
              <circle className="wp" data-scrub-wp="1" cx="596" cy="28" r="5" />
            </svg>
            <span className="scrub__end">{t('scrub_end_test')}</span>
          </div>
          <div className="scrub__phase" data-scrub-phase aria-hidden="true">
            <div className="scrub__ph scrub__ph--load" data-ph="1">
              <span className="scrub__ph-label">{t('scrub_ph1_label')}</span>
              <div className="scrub__bar"><i className="scrub__bar-fill" data-scrub-bar /></div>
              <span className="scrub__pct" data-scrub-pct>0&nbsp;%</span>
            </div>
            <div className="scrub__ph scrub__ph--scan" data-ph="2">
              <span className="scrub__spin" />
              <span className="scrub__ph-label">{t('scrub_ph2_label')}</span>
              <div className="scrub__scan"><i /><i /><i /></div>
            </div>
            <div className="scrub__ph scrub__ph--build" data-ph="3">
              <span className="scrub__ph-label">{t('scrub_ph3_label')}</span>
              <div className="scrub__chips" data-scrub-chips>
                {Array.from({ length: 12 }).map((_, i) => <i key={i} />)}
              </div>
            </div>
          </div>
          <div className="scrub__result">
            <p className="scrub__payoff-note" data-scrub-note aria-hidden="true" />
            <div className="scrub__payoff" data-scrub-payoff>
              <div className="scrub__stat">
                <span className="scrub__num" data-scrub-num>12</span>
                <span className="scrub__unit">{t('scrub_unit')}</span>
              </div>
              <p className="scrub__time">{t('scrub_time_pre')} <b data-scrub-sec>60</b> {t('scrub_time_suf')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Типы вопросов ────────────────────────────────────────────
function TypesSection() {
  const t = useTranslations('PdfInfoPage')
  return (
    <section className="types section-pad" id="types" aria-label={t('types_title')}>
      <div className="wrap">
        <div className="types__head">
          <h2 className="types__title display" data-reveal>{t('types_title')}</h2>
          <p className="types__sub" data-reveal style={{ '--rd': '.1s' } as React.CSSProperties}>{t('types_sub')}</p>
        </div>
        <div className="type-grid">
          <div className="tcell big tall" data-reveal="rise">
            <div className="tcell__vis">
              <div className="tv tv--single" aria-hidden="true">
                <span className="tv-row is-correct"><span className="tv-radio is-correct" /><span className="tv-bar" style={{ width: '62%' }} /></span>
                <span className="tv-row"><span className="tv-radio" /><span className="tv-bar" style={{ width: '46%' }} /></span>
                <span className="tv-row"><span className="tv-radio" /><span className="tv-bar" style={{ width: '54%' }} /></span>
              </div>
            </div>
            <div className="tcell__foot">
              <div className="tcell__name">{t('type1_name')} <span className="tcell__tag">single</span></div>
              <p className="tcell__d">{t('type1_d')}</p>
            </div>
          </div>

          <div className="tcell sm tall" data-reveal="rise" style={{ '--rd': '.06s' } as React.CSSProperties}>
            <div className="tcell__vis">
              <div className="tv tv--multi" aria-hidden="true">
                <span className="tv-row"><span className="tv-check is-on"><svg viewBox="0 0 15 15"><path className="tv-mk" d="M4 8l2.5 2.5L11 5"/></svg></span><span className="tv-bar" style={{ width: '70%' }} /></span>
                <span className="tv-row"><span className="tv-check" /><span className="tv-bar" style={{ width: '52%' }} /></span>
                <span className="tv-row"><span className="tv-check is-on"><svg viewBox="0 0 15 15"><path className="tv-mk" d="M4 8l2.5 2.5L11 5"/></svg></span><span className="tv-bar" style={{ width: '60%' }} /></span>
              </div>
            </div>
            <div className="tcell__foot">
              <div className="tcell__name">{t('type2_name')} <span className="tcell__tag">multi</span></div>
              <p className="tcell__d">{t('type2_d')}</p>
            </div>
          </div>

          <div className="tcell mid" data-reveal="rise" style={{ '--rd': '.04s' } as React.CSSProperties}>
            <div className="tcell__vis">
              <div className="tv tv--match" aria-hidden="true">
                <svg viewBox="0 0 180 70" fill="none">
                  <rect className="tv-node" x="4" y="6" width="46" height="14" rx="2"/>
                  <rect className="tv-node" x="4" y="28" width="46" height="14" rx="2"/>
                  <rect className="tv-node" x="4" y="50" width="46" height="14" rx="2"/>
                  <rect className="tv-node" x="130" y="6" width="46" height="14" rx="2"/>
                  <rect className="tv-node" x="130" y="28" width="46" height="14" rx="2"/>
                  <rect className="tv-node" x="130" y="50" width="46" height="14" rx="2"/>
                  <path className="tv-wire" pathLength={100} d="M50 13 C90 13 90 35 130 35"/>
                  <path className="tv-wire" pathLength={100} d="M50 35 C90 35 90 13 130 13"/>
                  <path className="tv-wire" pathLength={100} d="M50 57 C90 57 90 57 130 57"/>
                </svg>
              </div>
            </div>
            <div className="tcell__foot">
              <div className="tcell__name">{t('type3_name')} <span className="tcell__tag">match</span></div>
              <p className="tcell__d">{t('type3_d')}</p>
            </div>
          </div>

          <div className="tcell mid" data-reveal="rise" style={{ '--rd': '.1s' } as React.CSSProperties}>
            <div className="tcell__vis">
              <div className="tv tv--fill" aria-hidden="true">
                <span className="tv-field"><span className="tv-typed">{t('type4_example')}<i className="tv-caret" /></span></span>
              </div>
            </div>
            <div className="tcell__foot">
              <div className="tcell__name">{t('type4_name')} <span className="tcell__tag">fill</span></div>
              <p className="tcell__d">{t('type4_d')}</p>
            </div>
          </div>

          <div className="tcell sm" data-reveal="rise" style={{ '--rd': '.14s' } as React.CSSProperties}>
            <div className="tcell__vis">
              <div className="tv tv--order" aria-hidden="true">
                <span className="tv-row"><b className="tv-num">1</b><span className="tv-bar" style={{ width: '66%' }} /></span>
                <span className="tv-row"><b className="tv-num">2</b><span className="tv-bar" style={{ width: '52%' }} /></span>
                <span className="tv-row"><b className="tv-num">3</b><span className="tv-bar" style={{ width: '60%' }} /></span>
              </div>
            </div>
            <div className="tcell__foot">
              <div className="tcell__name">{t('type5_name')} <span className="tcell__tag">order</span></div>
              <p className="tcell__d">{t('type5_d')}</p>
            </div>
          </div>

          <div className="tcell big" data-reveal="rise" style={{ '--rd': '.08s' } as React.CSSProperties}>
            <div className="tcell__vis">
              <div className="tv tv--bool" aria-hidden="true">
                <span className="tv-toggle">
                  <span className="tv-toggle__lab tv-toggle__lab--f">{t('tf_false')}</span>
                  <span className="tv-toggle__track"><span className="tv-toggle__knob" /></span>
                  <span className="tv-toggle__lab tv-toggle__lab--t">{t('tf_true')}</span>
                </span>
              </div>
            </div>
            <div className="tcell__foot">
              <div className="tcell__name">{t('type6_name')} <span className="tcell__tag">bool</span></div>
              <p className="tcell__d">{t('type6_d')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Готовый тест ──────────────────────────────────────────────
function DemoSection({ demoRef }: { demoRef: React.RefObject<HTMLElement | null> }) {
  const t = useTranslations('PdfInfoPage')
  return (
    <section className="demo" id="demo" data-demo ref={demoRef} data-static-label={t('demo_progress_static')} data-progress-label={t('demo_progress', { n: '{n}' })} aria-label={t('demo_title')}>
      <div className="demo__pin">
        <div className="wrap">
          <div className="demo__head" data-reveal>
            <h2 className="demo__title display">{t('demo_title')}</h2>
            <p className="demo__sub lede">{t('demo_sub')}</p>
          </div>
          <div className="demo__frame">
            <div className="demo__left">
              <div className="demo__prog">
                <div className="demo__prog-label" data-demo-label>{t('demo_progress', { n: 1 })}</div>
                <div className="demo__bar"><i data-demo-bar /></div>
              </div>
              <div className="demo__nav" data-demo-nav aria-hidden="true">
                {Array.from({ length: 12 }).map((_, i) => <span key={i}>{i + 1}</span>)}
              </div>
            </div>
            <div className="demo__stage">
              <div className="demo__q demo__q--match" data-demo-q="0">
                <div className="demo__q-num">{t('demo_q1_num')}</div>
                <p className="demo__q-text">{t('demo_q1_text')}</p>
                <div className="match" aria-hidden="true">
                  <div className="match__col match__col--l">
                    <div className="match__item"><span className="match__box" data-match-box="0">HTML</span></div>
                    <div className="match__item"><span className="match__box" data-match-box="1">CSS</span></div>
                    <div className="match__item"><span className="match__box" data-match-box="2">JS</span></div>
                  </div>
                  <svg className="match__wires" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path className="match__track" d="M0 16.67 C50 16.67 50 83.33 100 83.33"/>
                    <path className="match__track" d="M0 50 C50 50 50 16.67 100 16.67"/>
                    <path className="match__track" d="M0 83.33 C50 83.33 50 50 100 50"/>
                    <path className="match__draw" data-match-draw="0" d="M0 16.67 C50 16.67 50 83.33 100 83.33"/>
                    <path className="match__draw" data-match-draw="1" d="M0 50 C50 50 50 16.67 100 16.67"/>
                    <path className="match__draw" data-match-draw="2" d="M0 83.33 C50 83.33 50 50 100 50"/>
                  </svg>
                  <div className="match__col match__col--r">
                    <div className="match__item"><span className="match__box" data-match-box="1">{t('demo_match_stil')}</span></div>
                    <div className="match__item"><span className="match__box" data-match-box="2">{t('demo_match_logika')}</span></div>
                    <div className="match__item"><span className="match__box" data-match-box="0">{t('demo_match_razmetka')}</span></div>
                  </div>
                </div>
              </div>

              <div className="demo__q demo__q--fill" data-demo-q="1">
                <div className="demo__q-num">{t('demo_q2_num')}</div>
                <p className="demo__q-text">{t('demo_q2_text')}</p>
                <div className="fill">
                  <div className="fill__row">
                    <div className="fill__q">{t('demo_fill1_q')}</div>
                    <div className="fill__field" data-fill-field><span className="fill__text" data-fill-text data-full={t('demo_fill1_a')} /><span className="fill__caret" /></div>
                  </div>
                  <div className="fill__row">
                    <div className="fill__q">{t('demo_fill2_q')}</div>
                    <div className="fill__field" data-fill-field><span className="fill__text" data-fill-text data-full={t('demo_fill2_a')} /><span className="fill__caret" /></div>
                  </div>
                  <div className="fill__row">
                    <div className="fill__q">{t('demo_fill3_q')}</div>
                    <div className="fill__field" data-fill-field><span className="fill__text" data-fill-text data-full={t('demo_fill3_a')} /><span className="fill__caret" /></div>
                  </div>
                </div>
              </div>

              <div className="demo__q demo__q--single" data-demo-q="2">
                <div className="demo__q-num">{t('demo_q3_num')}</div>
                <p className="demo__q-text">{t('demo_q3_text')}</p>
                <div className="demo__opts">
                  <div className="demo__opt" data-demo-opt><span className="dot" />{t('demo_q3_opt1')}</div>
                  <div className="demo__opt" data-demo-opt data-demo-correct><span className="dot" />{t('demo_q3_opt2')}
                    <svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <div className="demo__opt" data-demo-opt><span className="dot" />{t('demo_q3_opt3')}</div>
                  <div className="demo__opt" data-demo-opt><span className="dot" />{t('demo_q3_opt4')}</div>
                </div>
                <div className="demo__autocheck">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>
                  {t('demo_autocheck')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Профиль ошибок — E1 ──────────────────────────────────────
function ErrsSection({ errsRef }: { errsRef: React.RefObject<HTMLDivElement | null> }) {
  const t = useTranslations('PdfInfoPage')
  return (
    <section className="errs section-pad" id="errs" data-errs="1" aria-label={t('errs_title')}>
      <div className="wrap">
        <div className="errs__grid">
          <div>
            <h2 className="errs__title display" data-reveal>{t('errs_title')}</h2>
            <p className="errs__sub" data-reveal style={{ '--rd': '.08s' } as React.CSSProperties}>{t('errs_sub')}</p>
          </div>
          <div className="pcard pcard--tilt" ref={errsRef} data-reveal="rise" style={{ '--rd': '.1s' } as React.CSSProperties}>
            <span className="pcard__flag">{t('errs_flag')}</span>
            <div className="pcard__name">{t('errs_name')}</div>
            <div className="pcard__class">{t('errs_class')}</div>
            <div className="pcard__stats">
              <div className="pstat"><b>{t('errs_stat1_n')}</b><span>{t('errs_stat1_l')}</span></div>
              <div className="pstat"><b>{t('errs_stat2_n')}</b><span>{t('errs_stat2_l')}</span></div>
            </div>
            <div className="pcard__weak-t">{t('errs_weak_title')}</div>
            <div className="weak" style={{ '--pct': '62%' } as React.CSSProperties}>
              <span>{t('errs_topic1')}</span>
              <span className="weak__meta"><em>{t('errs_topic1_meta')}</em><b className="weak__pct">62%</b></span>
            </div>
            <div className="weak" style={{ '--pct': '41%' } as React.CSSProperties}>
              <span>{t('errs_topic2')}</span>
              <span className="weak__meta"><em>{t('errs_topic2_meta')}</em><b className="weak__pct">41%</b></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Лимиты ────────────────────────────────────────────────────
function LimitsSection() {
  const t = useTranslations('PdfInfoPage')
  return (
    <section className="limits section-pad" id="limits" aria-label={t('limits_title')}>
      <div className="wrap">
        <h2 className="limits__title display" data-reveal>{t('limits_title')}</h2>
        <div className="tiers" data-reveal="fade">
          <div className="tier">
            <div className="tier__k">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
              {t('limits_guest_label')}
            </div>
            <p className="tier__v">{t('limits_guest_v')}</p>
          </div>
          <div className="tier">
            <div className="tier__k">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 2l2.5 6H21l-5 4 2 7-6-4-6 4 2-7-5-4h6.5z"/></svg>
              {t('limits_auth_label')}
            </div>
            <p className="tier__v">{t('limits_auth_v')}</p>
          </div>
          <div className="tier tier--vip">
            <div className="tier__k tier__k--accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/></svg>
              {t('limits_vip_label')}
            </div>
            <p className="tier__v">{t('limits_vip_v')}</p>
            <p className="tier__price tier__price--soon">{t('limits_vip_price')}</p>
            <Link className="btn btn--solid tier__buy" href="/vip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/></svg>
              {t('limits_vip_buy')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────
function FaqSection() {
  const t = useTranslations('PdfInfoPage')
  const items: [string, string][] = [
    [t('faq1_q'), t('faq1_a')],
    [t('faq2_q'), t('faq2_a')],
    [t('faq3_q'), t('faq3_a')],
    [t('faq4_q'), t('faq4_a')],
  ]
  return (
    <section className="faq section-pad" aria-label={t('faq_title')}>
      <div className="wrap">
        <div className="faq__grid">
          <h2 className="faq__title display" data-reveal>{t('faq_title')}</h2>
          <div className="faq__list" data-reveal="fade">
            {items.map(([q, a]) => (
              <details key={q}>
                <summary>{q}<span className="pm" aria-hidden="true" /></summary>
                <p className="faq__a">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Блок A — прогресс учёбы ──────────────────────────────────
function ProgSection({ progRef }: { progRef: React.RefObject<HTMLElement | null> }) {
  const t = useTranslations('PdfInfoPage')
  const items = [t('prog_1'), t('prog_2'), t('prog_3'), t('prog_4'), t('prog_5')]
  return (
    <section className="prog section-pad" data-prog ref={progRef} aria-label={t('prog_title')}>
      <div className="wrap">
        <div className="prog__head" data-reveal>
          <h2 className="prog__title display">{t('prog_title')}</h2>
        </div>
        <div className="prog__track">
          <div className="prog__spine" aria-hidden="true"><span className="prog__fill" /></div>
          <ol className="prog__list" data-prog-track>
            {items.map((label, i) => (
              <li key={i} className="prog__step" data-prog-step>
                <span className="prog__node" aria-hidden="true" />
                <span className="prog__num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="prog__label">{label}</h3>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ── Финал + футер ─────────────────────────────────────────────
function FinalSection({ onOpenUpload }: { onOpenUpload: () => void }) {
  const t = useTranslations('PdfInfoPage')
  return (
    <section className="final" aria-label={t('final_phrase_pre')}>
      <div className="wrap final__inner">
        <h2 className="final__phrase" data-reveal="rise">{t('final_phrase_pre')} <em>{t('final_phrase_em')}</em> {t('final_phrase_post')}</h2>
        <div className="final__cta" data-reveal style={{ '--rd': '.12s' } as React.CSSProperties}>
          <button type="button" className="btn btn--invert" onClick={onOpenUpload}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>
            {t('final_cta')}
          </button>
          <Link className="btn btn--vip" href="/vip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/></svg>
            {t('final_vip')}
          </Link>
        </div>
        <p className="final__note" data-reveal style={{ '--rd': '.18s' } as React.CSSProperties}>{t('final_note_pre')} <b>{t('final_note_b')}</b> {t('final_note_post')}</p>
      </div>
      <footer className="foot">
        <div className="foot__inner">
          <div className="foot__brand">{t('foot_brand')}</div>
          <nav className="foot__links" aria-label={t('foot_brand')}>
            <Link href="/privacy">{t('foot_privacy')}</Link>
            <Link href="/terms">{t('foot_terms')}</Link>
            <a href="#top">{t('foot_contacts')}</a>
          </nav>
        </div>
      </footer>
    </section>
  )
}

// ── Upload modal — real /api/pdf-to-test wiring (pick → process → result/error/vip) ────────
const ALLOWED_EXT = ['pdf', 'docx', 'txt', 'rtf', 'odt']
const MAX_SIZE = 20 * 1024 * 1024

type ModalStep = 'pick' | 'process' | 'result' | 'error' | 'vip'

function UploadModal({ modalOpen, onClose, pendingFile, isLoggedIn }: {
  modalOpen: boolean
  onClose: () => void
  pendingFile: File | null
  isLoggedIn: boolean
}) {
  const t = useTranslations('PdfInfoPage')
  const [ready, setReady] = useState(false)
  const [step, setStep] = useState<ModalStep>('pick')
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<TestResult | null>(null)
  const [previewIdx, setPreviewIdx] = useState(0)
  const [errorTitle, setErrorTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isDrag, setIsDrag] = useState(false)
  const [shake, setShake] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const dragDepth = useRef(0)
  const beganRef = useRef(false)

  const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name || '')?.[1] || '').toLowerCase()

  const fail = useCallback((title: string, msg: string) => {
    setErrorTitle(title)
    setErrorMsg(msg)
    setStep('error')
    setShake(false)
    requestAnimationFrame(() => setShake(true))
  }, [])

  const begin = useCallback(async (file: File) => {
    const ext = extOf(file.name)
    if (!ALLOWED_EXT.includes(ext)) {
      fail(t('modal_error_format_title'), t('modal_error_format_msg', { name: file.name }))
      return
    }
    if (file.size > MAX_SIZE) {
      fail(t('modal_error_size_title'), t('modal_error_size_msg', { name: file.name, mb: (file.size / 1024 / 1024).toFixed(1) }))
      return
    }
    if (file.size === 0) {
      fail(t('modal_error_empty_title'), t('modal_error_empty_msg', { name: file.name }))
      return
    }

    cancelAnimationFrame(rafRef.current)
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setStep('process')
    setFileName(file.name)
    setProgress(0)
    setResult(null)
    setPreviewIdx(0)

    startRef.current = performance.now()
    const ESTIMATED_MS = 18000
    const animFrame = () => {
      const elapsed = performance.now() - startRef.current
      const tt = Math.min(elapsed / ESTIMATED_MS, 1)
      const eased = 1 - Math.pow(1 - tt, 2.2)
      setProgress(Math.round(eased * 92))
      rafRef.current = requestAnimationFrame(animFrame)
    }
    rafRef.current = requestAnimationFrame(animFrame)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/pdf-to-test', { method: 'POST', body: fd, signal: controller.signal })
      const data = await res.json()
      cancelAnimationFrame(rafRef.current)

      if (!res.ok) {
        if (data.vipRequired) { setStep('vip'); return }
        fail(t('modal_error_title_default'), data.error ?? `${res.status}`)
        return
      }

      setProgress(100)
      setResult(data as TestResult)
      window.setTimeout(() => setStep('result'), 400)
    } catch (e) {
      cancelAnimationFrame(rafRef.current)
      if ((e as Error).name === 'AbortError') return
      fail(t('modal_error_title_default'), (e as Error).message)
    }
  }, [fail, t])

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    controllerRef.current?.abort()
    setStep('pick')
    setProgress(0)
    setFileName('')
    setResult(null)
    setErrorMsg('')
  }, [])

  const onPick = (files: FileList | null) => {
    const f = files?.[0]
    if (f) begin(f)
  }

  // Fade the modal in over two frames so the CSS transition has a starting state to animate from
  useEffect(() => {
    if (!modalOpen) { setReady(false); beganRef.current = false; return }
    let raf1 = 0, raf2 = 0
    raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setReady(true)) })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [modalOpen])

  // Reset local state fresh on every open; if a file arrived via the global dropzone, jump straight to processing
  useEffect(() => {
    if (!modalOpen) return
    setStep('pick')
    setProgress(0)
    setResult(null)
    setErrorMsg('')
    setFileName('')
    if (pendingFile && !beganRef.current) {
      beganRef.current = true
      begin(pendingFile)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, pendingFile])

  useEffect(() => {
    if (!modalOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [modalOpen])

  useEffect(() => {
    if (!modalOpen) return
    function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
  }, [modalOpen, onClose])

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); controllerRef.current?.abort() }, [])

  if (!modalOpen) return null

  const procLabel = progress < 34 ? t('modal_proc_label1') : progress < 70 ? t('modal_proc_label2') : t('modal_proc_label3')
  const typeCount: Record<string, number> = {}
  result?.questions.forEach(q => { typeCount[q.type] = (typeCount[q.type] ?? 0) + 1 })
  const typeTags = Object.entries(typeCount).map(([tp, n]) => {
    const labels: Record<string, string> = { single: t('type_single'), multi: t('type_multi'), match: t('type_match'), fill: t('type_fill'), bool: t('type_bool'), order: t('type_order') }
    return `${labels[tp] ?? tp} ×${n}`
  })
  const q = result?.questions[previewIdx]

  return (
    <div className="upload" data-open={ready ? '1' : undefined}>
      <div className="upload__backdrop" onClick={onClose} />
      <div className="upload__shell" ref={shellRef} role="dialog" aria-modal="true" aria-label={t('modal_pick_t')} tabIndex={-1}>
        <button type="button" className="upload__close" onClick={onClose} aria-label={t('modal_close')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>

        {step === 'pick' && (
          <div className="upload__step">
            <div
              className={`m1-drop${isDrag ? ' is-drag' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={e => { e.preventDefault(); dragDepth.current += 1; setIsDrag(true) }}
              onDragOver={e => e.preventDefault()}
              onDragLeave={e => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setIsDrag(false) } }}
              onDrop={e => { e.preventDefault(); dragDepth.current = 0; setIsDrag(false); onPick(e.dataTransfer.files) }}
            >
              <svg className="m1-drop__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
              <p className="m1-drop__t">{t('modal_pick_t')}<br />{t('modal_pick_t2')}</p>
              <span className="m1-drop__f">{t('modal_pick_formats')}</span>
              <button type="button" className="btn btn--ghost" onClick={e => { e.stopPropagation(); inputRef.current?.click() }}>{t('modal_pick_choose')}</button>
            </div>
          </div>
        )}

        {step === 'process' && (
          <div className="upload__step">
            <div className="m1-scan">
              <svg className="m1-scan__doc" viewBox="0 0 90 116" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="88" height="114" rx="3" fill="#f3f0ea" stroke="#c9c2b4" strokeWidth="1.5"/>
                <line x1="14" y1="26" x2="76" y2="26" stroke="#c9c2b4" strokeWidth="2"/>
                <line x1="14" y1="40" x2="76" y2="40" stroke="#e3ddd0" strokeWidth="2"/>
                <line x1="14" y1="52" x2="60" y2="52" stroke="#e3ddd0" strokeWidth="2"/>
                <line x1="14" y1="70" x2="76" y2="70" stroke="#e3ddd0" strokeWidth="2"/>
                <line x1="14" y1="82" x2="76" y2="82" stroke="#e3ddd0" strokeWidth="2"/>
                <line x1="14" y1="94" x2="52" y2="94" stroke="#e3ddd0" strokeWidth="2"/>
              </svg>
              <i className="m1-scan__line" style={{ top: `${progress}%` }} />
            </div>
            <p className="m1-proc__label">{procLabel}</p>
            <div className="m1-proc__pct">{progress}&nbsp;%</div>
            <p className="m1-proc__file">{fileName}</p>
          </div>
        )}

        {step === 'result' && result && (
          <div className="upload__step">
            <svg className="m1-result__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>
            <h3 className="m1-result__t">{t('modal_result_title')}</h3>
            <p className="m1-result__f">{result.title}</p>
            <div className="m1-result__stats">
              <div className="pstat"><b>{result.questions.length}</b><span>{t('modal_result_questions')}</span></div>
              <div className="pstat"><b>{Object.keys(typeCount).length}</b><span>{t('modal_result_types')}</span></div>
            </div>
            <div className="result-tags">
              {typeTags.map(tag => <span key={tag} className="result-tag">{tag}</span>)}
            </div>

            {q && <QuestionPreview q={q} idx={previewIdx} total={result.questions.length} />}
            {result.questions.length > 1 && (
              <div className="result-dots">
                {result.questions.map((_, i) => (
                  <button key={i} type="button" className={`result-dot${i === previewIdx ? ' on' : ''}`} onClick={() => setPreviewIdx(i)}>{i + 1}</button>
                ))}
              </div>
            )}

            {result.isGuest && (
              <div className="result-guest">
                {t('modal_guest_pre', { n: result.guestLimit ?? 0 })}{' '}
                <Link href="/auth/register" style={{ color: 'var(--accent-ink)', fontWeight: 600, textDecoration: 'underline' }}>{t('modal_guest_link')}</Link>{' '}
                {t('modal_guest_post')}
              </div>
            )}

            <div className="upload__actions">
              {isLoggedIn
                ? <Link className="btn btn--solid" href="/profile">{t('modal_result_save')}</Link>
                : <Link className="btn btn--solid" href="/auth/register">{t('modal_result_login_save')}</Link>}
              <button type="button" className="btn btn--ghost" onClick={reset}>{t('modal_result_another')}</button>
            </div>
          </div>
        )}

        {step === 'vip' && (
          <div className="upload__step">
            <svg className="m1-result__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/></svg>
            <h3 className="m1-result__t">{t('modal_vip_title')}</h3>
            <p className="m1-error__f">{t('modal_vip_msg')}</p>
            <div className="upload__actions">
              <Link className="btn btn--solid" href="/vip">{t('modal_vip_upgrade')}</Link>
              <button type="button" className="btn btn--ghost" onClick={reset}>{t('modal_vip_back')}</button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className={`upload__step${shake ? ' is-shake' : ''}`} data-upload-step="error">
            <svg className="m1-error__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18.14A1.5 1.5 0 0 0 3.11 20.5h17.78a1.5 1.5 0 0 0 1.29-2.36L13.71 3.86a1.5 1.5 0 0 0-3.42 0z"/></svg>
            <h3 className="m1-result__t">{errorTitle}</h3>
            <p className="m1-error__f">{errorMsg}</p>
            <button type="button" className="btn btn--ghost" onClick={reset}>{t('modal_error_retry')}</button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.rtf,.odt"
          hidden
          onChange={e => { onPick(e.target.files); e.target.value = '' }}
        />
      </div>
    </div>
  )
}

// ── Global full-viewport dropzone (drag a file anywhere on the page) ───────────────────────
function GlobalDropzone({ onFileDropped, suppress }: { onFileDropped: (f: File) => void; suppress: boolean }) {
  const t = useTranslations('PdfInfoPage')
  const [active, setActive] = useState(false)
  const depthRef = useRef(0)

  useEffect(() => {
    function hasFiles(e: DragEvent) { return !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files') }
    function onDragEnter(e: DragEvent) {
      if (suppress || !hasFiles(e)) return
      e.preventDefault()
      depthRef.current += 1
      setActive(true)
    }
    function onDragOver(e: DragEvent) { if (!suppress && hasFiles(e)) e.preventDefault() }
    function onDragLeave() {
      if (suppress) return
      depthRef.current -= 1
      if (depthRef.current <= 0) { depthRef.current = 0; setActive(false) }
    }
    function onDrop(e: DragEvent) {
      if (suppress || !hasFiles(e)) return
      e.preventDefault()
      depthRef.current = 0
      setActive(false)
      const f = e.dataTransfer?.files?.[0]
      if (f) onFileDropped(f)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [onFileDropped, suppress])

  useEffect(() => { if (suppress) { setActive(false); depthRef.current = 0 } }, [suppress])

  if (!active) return null
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-overlay__box">
        <svg className="drop-overlay__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
        <p className="drop-overlay__t">{t('drop_overlay_title')}</p>
        <span className="drop-overlay__f">{t('drop_overlay_sub')}</span>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────
export default function PdfInfoPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user

  const rootRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const scrubRef = useRef<HTMLElement>(null)
  const demoRef = useRef<HTMLElement>(null)
  const progRef = useRef<HTMLElement>(null)
  const errsRef = useRef<HTMLDivElement>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const openModal = useCallback((file?: File) => { setPendingFile(file ?? null); setModalOpen(true) }, [])
  const closeModal = useCallback(() => setModalOpen(false), [])
  const handleGlobalDrop = useCallback((file: File) => { openModal(file) }, [openModal])

  useEffect(() => {
    // Horizontal clipping lives on <body> (not on .pdf3 or any ancestor of the pinned hero/scrub/demo
    // sections) — overflow on the root element propagates to the viewport instead of creating a
    // scroll container, so it can't break position:sticky the way it would on a plain div.
    document.body.style.setProperty('overflow-y', 'auto', 'important')
    document.body.style.setProperty('overflow-x', 'hidden', 'important')
    // The app-wide reset sets html{font-size:15px} instead of the browser default 16px, so every
    // rem-based size on this page (ported from the standalone prototype, which assumes a 16px root)
    // renders ~6% smaller than designed. Restore a true 16px root while this page is mounted.
    document.documentElement.style.setProperty('font-size', '16px', 'important')
    return () => {
      document.body.style.removeProperty('overflow-y')
      document.body.style.removeProperty('overflow-x')
      document.documentElement.style.removeProperty('font-size')
    }
  }, [])

  // ── Ported scroll-choreography (vanilla, adapted from v3-lab.html) ─────────────────────
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cleanups: Array<() => void> = []
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // -- reveal-core equivalent: [data-reveal] → .is-in once in view --
    {
      const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
      if (reduce || !('IntersectionObserver' in window)) {
        els.forEach(el => el.classList.add('is-in'))
      } else {
        const io = new IntersectionObserver(entries => {
          entries.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('is-in'); io.unobserve(e.target) } })
        }, { threshold: 0.15 })
        els.forEach(el => io.observe(el))
        cleanups.push(() => io.disconnect())
      }
    }

    // -- Hero H4: pinned document → test morph, driven by scroll position within the section --
    {
      const hero = heroRef.current
      if (hero) {
        const art = hero.querySelector<HTMLElement>('[data-hero-art]')
        const stage = hero.querySelector<HTMLElement>('.hero__stage')
        const rail = hero.querySelectorAll<HTMLElement>('.hero__rail .st')
        const blankCal = [
          { el: hero.querySelector<HTMLElement>('.c1'), at: 0.05 },
          { el: hero.querySelector<HTMLElement>('.c2'), at: 0.26 },
          { el: hero.querySelector<HTMLElement>('.c3'), at: 0.46 },
          { el: hero.querySelector<HTMLElement>('.c4'), at: 0.64 },
        ]
        const testCal = [
          { el: hero.querySelector<HTMLElement>('.t1'), at: 0.82 },
          { el: hero.querySelector<HTMLElement>('.t2'), at: 0.87 },
          { el: hero.querySelector<HTMLElement>('.t3'), at: 0.92 },
        ]
        const small = window.matchMedia && window.matchMedia('(max-width: 900px)').matches

        function setPhase(p: number) {
          let ph = 0
          if (p >= 0.80) ph = 3
          else if (p >= 0.55) ph = 2
          else if (p >= 0.28) ph = 1
          if (art) art.setAttribute('data-phase', String(ph))
          rail.forEach((r, i) => r.classList.toggle('on', i <= ph))
          const testMode = ph >= 3
          blankCal.forEach(c => c.el?.classList.toggle('on', !testMode && p >= c.at))
          testCal.forEach(c => c.el?.classList.toggle('on', testMode && p >= c.at))
        }

        if (reduce || small) {
          hero.classList.add('hero--static')
          art?.setAttribute('data-phase', '3')
          stage?.style.setProperty('--p', '1')
          rail.forEach(r => r.classList.add('on'))
        } else {
          let ticking = false
          const update = () => {
            ticking = false
            const total = hero.offsetHeight - window.innerHeight
            if (total <= 0) { stage?.style.setProperty('--p', '0'); setPhase(0); return }
            const rect = hero.getBoundingClientRect()
            let p = -rect.top / total
            if (p < 0) p = 0; if (p > 1) p = 1
            stage?.style.setProperty('--p', String(p))
            setPhase(p)
          }
          const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }
          const onResize = () => {
            if (window.matchMedia('(max-width: 900px)').matches) {
              hero.classList.add('hero--static')
              window.removeEventListener('scroll', onScroll)
            } else {
              hero.classList.remove('hero--static')
              update()
            }
          }
          window.addEventListener('scroll', onScroll, { passive: true })
          window.addEventListener('resize', onResize, { passive: true })
          update()
          cleanups.push(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize) })
        }
      }
    }

    // -- Block B — scrub: draws the PDF→test path and counts up as the section scrolls --
    {
      const sec = scrubRef.current
      if (sec) {
        const path = sec.querySelector<SVGPathElement>('[data-scrub-path]')
        const wps = Array.from(sec.querySelectorAll<SVGElement>('[data-scrub-wp]'))
        const numEl = sec.querySelector<HTMLElement>('[data-scrub-num]')
        const NUM = numEl ? (parseInt(numEl.textContent || '12', 10) || 12) : 12
        const phases = Array.from(sec.querySelectorAll<HTMLElement>('[data-ph]'))
        const barFill = sec.querySelector<HTMLElement>('[data-scrub-bar]')
        const pctEl = sec.querySelector<HTMLElement>('[data-scrub-pct]')
        const chips = Array.from(sec.querySelectorAll<HTMLElement>('[data-scrub-chips] i'))
        const payoff = sec.querySelector<HTMLElement>('[data-scrub-payoff]')
        const noteEl = sec.querySelector<HTMLElement>('[data-scrub-note]')
        const NOTES: Record<number, string> = { 1: sec.dataset.note1 || '', 2: sec.dataset.note2 || '' }
        const isSmall = () => window.matchMedia && window.matchMedia('(max-width: 900px)').matches
        const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

        let LEN = 0
        const measurePath = () => { if (path) { LEN = path.getTotalLength(); path.style.strokeDasharray = String(LEN) } }
        const draw = (dp: number) => {
          if (path) path.style.strokeDashoffset = (LEN * (1 - dp)).toFixed(1)
          wps.forEach(w => { const th = parseFloat(w.getAttribute('data-scrub-wp') || '0'); w.classList.toggle('on', dp >= th - 0.001) })
        }
        const setPhase = (idx: number) => phases.forEach(p => p.classList.toggle('on', parseInt(p.getAttribute('data-ph') || '0', 10) === idx))
        const setBar = (v: number) => { if (barFill) barFill.style.transform = `scaleX(${v.toFixed(3)})`; if (pctEl) pctEl.textContent = `${Math.round(v * 100)} %` }
        const setCount = (n: number) => { if (numEl) numEl.textContent = String(n); chips.forEach((c, i) => c.classList.toggle('on', i < n)) }
        const setPayoff = (v: number) => { if (!payoff) return; payoff.style.opacity = v.toFixed(3); payoff.style.transform = `translateY(${((1 - v) * 14).toFixed(1)}px) scale(${(0.965 + 0.035 * v).toFixed(3)})` }
        const setNote = (idx: number, v: number) => { if (!noteEl) return; if (idx === 1 || idx === 2) noteEl.textContent = NOTES[idx]; noteEl.style.opacity = (1 - v).toFixed(3) }
        const full = () => {
          if (path) { path.style.strokeDasharray = 'none'; path.style.strokeDashoffset = '0' }
          wps.forEach(w => w.classList.add('on'))
          setPhase(3); setBar(1); setCount(NUM)
          if (payoff) { payoff.style.opacity = ''; payoff.style.transform = '' }
          if (noteEl) noteEl.style.opacity = '0'
        }
        const staticFrame = () => { sec.classList.add('scrub--static'); full() }
        const live = () => { sec.classList.remove('scrub--static'); measurePath() }

        let ticking = false
        const update = () => {
          ticking = false
          if (sec.classList.contains('scrub--static')) return
          const total = sec.offsetHeight - window.innerHeight
          if (total <= 0) { full(); return }
          const rect = sec.getBoundingClientRect()
          const p = clamp(-rect.top / total, 0, 1)
          draw(p)
          const seg1 = clamp(p / 0.34, 0, 1)
          const seg3 = clamp((p - 0.66) / 0.34, 0, 1)
          const idx = p < 0.34 ? 1 : p < 0.66 ? 2 : 3
          setPhase(idx)
          setBar(easeOut(seg1))
          setCount(Math.round(NUM * easeOut(seg3)))
          setPayoff(easeOut(seg3))
          setNote(idx, easeOut(seg3))
        }
        const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }
        const setup = () => { if (reduce || isSmall()) { staticFrame(); return } live(); update() }

        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', setup, { passive: true })
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup)
        setup()
        cleanups.push(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', setup) })
      }
    }

    // -- Demo: pinned 3-question sequence (match → fill → single), driven by scroll --
    {
      const sec = demoRef.current
      if (sec) {
        const qs = Array.from(sec.querySelectorAll<HTMLElement>('[data-demo-q]'))
        const labelEl = sec.querySelector<HTMLElement>('[data-demo-label]')
        const barEl = sec.querySelector<HTMLElement>('[data-demo-bar]')
        const navEls = Array.from(sec.querySelectorAll<HTMLElement>('[data-demo-nav] span'))
        const draws = Array.from(sec.querySelectorAll<SVGPathElement>('[data-match-draw]'))
        const mBoxes = Array.from(sec.querySelectorAll<HTMLElement>('[data-match-box]'))
        const fFields = Array.from(sec.querySelectorAll<HTMLElement>('[data-fill-field]'))
        const fTexts = Array.from(sec.querySelectorAll<HTMLElement>('[data-fill-text]'))
        const opts = Array.from(sec.querySelectorAll<HTMLElement>('[data-demo-opt]'))
        const correct = sec.querySelector<HTMLElement>('[data-demo-correct]')
        const W = 0.05
        const isSmall = () => window.matchMedia && (window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(max-height: 640px)').matches)
        const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
        const easeIO = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        const seg = (p: number, a: number, b: number) => b <= a ? (p >= b ? 1 : 0) : clamp((p - a) / (b - a), 0, 1)

        const measure = () => draws.forEach(d => { const L = d.getTotalLength(); d.style.strokeDasharray = String(L); d.style.strokeDashoffset = String(L) })
        const drawMatch = (cp: number) => {
          draws.forEach((d, i) => {
            const sub = clamp((cp - i / 3) / (1 / 3), 0, 1)
            const e = easeOut(sub)
            const L = parseFloat(d.style.strokeDasharray) || 0
            d.style.strokeDashoffset = (L * (1 - e)).toFixed(2)
            const on = sub > 0.12
            mBoxes.forEach(b => { if (b.getAttribute('data-match-box') === String(i)) b.classList.toggle('on', on) })
          })
        }
        const typeFill = (cp: number) => {
          fTexts.forEach((el, i) => {
            const full = el.getAttribute('data-full') || ''
            const sub = clamp((cp - i / 3) / (1 / 3), 0, 1)
            const n = Math.round(easeOut(sub) * full.length)
            el.textContent = full.slice(0, n)
            const typing = sub > 0 && sub < 1
            fFields[i]?.classList.toggle('is-typing', typing)
            fFields[i]?.classList.toggle('done', sub >= 1)
          })
        }
        const pickSingle = (cp: number) => {
          if (cp < 0.62) {
            const scan = clamp(Math.floor(cp / 0.62 * opts.length), 0, opts.length - 1)
            opts.forEach((o, i) => { o.classList.toggle('is-scan', i === scan); o.classList.remove('correct') })
          } else {
            opts.forEach(o => o.classList.remove('is-scan'))
            correct?.classList.add('correct')
          }
        }
        const full = () => {
          draws.forEach(d => { d.style.strokeDasharray = 'none'; d.style.strokeDashoffset = '0' })
          mBoxes.forEach(b => b.classList.add('on'))
          fTexts.forEach(el => { el.textContent = el.getAttribute('data-full') || '' })
          fFields.forEach(f => { f.classList.remove('is-typing'); f.classList.add('done') })
          opts.forEach(o => { o.classList.remove('is-scan'); o.classList.remove('correct') })
          correct?.classList.add('correct')
          if (labelEl) labelEl.textContent = sec.dataset.staticLabel || ''
          navEls.forEach((n, i) => { n.classList.toggle('done', i < 3); n.classList.remove('now') })
          if (barEl) barEl.style.transform = `scaleX(${3 / 12})`
        }
        const clearLive = () => {
          measure()
          mBoxes.forEach(b => b.classList.remove('on'))
          fTexts.forEach(el => { el.textContent = '' })
          fFields.forEach(f => f.classList.remove('is-typing', 'done'))
          opts.forEach(o => o.classList.remove('is-scan', 'correct'))
        }
        const staticFrame = () => { sec.classList.add('demo--static'); qs.forEach(q => { q.style.opacity = ''; q.style.transform = '' }); full() }
        const live = () => { sec.classList.remove('demo--static'); clearLive() }

        let ticking = false
        const update = () => {
          ticking = false
          if (sec.classList.contains('demo--static')) return
          const total = sec.offsetHeight - window.innerHeight
          if (total <= 0) { full(); return }
          const rect = sec.getBoundingClientRect()
          const p = clamp(-rect.top / total, 0, 1)
          const phase = p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2
          const local = clamp((p - phase / 3) * 3, 0, 1)
          const cp = easeOut(clamp((local - 0.08) / 0.74, 0, 1))

          qs.forEach((qEl, i) => {
            const fin = i === 0 ? 1 : easeIO(seg(p, i / 3 - W, i / 3 + W))
            const fout = i === qs.length - 1 ? 0 : easeIO(seg(p, (i + 1) / 3 - W, (i + 1) / 3 + W))
            const op = fin * (1 - fout)
            const ty = (1 - fin) * 22 + fout * -22
            qEl.style.opacity = op.toFixed(3)
            qEl.style.transform = `translateY(${ty.toFixed(1)}px)`
            qEl.style.pointerEvents = op > 0.5 ? 'auto' : 'none'
          })

          if (phase === 0) drawMatch(cp)
          else if (phase === 1) typeFill(cp)
          else pickSingle(cp)

          const activeNum = phase + 1
          if (labelEl) labelEl.textContent = (sec.dataset.progressLabel || '').replace('{n}', String(activeNum))
          if (barEl) barEl.style.transform = `scaleX(${((1 + p * 2) / 12).toFixed(4)})`
          navEls.forEach((n, j) => { n.classList.toggle('done', j + 1 < activeNum); n.classList.toggle('now', j + 1 === activeNum) })
        }
        const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }
        const setup = () => {
          if (reduce || isSmall()) { staticFrame(); return }
          live()
          requestAnimationFrame(() => { measure(); update() })
        }

        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', setup, { passive: true })
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup)
        setup()
        cleanups.push(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', setup) })
      }
    }

    // -- Block A — prog: vertical spine fills and steps light up as the track scrolls into view --
    {
      const sec = progRef.current
      if (sec) {
        const track = sec.querySelector<HTMLElement>('[data-prog-track]')
        const steps = Array.from(sec.querySelectorAll<HTMLElement>('[data-prog-step]'))
        if (track && steps.length) {
          const isSmall = () => window.matchMedia && window.matchMedia('(max-width: 900px)').matches
          const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v
          let nodeYs: number[] = []
          const measure = () => {
            const tr = track.getBoundingClientRect()
            nodeYs = steps.map(s => {
              const n = s.querySelector<HTMLElement>('.prog__node') || s
              const r = n.getBoundingClientRect()
              return tr.height ? (r.top + r.height / 2 - tr.top) / tr.height : 0
            })
          }
          const staticFrame = () => { sec.classList.remove('prog--live'); sec.style.removeProperty('--pfill'); steps.forEach(s => s.classList.remove('is-active')) }
          let ticking = false
          const update = () => {
            ticking = false
            if (!sec.classList.contains('prog--live')) return
            const tr = track.getBoundingClientRect(), vh = window.innerHeight
            const p = clamp((vh * 0.82 - tr.top) / (tr.height + vh * 0.40), 0, 1)
            sec.style.setProperty('--pfill', p.toFixed(4))
            steps.forEach((s, i) => s.classList.toggle('is-active', p >= (nodeYs[i] || 0) - 0.001))
          }
          const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }
          const setup = () => {
            if (reduce || isSmall()) { staticFrame(); return }
            sec.classList.add('prog--live')
            requestAnimationFrame(() => { measure(); update() })
          }
          window.addEventListener('scroll', onScroll, { passive: true })
          window.addEventListener('resize', setup, { passive: true })
          if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup)
          setup()
          cleanups.push(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', setup) })
        }
      }
    }

    // -- Errs E1: card tilts toward the cursor --
    {
      const card = errsRef.current
      if (card && !reduce && window.matchMedia && window.matchMedia('(hover:hover)').matches) {
        const onMove = (e: MouseEvent) => {
          const r = card.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width
          const py = (e.clientY - r.top) / r.height
          card.style.setProperty('--tilt-x', `${((0.5 - py) * 8).toFixed(2)}deg`)
          card.style.setProperty('--tilt-y', `${((px - 0.5) * 10).toFixed(2)}deg`)
          card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
          card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
        }
        const onLeave = () => { card.style.setProperty('--tilt-x', '0deg'); card.style.setProperty('--tilt-y', '0deg') }
        card.addEventListener('mousemove', onMove)
        card.addEventListener('mouseleave', onLeave)
        cleanups.push(() => { card.removeEventListener('mousemove', onMove); card.removeEventListener('mouseleave', onLeave) })
      }
    }

    return () => cleanups.forEach(fn => fn())
  }, [])

  return (
    <div className="pdf3" ref={rootRef} id="top">
      <style>{CSS}</style>
      <SiteNav onOpenUpload={() => openModal()} />
      <main>
        <Hero heroRef={heroRef} onOpenUpload={() => openModal()} />
        <StepsS3 />
        <Scrub scrubRef={scrubRef} />
        <TypesSection />
        <DemoSection demoRef={demoRef} />
        <ErrsSection errsRef={errsRef} />
        <LimitsSection />
        <FaqSection />
        <ProgSection progRef={progRef} />
        <FinalSection onOpenUpload={() => openModal()} />
      </main>
      <UploadModal modalOpen={modalOpen} onClose={closeModal} pendingFile={pendingFile} isLoggedIn={isLoggedIn} />
      <GlobalDropzone onFileDropped={handleGlobalDrop} suppress={modalOpen} />
    </div>
  )
}
