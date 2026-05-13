/**
 * LiveSubtitles.tsx
 * Показывает текущую реплику участника поверх его видео (слева снизу для локального).
 * Использование:
 *   <LiveSubtitles text={live["vasya"]?.text} isLocal />
 */

import { useEffect, useState } from "react";

interface Props {
  text?: string;
  isLocal?: boolean;      // true → позиционируем слева снизу под своим видео
  participantName?: string;
}

export function LiveSubtitles({ text, isLocal, participantName }: Props) {
  const [visible, setVisible] = useState(false);
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    if (!text) return;

    setDisplayText(text);
    setVisible(true);

    // Прячем субтитры через 4 секунды после последней реплики
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [text]);

  if (!visible || !displayText) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: isLocal ? 8 : 4,
        left: isLocal ? 8 : 0,
        right: isLocal ? 8 : 0,
        padding: "6px 10px",
        background: "rgba(0,0,0,0.72)",
        borderRadius: 8,
        backdropFilter: "blur(4px)",
        maxWidth: isLocal ? "100%" : "90%",
        margin: isLocal ? 0 : "0 auto",
        // Анимация появления
        animation: "fadeIn 0.2s ease",
      }}
    >
      {participantName && (
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.5)",
            display: "block",
            marginBottom: 2,
          }}
        >
          {participantName}
        </span>
      )}
      <span
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1.4,
          fontStyle: "italic",
        }}
      >
        {displayText}
      </span>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
