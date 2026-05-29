"use client";

import Link from "next/link";
import { Crown, Gamepad2, Grid2x2, Hash, Circle } from "lucide-react";
import styles from "./GameSelectPage.module.scss";

const GAMES = [
  {
    href: "/game/chess",
    title: "Шахматы",
    description: "Классическая игра. Режим против ИИ или с другом за одним экраном.",
    icon: <Crown size={32} strokeWidth={1.5} />,
    tags: ["Стратегия", "1v1", "ИИ"],
  },
  {
    href: "/game/pacman",
    title: "Pac-Man",
    description: "Собирай точки, убегай от призраков и объедай их после силовых шариков.",
    icon: <span style={{ fontSize: 32, lineHeight: 1 }}>●</span>,
    tags: ["Аркада", "Одиночный"],
  },
];

const COMING_SOON = [
  { title: "Крестики-нолики", icon: <Hash size={28} strokeWidth={1.5} />, tags: ["Казуал", "1v1"] },
  { title: "Судоку",           icon: <Grid2x2 size={28} strokeWidth={1.5} />, tags: ["Пазл", "Одиночный"] },
  { title: "Го",               icon: <Circle size={28} strokeWidth={1.5} />,  tags: ["Стратегия", "1v1"] },
];

export function GameSelectPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.iconWrap}><Gamepad2 size={28} strokeWidth={1.5} /></div>
          <div>
            <h1 className={styles.title}>Игры</h1>
            <p className={styles.subtitle}>Развивай стратегическое мышление и логику</p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Доступно сейчас</h2>
          <div className={styles.grid}>
            {GAMES.map((game) => (
              <Link key={game.href} href={game.href} className={styles.card}>
                <div className={styles.cardIcon}>{game.icon}</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{game.title}</div>
                  <div className={styles.cardDesc}>{game.description}</div>
                  <div className={styles.tags}>
                    {game.tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
                  </div>
                </div>
                <svg className={styles.cardArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Скоро</h2>
          <div className={styles.grid}>
            {COMING_SOON.map((game) => (
              <div key={game.title} className={`${styles.card} ${styles.cardDisabled}`}>
                <div className={`${styles.cardIcon} ${styles.cardIconMuted}`}>{game.icon}</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{game.title}</div>
                  <div className={styles.tags}>
                    {game.tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
                  </div>
                </div>
                <span className={styles.comingSoonBadge}>Скоро</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
