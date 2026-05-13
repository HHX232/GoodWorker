"""
LiveKit STT Agent — faster-whisper (CPU, бесплатно)
Транскрибирует каждого участника отдельно и шлёт текст через DataChannel.
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
from livekit.agents import JobContext, JobRequest, WorkerOptions, cli

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stt-agent")

# -------------------------------------------------------------------
# Настройки модели
# tiny   — быстрее всего, хуже качество (рекомендуется для старта)
# base   — баланс скорости и качества
# small  — лучше, но медленнее на CPU
# -------------------------------------------------------------------
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
LANGUAGE = os.getenv("WHISPER_LANGUAGE", "ru")

# Накапливаем аудио кусками по N секунд, потом транскрибируем
CHUNK_SECONDS = float(os.getenv("CHUNK_SECONDS", "3"))
SAMPLE_RATE = 16000  # Whisper всегда хочет 16kHz

# Глобальный конспект комнаты: { participant_identity: [{"time": ..., "text": ...}] }
session_transcript: dict[str, list] = defaultdict(list)


def load_model() -> WhisperModel:
    logger.info(f"Загружаем Whisper модель '{WHISPER_MODEL}' (CPU)...")
    model = WhisperModel(
        WHISPER_MODEL,
        device="cpu",
        compute_type="int8",  # int8 — быстрее на CPU, меньше памяти
    )
    logger.info("Модель загружена ✓")
    return model


# Загружаем один раз при старте воркера
whisper = load_model()


def transcribe_chunk(audio_data: np.ndarray) -> str:
    """Транскрибирует numpy массив float32 16kHz → строку текста."""
    if len(audio_data) < SAMPLE_RATE * 0.3:  # меньше 0.3с — пропускаем
        return ""

    segments, _ = whisper.transcribe(
        audio_data,
        language=LANGUAGE,
        beam_size=1,          # beam_size=1 — быстрее на CPU
        vad_filter=True,      # фильтрует тишину автоматически
        vad_parameters=dict(
            min_silence_duration_ms=300,
        ),
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    return text


async def transcribe_participant_audio(
    audio_stream: rtc.AudioStream,
    participant: rtc.RemoteParticipant,
    room: rtc.Room,
):
    """
    Читает аудиопоток участника, накапливает буфер,
    каждые CHUNK_SECONDS секунд транскрибирует и рассылает DataChannel.
    """
    identity = participant.identity
    role = participant.metadata or "participant"  # tutor / student / participant
    logger.info(f"Начинаем транскрипцию для {identity} (роль: {role})")

    buffer: list[np.ndarray] = []
    buffer_samples = 0
    target_samples = int(SAMPLE_RATE * CHUNK_SECONDS)

    async for event in audio_stream:
        frame = event.frame

        # LiveKit отдаёт int16 PCM → конвертируем в float32 для Whisper
        pcm_int16 = np.frombuffer(frame.data, dtype=np.int16)
        pcm_float32 = pcm_int16.astype(np.float32) / 32768.0

        # Ресемплируем если нужно (LiveKit обычно 48kHz)
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

            # Транскрибируем в отдельном потоке чтобы не блокировать event loop
            text = await asyncio.get_event_loop().run_in_executor(
                None, transcribe_chunk, chunk
            )

            if not text:
                continue

            logger.info(f"[{identity}]: {text}")

            # Сохраняем в конспект
            entry = {
                "time": datetime.now().strftime("%H:%M:%S"),
                "participant": identity,
                "role": role,
                "text": text,
            }
            session_transcript[identity].append(entry)

            # Рассылаем всем участникам через DataChannel
            payload = json.dumps({
                "type": "transcript_chunk",
                **entry,
            }, ensure_ascii=False).encode()

            await room.local_participant.publish_data(
                payload,
                reliable=True,  # гарантированная доставка
            )


def build_final_transcript() -> str:
    """Собирает итоговый хронологический конспект."""
    all_entries = []
    for entries in session_transcript.values():
        all_entries.extend(entries)

    # Сортируем по времени
    all_entries.sort(key=lambda e: e["time"])

    lines = ["📝 КОНСПЕКТ УРОКА", "=" * 40]
    for e in all_entries:
        role_label = {"tutor": "Репетитор", "student": "Ученик"}.get(e["role"], e["role"])
        lines.append(f"[{e['time']}] {e['participant']} ({role_label}): {e['text']}")

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

        identity = participant.identity
        logger.info(f"Новый аудиотрек от {identity}")

        audio_stream = rtc.AudioStream(track)

        task = asyncio.ensure_future(
            transcribe_participant_audio(audio_stream, participant, room)
        )
        active_streams[identity] = task

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
        """Когда участник уходит — отправляем его итог."""
        identity = participant.identity
        entries = session_transcript.get(identity, [])
        if entries:
            summary_payload = json.dumps({
                "type": "participant_summary",
                "participant": identity,
                "entries": entries,
            }, ensure_ascii=False).encode()
            asyncio.ensure_future(
                room.local_participant.publish_data(summary_payload, reliable=True)
            )

    @room.on("disconnected")
    def on_room_disconnected():
        """Когда комната закрывается — публикуем полный конспект."""
        final = build_final_transcript()
        logger.info("Итоговый конспект:\n" + final)

        final_payload = json.dumps({
            "type": "session_transcript",
            "transcript": final,
            "entries": [
                e for entries in session_transcript.values() for e in entries
            ],
        }, ensure_ascii=False).encode()

        asyncio.ensure_future(
            room.local_participant.publish_data(final_payload, reliable=True)
        )

    # Держим агента живым пока комната не закроется
    await asyncio.sleep(float("inf"))


async def request_fnc(req: JobRequest):
    """Принимаем все входящие задачи."""
    await req.accept(entrypoint)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            request_fnc=request_fnc,
            # Агент автоматически подключается к каждой новой комнате
        )
    )
