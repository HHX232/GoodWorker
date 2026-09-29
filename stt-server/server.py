"""
Lecture STT server — faster-whisper over HTTP, separate from the LiveKit
call agent (stt-agent/): /lecture records on the student's phone, not in a
LiveKit room.

Hybrid quality (decided for the no-GPU start):
  * draft  — small model, one ~20 s chunk at a time, while the lecture runs;
  * final  — big model (large-v3-turbo by default), after "Стоп", over the
             same chunks; replaces the draft text.

Filtering is deliberately lenient: in a lecture hall it's better to keep
some noise in the draft and let DeepSeek throw it away later than to lose
the lecturer's words. Every segment comes back with its scores so the
caller can tell DeepSeek which parts are doubtful.
"""

import asyncio
import io
import logging
import os
import time

import av
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from faster_whisper import WhisperModel, decode_audio

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("stt-server")

API_KEY = os.getenv("STT_API_KEY", "")
DRAFT_MODEL = os.getenv("DRAFT_MODEL", "small")
FINAL_MODEL = os.getenv("FINAL_MODEL", "large-v3-turbo")
LANGUAGE = os.getenv("WHISPER_LANGUAGE", "ru") or None
CPU_THREADS = int(os.getenv("CPU_THREADS", "0")) or None
# How many chunks are transcribed at once per quality. Anything beyond
# MAX_QUEUE waiting gets 429 — the client keeps the chunk in its local
# queue (IndexedDB) and retries, so nothing is lost.
DRAFT_WORKERS = int(os.getenv("DRAFT_WORKERS", "2"))
FINAL_WORKERS = int(os.getenv("FINAL_WORKERS", "1"))
MAX_QUEUE = int(os.getenv("MAX_QUEUE", "8"))
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
SAMPLE_RATE = 16000
TARGET_RMS = 0.08

app = FastAPI(title="goodworker-lecture-stt")

_models: dict[str, WhisperModel] = {}
_sems = {"draft": asyncio.Semaphore(DRAFT_WORKERS), "final": asyncio.Semaphore(FINAL_WORKERS)}
_waiting = {"draft": 0, "final": 0}


def model_for(quality: str) -> WhisperModel:
    name = FINAL_MODEL if quality == "final" else DRAFT_MODEL
    if name not in _models:
        log.info("loading whisper model %s (cpu, int8)", name)
        kwargs = {"device": "cpu", "compute_type": "int8"}
        if CPU_THREADS:
            kwargs["cpu_threads"] = CPU_THREADS
        _models[name] = WhisperModel(name, **kwargs)
    return _models[name]


@app.on_event("startup")
async def warm() -> None:
    # The draft model must be ready before the first lecture chunk; the big
    # one loads lazily on the first final pass (it's ~1.6 GB).
    await asyncio.to_thread(model_for, "draft")
    if os.getenv("PRELOAD_FINAL") == "1":
        await asyncio.to_thread(model_for, "final")


def normalize(audio: np.ndarray) -> tuple[np.ndarray, float]:
    rms = float(np.sqrt(np.mean(audio ** 2))) if audio.size else 0.0
    # A phone on a desk far from the lecturer records quietly — lift it
    # before Whisper (same idea as stt-agent's mobile path).
    if 0.0002 < rms < TARGET_RMS:
        audio = np.clip(audio * (TARGET_RMS / rms), -1.0, 1.0).astype(np.float32)
    return audio, rms


def run(audio_bytes: bytes, quality: str, prompt: str | None) -> dict:
    t0 = time.time()
    # PyAV (bundled with faster-whisper) decodes webm/opus from Chrome and
    # mp4/aac from iOS Safari alike — no system ffmpeg needed.
    audio = decode_audio(io.BytesIO(audio_bytes), sampling_rate=SAMPLE_RATE)
    duration_ms = int(len(audio) / SAMPLE_RATE * 1000)
    audio, rms = normalize(audio)
    if rms <= 0.0002:
        return {"text": "", "segments": [], "durationMs": duration_ms, "rms": rms, "ms": int((time.time() - t0) * 1000)}

    segments, info = model_for(quality).transcribe(
        audio,
        language=LANGUAGE,
        beam_size=5 if quality == "final" else 1,
        vad_filter=True,
        # Lenient VAD: short pauses stay inside a phrase, quiet speech passes.
        vad_parameters={"min_silence_duration_ms": 500, "threshold": 0.35, "speech_pad_ms": 300},
        condition_on_previous_text=False,
        # Previous chunk's tail + lecture title — helps with terms and names.
        initial_prompt=prompt or None,
        no_speech_threshold=0.7,
        log_prob_threshold=-1.2,
    )
    out = []
    for s in segments:
        text = s.text.strip()
        if not text:
            continue
        out.append({
            "start": round(s.start, 2),
            "end": round(s.end, 2),
            "text": text,
            "avgLogprob": round(s.avg_logprob, 3),
            "noSpeechProb": round(s.no_speech_prob, 3),
        })
    text = " ".join(s["text"] for s in out).strip()
    ms = int((time.time() - t0) * 1000)
    log.info("%s %.1fs audio → %d chars in %d ms (rms=%.4f lang=%s)", quality, duration_ms / 1000, len(text), ms, rms, info.language)
    return {"text": text, "segments": out, "durationMs": duration_ms, "rms": rms, "ms": ms}


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "draftModel": DRAFT_MODEL, "finalModel": FINAL_MODEL, "loaded": list(_models), "waiting": _waiting}


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    quality: str = Form("draft"),
    prompt: str = Form(""),
    x_stt_key: str = Header(default=""),
) -> dict:
    if API_KEY and x_stt_key != API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")
    if quality not in ("draft", "final"):
        raise HTTPException(status_code=400, detail="quality must be draft|final")
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty audio")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="chunk too large")
    if _waiting[quality] >= MAX_QUEUE:
        raise HTTPException(status_code=429, detail="busy")

    _waiting[quality] += 1
    acquired = False
    try:
        await _sems[quality].acquire()
        acquired = True
    finally:
        _waiting[quality] -= 1
    try:
        return await asyncio.to_thread(run, data, quality, prompt[-400:] if prompt else None)
    except Exception as e:  # undecodable chunk etc. — the caller retries or skips
        log.exception("transcribe failed")
        raise HTTPException(status_code=422, detail=f"decode/transcribe failed: {e}") from e
    finally:
        if acquired:
            _sems[quality].release()


MAX_CONCAT_BYTES = 200 * 1024 * 1024
CONCAT_RATE = 24000


def concat_to_m4a(parts: list[bytes]) -> bytes:
    # Chunks are standalone files (one MediaRecorder each) — they can't be
    # glued byte-wise, so decode them all and encode one AAC track (.m4a
    # plays everywhere, iPhone included).
    pcm = [decode_audio(io.BytesIO(p), sampling_rate=CONCAT_RATE) for p in parts]
    audio = np.concatenate(pcm) if pcm else np.zeros(0, dtype=np.float32)
    out_buf = io.BytesIO()
    out = av.open(out_buf, "w", format="mp4")
    stream = out.add_stream("aac", rate=CONCAT_RATE)
    stream.layout = "mono"
    stream.bit_rate = 48_000
    frame_size = 1024
    for i in range(0, len(audio), frame_size * 50):
        block = audio[i:i + frame_size * 50].astype(np.float32).reshape(1, -1)
        frame = av.AudioFrame.from_ndarray(block, format="flt", layout="mono")
        frame.sample_rate = CONCAT_RATE
        for packet in stream.encode(frame):
            out.mux(packet)
    for packet in stream.encode(None):
        out.mux(packet)
    out.close()
    return out_buf.getvalue()


@app.post("/concat")
async def concat(files: list[UploadFile] = File(...), x_stt_key: str = Header(default="")) -> Response:
    if API_KEY and x_stt_key != API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")
    parts = [await f.read() for f in files]
    if sum(len(p) for p in parts) > MAX_CONCAT_BYTES:
        raise HTTPException(status_code=413, detail="too large")
    parts = [p for p in parts if p]
    if not parts:
        raise HTTPException(status_code=400, detail="no audio")
    try:
        data = await asyncio.to_thread(concat_to_m4a, parts)
    except Exception as e:
        log.exception("concat failed")
        raise HTTPException(status_code=422, detail=f"concat failed: {e}") from e
    return Response(content=data, media_type="audio/mp4")
