FROM python:3.11-slim

WORKDIR /app

# Системные зависимости для faster-whisper
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Устанавливаем зависимости
# faster-whisper тянет ctranslate2 — нужно время на первый build
RUN pip install --no-cache-dir -r requirements.txt

COPY agent.py .

# При первом запуске модель скачается (~150MB для base)
# Чтобы не скачивать каждый деплой — Railway Volume или предзагрузка
ENV WHISPER_MODEL=base
ENV WHISPER_LANGUAGE=ru
ENV CHUNK_SECONDS=3

# Railway передаёт переменные через env:
# LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET

CMD ["python", "agent.py", "start"]
