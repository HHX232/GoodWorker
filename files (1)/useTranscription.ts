/**
 * useTranscription.ts
 * Хук для получения транскрипций от STT-агента через LiveKit DataChannel.
 * Подключи к своему компоненту видеозвонка.
 */

import { useEffect, useState, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";

export interface TranscriptEntry {
  time: string;
  participant: string;
  role: string;
  text: string;
}

interface TranscriptState {
  // Все записи в хронологическом порядке
  entries: TranscriptEntry[];
  // Последняя реплика каждого участника (для live-субтитров)
  live: Record<string, TranscriptEntry>;
  // Финальный конспект (приходит когда комната закрывается)
  finalTranscript: string | null;
}

export function useTranscription(room: Room | null) {
  const [state, setState] = useState<TranscriptState>({
    entries: [],
    live: {},
    finalTranscript: null,
  });

  const handleData = useCallback((payload: Uint8Array) => {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload));

      switch (msg.type) {
        // Кусок транскрипции в реальном времени
        case "transcript_chunk": {
          const entry: TranscriptEntry = {
            time: msg.time,
            participant: msg.participant,
            role: msg.role,
            text: msg.text,
          };
          setState((prev) => ({
            ...prev,
            entries: [...prev.entries, entry],
            live: {
              ...prev.live,
              [msg.participant]: entry,
            },
          }));
          break;
        }

        // Итог одного участника (когда он уходит)
        case "participant_summary": {
          console.log(`Итог для ${msg.participant}:`, msg.entries);
          break;
        }

        // Полный конспект сессии (когда закрывается комната)
        case "session_transcript": {
          setState((prev) => ({
            ...prev,
            finalTranscript: msg.transcript,
          }));
          break;
        }
      }
    } catch (e) {
      console.error("Ошибка парсинга DataChannel:", e);
    }
  }, []);

  useEffect(() => {
    if (!room) return;

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, handleData]);

  // Сгруппировать по участникам (для итогового конспекта)
  const byParticipant = state.entries.reduce<Record<string, TranscriptEntry[]>>(
    (acc, entry) => {
      if (!acc[entry.participant]) acc[entry.participant] = [];
      acc[entry.participant].push(entry);
      return acc;
    },
    {}
  );

  return {
    entries: state.entries,          // все реплики хронологически
    live: state.live,                // последняя реплика каждого (для субтитров)
    byParticipant,                   // сгруппировано по участнику
    finalTranscript: state.finalTranscript,
  };
}
