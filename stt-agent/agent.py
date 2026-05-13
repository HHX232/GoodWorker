"""
LiveKit STT Agent — faster-whisper (CPU, бесплатно)
Транскрибирует каждого участника отдельно и шлёт текст через DataChannel.

Язык определяется автоматически на каждом чанке.
Принудительная фиксация — только через WHISPER_LANGUAGE=ru (env).
condition_on_previous_text=False — свободное переключение языков внутри разговора.
"""

import asyncio
import json
import logging
import os
from collections import defaultdict
from datetime import datetime

import numpy as np
from dotenv import load_dotenv
from faster_whisper import WhisperModel
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stt-agent")

# ── Настройки ──────────────────────────────────────────────────────────────────
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")  # tiny | base | small

# Оставь пустым — Whisper сам определяет язык каждого чанка.
# Установи "ru"/"en" только если все участники говорят на одном языке.
FORCE_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "") or None

CHUNK_SECONDS = float(os.getenv("CHUNK_SECONDS", "3"))
SAMPLE_RATE = 16000

session_transcript: dict[str, list] = defaultdict(list)


def load_model() -> WhisperModel:
    logger.info(f"Загружаем Whisper модель '{WHISPER_MODEL}' (CPU)...")
    model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    logger.info("Модель загружена ✓")
    return model


whisper = load_model()


def transcribe_chunk(audio_data: np.ndarray) -> tuple[str, str | None]:
    """
    Транскрибирует numpy float32 16kHz.
    language=None  → Whisper определяет язык сам на каждом чанке.
    condition_on_previous_text=False → не застревает в языке при code-switching.
    """
    if len(audio_data) < SAMPLE_RATE * 0.3:
        return "", None

    segments, info = whisper.transcribe(
        audio_data,
        language=FORCE_LANGUAGE,
        beam_size=1,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=300),
        condition_on_previous_text=False,
    )

    text = " ".join(s.text.strip() for s in segments).strip()
    return text, info.language


async def transcribe_participant_audio(
    audio_stream: rtc.AudioStream,
    participant: rtc.RemoteParticipant,
    room: rtc.Room,
):
    identity = participant.identity
    role = participant.metadata or "participant"
    logger.info(f"Начинаем транскрипцию для {identity} (роль: {role})")

    buffer: list[np.ndarray] = []
    buffer_samples = 0
    target_samples = int(SAMPLE_RATE * CHUNK_SECONDS)

    async for event in audio_stream:
        frame = event.frame

        pcm_int16 = np.frombuffer(frame.data, dtype=np.int16)
        pcm_float32 = pcm_int16.astype(np.float32) / 32768.0

        if frame.sample_rate != SAMPLE_RATE:
            ratio = SAMPLE_RATE / frame.sample_rate
            new_len = int(len(pcm_float32) * ratio)
            pcm_float32 = np.interp(
                np.linspace(0, len(pcm_float32), new_len),
                np.arange(len(pcm_float32)),
                pcm_float32,
            )

        buffer.append(pcm_float32)
        buffer_samples += len(pcm_float32)

        if buffer_samples >= target_samples:
            chunk = np.concatenate(buffer)
            buffer = []
            buffer_samples = 0

            text, lang = await asyncio.get_event_loop().run_in_executor(
                None, transcribe_chunk, chunk
            )

            if not text:
                continue

            logger.info(f"[{identity}] ({lang}): {text}")

            entry = {
                "time": datetime.now().strftime("%H:%M:%S"),
                "participant": identity,
                "role": role,
                "text": text,
                "lang": lang,
            }
            session_transcript[identity].append(entry)

            await room.local_participant.publish_data(
                json.dumps({"type": "transcript_chunk", **entry}, ensure_ascii=False).encode(),
                reliable=True,
            )


def build_final_transcript() -> str:
    all_entries = [e for entries in session_transcript.values() for e in entries]
    all_entries.sort(key=lambda e: e["time"])

    lines = ["📝 КОНСПЕКТ", "=" * 40]
    for e in all_entries:
        role_label = {"tutor": "Репетитор", "student": "Ученик"}.get(e["role"], e["role"])
        lang_tag = f"[{e.get('lang', '?')}] " if e.get("lang") else ""
        lines.append(f"[{e['time']}] {e['participant']} ({role_label}): {lang_tag}{e['text']}")

    return "\n".join(lines)


async def entrypoint(ctx: JobContext):
    logger.info(f"Агент подключается к комнате: {ctx.room.name}")
    await ctx.connect()

    room = ctx.room
    active_streams: dict[str, asyncio.Task] = {}

    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        logger.info(f"Новый аудиотрек от {participant.identity}")
        task = asyncio.ensure_future(
            transcribe_participant_audio(rtc.AudioStream(track), participant, room)
        )
        active_streams[participant.identity] = task

    @room.on("track_unsubscribed")
    def on_track_unsubscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        identity = participant.identity
        if identity in active_streams:
            active_streams[identity].cancel()
            del active_streams[identity]
            logger.info(f"Остановили транскрипцию для {identity}")

    @room.on("participant_disconnected")
    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        entries = session_transcript.get(participant.identity, [])
        if entries:
            asyncio.ensure_future(
                room.local_participant.publish_data(
                    json.dumps({
                        "type": "participant_summary",
                        "participant": participant.identity,
                        "entries": entries,
                    }, ensure_ascii=False).encode(),
                    reliable=True,
                )
            )

    @room.on("disconnected")
    def on_room_disconnected():
        final = build_final_transcript()
        logger.info("Итоговый конспект:\n" + final)
        asyncio.ensure_future(
            room.local_participant.publish_data(
                json.dumps({
                    "type": "session_transcript",
                    "transcript": final,
                    "entries": [e for entries in session_transcript.values() for e in entries],
                }, ensure_ascii=False).encode(),
                reliable=True,
            )
        )

    await asyncio.sleep(float("inf"))


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
