"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Crown, Gamepad2, Grid2x2, Hash, Circle } from "lucide-react";
import styles from "./GameSelectPage.module.scss";

export function GameSelectPage() {
  const t = useTranslations("Games");

  const GAMES = [
    {
      href: "/game/chess",
      title: t("chess_title"),
      description: t("chess_desc"),
      icon: <Crown size={32} strokeWidth={1.5} />,
      tags: [t("tag_strategy"), t("tag_1v1"), t("tag_ai")],
    },
    {
      href: "/game/pacman",
      title: t("pacman_title"),
      description: t("pacman_desc"),
      icon: <span style={{ fontSize: 32, lineHeight: 1 }}>●</span>,
      tags: [t("tag_arcade"), t("tag_solo")],
    },
  ];

  const COMING_SOON = [
    { title: t("ttt_title"),    icon: <Hash size={28} strokeWidth={1.5} />,    tags: [t("tag_casual"), t("tag_1v1")] },
    { title: t("sudoku_title"), icon: <Grid2x2 size={28} strokeWidth={1.5} />, tags: [t("tag_puzzle"), t("tag_solo")] },
    { title: t("go_title"),     icon: <Circle size={28} strokeWidth={1.5} />,  tags: [t("tag_strategy"), t("tag_1v1")] },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.iconWrap}><Gamepad2 size={28} strokeWidth={1.5} /></div>
          <div>
            <h1 className={styles.title}>{t("title")}</h1>
            <p className={styles.subtitle}>{t("subtitle")}</p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("available_now")}</h2>
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
          <h2 className={styles.sectionTitle}>{t("coming_soon_section")}</h2>
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
                <span className={styles.comingSoonBadge}>{t("coming_soon_badge")}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
