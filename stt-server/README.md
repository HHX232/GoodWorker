# stt-server — распознавание речи для /lecture

HTTP-сервис на faster-whisper (CPU, int8), отдельный от `stt-agent/` (тот живёт внутри LiveKit-звонка).

Гибрид: `quality=draft` — модель `DRAFT_MODEL` (small) по кускам ~20 с во время лекции;
`quality=final` — `FINAL_MODEL` (large-v3-turbo) после «Стоп», заменяет черновик.

`POST /transcribe` (multipart: `audio`, `quality`, `prompt`; заголовок `X-STT-Key`) →
`{text, segments[{start,end,text,avgLogprob,noSpeechProb}], durationMs, rms, ms}`.
429 `busy` — очередь полна, клиент повторит позже (кусок лежит в IndexedDB).

Переменные: `STT_API_KEY`, `DRAFT_MODEL`, `FINAL_MODEL`, `WHISPER_LANGUAGE` (ru), `DRAFT_WORKERS` (2),
`FINAL_WORKERS` (1), `MAX_QUEUE` (8), `CPU_THREADS`, `PRELOAD_FINAL=1`.
В приложении: `LECTURE_STT_URL` (например `http://lecture-stt.railway.internal:8080`) и тот же `STT_API_KEY`.
