FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the draft model into the image so a cold start doesn't wait on a
# download; the final model is fetched on first use (and cached in HF_HOME).
ENV HF_HOME=/models
ARG DRAFT_MODEL=small
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${DRAFT_MODEL}', device='cpu', compute_type='int8')"

COPY server.py .
ENV PORT=8080
# Memory: glibc gives each thread its own heap arena and rarely returns freed
# memory — with Whisper's threads RSS creeps up to gigabytes. Two arenas and an
# eager trim keep it near the model's real size. Thread pools are capped too
# (the container sees every host core).
ENV MALLOC_ARENA_MAX=2 \
    MALLOC_TRIM_THRESHOLD_=131072 \
    OMP_NUM_THREADS=4 \
    CPU_THREADS=4
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1"]
