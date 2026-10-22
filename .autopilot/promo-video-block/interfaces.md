# Что уже построено

Ярус T0 — один проход, без тасков.

- `ForNewDesign/prototypes/promo-video-variants.html` — автономная витрина, CSS/JS инлайн, внешнее — только Google Fonts (Russo One).
- Общие части внутри файла: объект `VIDEOS` (`teachers`/`students`: base-путь без суффикса, постер, длительность), `setSrc(video, id)` (webm → mp4, идемпотентно по `data-v`), `onFail`, `flip` (FLIP-анимация из прямоугольника), один модальный плеер `#modal` для A (класс `.round`) и B.
- Варианты изолированы IIFE: `.va` (A), `.vb` (B), `.vc` (C), `.vd` + `.mini` (D). Живой замер высоты — `[data-measure]` → `[data-h]`.
- Смотреть только через HTTP (относительные пути к `promo-videos/`): `python3 -m http.server 8765` из корня репо; `.claude/launch.json` → конфиг `prototypes-static` для браузерной панели.
