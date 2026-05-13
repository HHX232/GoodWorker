# LiveKit STT Agent — faster-whisper (CPU, бесплатно)

Транскрибирует аудио каждого участника в реальном времени.
Работает локально и на Railway без GPU.

## Быстрый старт

### 1. Локально

```bash
# Клонируй и установи зависимости
pip install -r requirements.txt

# Скопируй и заполни переменные
cp .env.example .env

# Запуск (агент подключится к LiveKit Cloud и будет ждать комнаты)
python agent.py start
```

### 2. Railway деплой

1. Создай новый сервис в Railway → "Deploy from GitHub repo"
2. Railway автоматически найдёт `Dockerfile` и соберёт
3. В Settings → Variables добавь:
   ```
   LIVEKIT_URL=wss://...
   LIVEKIT_API_KEY=...
   LIVEKIT_API_SECRET=...
   WHISPER_MODEL=base
   WHISPER_LANGUAGE=ru
   ```
4. Готово — агент стартует и подключается к каждой новой комнате

### 3. Фронт (Next.js)

Скопируй `useTranscription.ts` и `LiveSubtitles.tsx` в свой проект:

```tsx
// В компоненте видеозвонка
import { useTranscription } from "./useTranscription";
import { LiveSubtitles } from "./LiveSubtitles";

function VideoCall({ room }) {
  const { entries, live } = useTranscription(room);

  return (
    <div>
      {/* Видео участников */}
      {participants.map(p => (
        <div key={p.identity} style={{ position: "relative" }}>
          <VideoTile participant={p} />
          <LiveSubtitles
            text={live[p.identity]?.text}
            isLocal={p.isLocal}
            participantName={p.identity}
          />
        </div>
      ))}

      {/* Лайв конспект */}
      <div className="transcript-panel">
        {entries.map((e, i) => (
          <p key={i}>
            <b>{e.participant}</b>: {e.text}
          </p>
        ))}
      </div>
    </div>
  );
}
```

### Metadata участников (роли)

При подключении к комнате передавай роль в `metadata`:

```typescript
// Next.js — когда создаёшь токен
const token = new AccessToken(apiKey, apiSecret, {
  identity: "vasya",
  metadata: "tutor",  // или "student"
});
```

## Настройки

| Переменная | По умолчанию | Описание |
|---|---|---|
| `WHISPER_MODEL` | `base` | `tiny`=быстрее, `small`=лучше |
| `WHISPER_LANGUAGE` | `ru` | Язык или пусто для авто |
| `CHUNK_SECONDS` | `3` | Интервал транскрипции (сек) |

## Производительность на CPU (Railway Hobby — 1 vCPU)

| Модель | Размер | Время на 3с аудио |
|---|---|---|
| tiny | 75MB | ~0.8с |
| base | 150MB | ~1.5с |
| small | 460MB | ~4с |

**Рекомендация**: `base` — хороший баланс для русского языка.

## Важно

- При первом деплое на Railway модель скачается (~150MB для `base`).
  Последующие деплои используют кэш слоёв Docker.
- Для ускорения кэшируй модель через Railway Volume:
  `HF_HOME=/data` (Railway Volume смонтируй на `/data`)
