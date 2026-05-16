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
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli

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
participant_is_mobile: dict[str, bool] = {}


def load_model() -> WhisperModel:
    logger.info(f"Загружаем Whisper модель '{WHISPER_MODEL}' (CPU)...")
    model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    logger.info("Модель загружена ✓")
    return model


whisper = load_model()

TARGET_RMS = 0.10


def transcribe_chunk(audio_data: np.ndarray, is_mobile: bool = False) -> tuple[str, str | None]:
    if len(audio_data) < SAMPLE_RATE * 0.3:
        return "", None

    rms = float(np.sqrt(np.mean(audio_data ** 2)))

    if rms < 0.0002:
        logger.info(f"chunk skipped (silence) rms={rms:.5f} mobile={is_mobile}")
        return "", None

    # Mobile mics without AGC capture very quiet audio — normalize before Whisper
    if rms < TARGET_RMS:
        audio_data = np.clip(audio_data * (TARGET_RMS / rms), -1.0, 1.0)

    # Only disable VAD when client explicitly flagged as mobile via client_info.
    # Disabling VAD for desktop would let background noise through as phantom phrases.
    use_vad = not is_mobile

    logger.info(f"chunk rms={rms:.5f} mobile={is_mobile} vad={use_vad}")

    transcribe_kwargs: dict = dict(
        language=FORCE_LANGUAGE,
        beam_size=1,
        vad_filter=use_vad,
        condition_on_previous_text=False,
    )
    if use_vad:
        transcribe_kwargs["vad_parameters"] = dict(min_silence_duration_ms=300)

    segments, info = whisper.transcribe(audio_data, **transcribe_kwargs)

    text = " ".join(s.text.strip() for s in segments).strip()
    if len(text) < 3:
        logger.info(f"chunk filtered (too short): '{text}'")
        return "", None

    logger.info(f"whisper → '{text}' lang={info.language}")
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

            # Read isMobile at chunk time — client_info may arrive after stream starts
            is_mobile = participant_is_mobile.get(identity, False)
            text, lang = await asyncio.get_event_loop().run_in_executor(
                None, transcribe_chunk, chunk, is_mobile
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

            try:
                await room.local_participant.publish_data(
                    json.dumps({"type": "transcript_chunk", **entry}, ensure_ascii=False).encode(),
                    reliable=True,
                )
                logger.info(f"[{identity}] published chunk ok")
            except Exception as pub_err:
                logger.error(f"[{identity}] publish_data failed: {pub_err}")


def build_final_transcript() -> str:
    all_entries = [e for entries in session_transcript.values() for e in entries]
    all_entries.sort(key=lambda e: e["time"])

    lines = ["📝 КОНСПЕКТ", "=" * 40]
    for e in all_entries:
        role_label = {"tutor": "Репетитор", "student": "Ученик"}.get(e["role"], e["role"])
        lang_tag = f"[{e.get('lang', '?')}] " if e.get("lang") else ""
        lines.append(f"[{e['time']}] {e['participant']} ({role_label}): {lang_tag}{e['text']}")

    return "\n".join(lines)


def start_transcription(
    identity: str,
    track: rtc.Track,
    participant: rtc.RemoteParticipant,
    room: rtc.Room,
    active_streams: dict,
):
    if identity in active_streams and not active_streams[identity].done():
        return
    logger.info(f"Начинаем транскрипцию для {identity}")
    task = asyncio.ensure_future(
        transcribe_participant_audio(rtc.AudioStream(track), participant, room)
    )
    active_streams[identity] = task


async def entrypoint(ctx: JobContext):
    logger.info(f"Агент подключается к комнате: {ctx.room.name}")

    room = ctx.room
    active_streams: dict[str, asyncio.Task] = {}

    # Register handlers BEFORE connect so no events are missed
    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        start_transcription(participant.identity, track, participant, room, active_streams)

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

    @room.on("data_received")
    def on_data_received(*args):
        try:
            # Handle both old (bytes first) and new (DataPacket first) SDK signatures
            raw = args[0] if args else b""
            if hasattr(raw, "data"):
                raw = raw.data
            if not isinstance(raw, (bytes, bytearray)):
                return
            msg = json.loads(raw)
            if msg.get("type") == "client_info":
                identity = msg.get("identity", "")
                is_mobile = bool(msg.get("isMobile", False))
                participant_is_mobile[identity] = is_mobile
                logger.info(f"client_info: {identity} isMobile={is_mobile}")
                return
            if msg.get("type") == "transcript_request":
                final = build_final_transcript()
                all_entries = [e for entries in session_transcript.values() for e in entries]
                asyncio.ensure_future(
                    room.local_participant.publish_data(
                        json.dumps({
                            "type": "session_transcript",
                            "transcript": final,
                            "entries": all_entries,
                        }, ensure_ascii=False).encode(),
                        reliable=True,
                    )
                )
        except Exception:
            pass

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

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f"Агент подключён. Участников в комнате: {len(room.remote_participants)}")

    # Subscribe to audio tracks already published before the agent joined.
    # publication.track is None if not yet subscribed — set_subscribed(True) triggers subscription;
    # track_subscribed will fire when the track arrives.
    for participant in room.remote_participants.values():
        for publication in participant.track_publications.values():
            if publication.kind != rtc.TrackKind.KIND_AUDIO:
                continue
            track = publication.track
            if track:
                logger.info(f"Уже подписан на трек от {participant.identity}")
                start_transcription(participant.identity, track, participant, room, active_streams)
            else:
                logger.info(f"Форсируем подписку на трек от {participant.identity}")
                try:
                    publication.set_subscribed(True)
                except Exception as e:
                    logger.warning(f"set_subscribed failed for {participant.identity}: {e}")

    await asyncio.sleep(float("inf"))


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
