# 10 — Шахматный узел в road-map (курсах)

**Требования:** G10 (+ R07)
**Blocked by:** —
**Зона:** `src/features/Roadmap/` · `src/widgets/RoadMap/` · `src/shared/types/RoadMap/` · `src/shared/lib/roadmapOutline.ts` · `src/shared/ui/RoadMap/` · `src/features/helpers/validateRoadMapNodes.ts` · `messages/chess/course/`
**Волна:** 3

## Что должно заработать

В конструкторе road-map (курса) в меню узлов есть отдельный блок «Шахматы» со своей иконкой — как «Аудио», «Медиа», «Файл». Репетитор ставит его в граф и выбирает режим: «Задача» (позиция + решение ходами, ученик решает на доске) или «Разбор» (позиция + ходы с комментариями, ученик листает). Ученик, проходя курс, видит узел с доской прямо в road-map, решает/листает; решённая задача отмечает узел пройденным так же, как другие интерактивные узлы.

## Из брифа, дословно

> «В наших road-map не вижу спец-блока для шахмат»
> «Чтоб можно было создавать курсы по шахматам»

## Критерии приёмки

- [ ] Новый `RoadMapBlockType.CHESS` (имя — по соседям) добавлен во ВСЕ места, где перечисляются типы узлов: реестр `src/features/Roadmap/registry.tsx`, задача узла в `src/features/Roadmap/tasks/`, меню/навбар конструктора, контент узла (`useNodeContent`), paywall, оглавление (`roadmapOutline.ts`, `RoadmapOutlineDropdown`), валидация (`validateRoadMapNodes`) — найди все по `INFO_AUDIO` в road-map-коде (enum `RoadMapBlockType`, не `TaskBlockType`).
- [ ] Данные узла: `{mode: 'puzzle'|'study', fen, solution?: string[] /*UCI*/, moves?: {uci, comment?}[], prompt?}` в `RoadNodeData` (поле — по паттерну соседей). Редактор и плеер — ПЕРЕИСПОЛЬЗУЙ готовые `ChessPuzzleEditor/ChessStudyEditor/ChessPuzzleStudent/ChessStudyStudent` из `src/widgets/Tasks/BlockEditor/ChessEditor/` и логику `@/shared/lib/chess/puzzle` (не копировать). Если редакторы завязаны на `updateBlockPayload` теста — добавь им проп `onChange(payload)` минимальным диффом, существующее поведение не меняется.
- [ ] Валидация при сохранении курса: FEN валиден (`fenError`), решение/ходы легальны (`lineToSan`), как в блоках теста.
- [ ] Прохождение: решённая задача (`scorePuzzle`) отмечает узел как пройденный тем же механизмом прогресса, что у других интерактивных узлов (найди, как отмечается `ACTIVE_TEST`); разбор — информационный, как `INFO_*`.
- [ ] Строки — `messages/chess/course/` во всех 4 локалях (или паттерн соседей, если узлы road-map подписываются иначе — опиши).
- [ ] Проверено в браузере как репетитор (teacher@seed.dev, сид-аккаунт localhost): создать курс-черновик с узлом «Шахматы» в обоих режимах, открыть как ученик. Если сохранить курс нельзя без публикации — опиши, что проверено. Скриншоты `.autopilot/chess/shots/10-*`.
- [ ] tsc/eslint чисто.
