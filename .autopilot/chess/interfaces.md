# Что уже построено

Читается каждым исполнителем до начала работы. Не изобретай заново то, что здесь есть.
Спецификация целиком — `.autopilot/chess/spec.md` (читать раздел своего таска + «Дополнения после G2»).

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `chess/engine` (клиент, `src/shared/lib/chess/engine.ts`) | Web Worker Stockfish (`/stockfish/<файл>.js` из `public/`) | `getEngine(): ChessEngine` (синглтон, ленивый); `bestMove(fen, level: 1..8) → Promise<string /*uci*/>`; `analyse(fen, {multiPV, depth?, movetimeMs?}) → Promise<EngineLine[]>`; `stop()`; `ENGINE_LEVELS`; `EngineLine = {uci: string; pv: string[] /*uci*/; scoreCp: number\|null; mate: number\|null}` — оценка с точки зрения стороны, чья очередь хода; при сбое загрузки промисы отклоняются `Error('ENGINE_UNAVAILABLE')` | UCI-протокол, очередь команд, параметры уровней |
| `chess/coachModel` (чистый, `src/shared/lib/chess/coachModel.ts`) | классификация хода | `classifyMove(before: EngineLine[], afterBestForOpponent: EngineLine, playedUci: string) → MoveClass`; `MoveClass = 'best'\|'good'\|'inaccuracy'\|'mistake'\|'blunder'`; `cpLoss(before, after, playedUci) → number`; `toWhiteCp(line, turn: 'w'\|'b') → number` (мат → ±100000 − ply) | пороги (50/100/300) |
| `chess/board` (UI, `src/widgets/Chess/Board/`) | отрисовка и ввод | `<ChessBoard fen orientation:'w'\|'b' onMove?(m:{from,to,promotion?}) => boolean interactive? lastMove?:{from,to} arrows?:{from,to,color?}[] highlights?:Record<string,string> check?:string /*клетка короля*/ skinId? />`; `useChessSkin() → [SkinId, (id)=>void]` (`localStorage['gw-chess-skin']`, событие синхронизации между досками); `SKINS: SkinDef[]`; `SkinId = 'classic'\|'vintage'\|'night'\|'bordo'\|'powder'` | drag/click, анимация, пикер превращения |
| `chess/skins` (`src/widgets/Chess/skins/`) | наборы фигур | `SkinDef = {id: SkinId; labelKey: string; light: string; dark: string; coordLight: string; coordDark: string; frame?: string; pieces: Record<PieceCode, React.FC<{className?:string}>>}`; `PieceCode = 'wK'\|'wQ'\|'wR'\|'wB'\|'wN'\|'wP'\|'bK'\|…\|'bP'`; по файлу на скин: `classic.tsx`, `vintage.tsx`, `night.tsx`, `bordo.tsx`, `powder.tsx`; `index.ts` собирает `SKINS` | SVG |
| `chess/sound` (`src/shared/lib/chess/sound.ts`) | звуки | `playMoveSound(kind:'move'\|'capture'\|'check'\|'end')`, `useSoundEnabled() → [boolean, set]` (`localStorage['gw-chess-sound']`) | WebAudio |
| `chess/coach` клиент (`src/widgets/Chess/Coach/`) | связка движок→классификация→объяснение | `useMoveCoach() → { review(fenBefore, playedUci, context): Promise<MoveReview>, explain(review): Promise<ExplainResult> }`; `MoveReview = {classification: MoveClass; bestUci: string; bestSan: string; playedSan: string; pvUci: string[]; evalBeforeCp: number; evalAfterCp: number /*оба — с точки зрения белых*/; fenBefore: string}`; `ExplainResult = {ok:true,text} \| {ok:false, reason:'LIMIT', tier:'guest'\|'user'} \| {ok:false, reason:'UNAVAILABLE'\|'BAD_INPUT'}`; `<CoachPanel review? explain? onExplain? autoExplain? />` — карточка: класс хода, лучший ход, кнопка «Почему?», текст/лимит/ошибка; `<EvalBar cp mate orientation />` | вызовы движка, fetch |
| `api/chess/coach` | объяснения и лимиты | `POST /api/chess/coach` `{fen, playedUci, bestUci, pvUci: string[], classification, evalBeforeCp, evalAfterCp, context: 'game'\|'puzzle'\|'opening'\|'tactic'\|'engine-move', locale: 'ru'\|'en'\|'hi'\|'zh'}` → `200 {text}` · `429 {error:'LIMIT', tier:'guest'\|'user'}` · `400 {error:'BAD_INPUT'}` · `503 {error:'UNAVAILABLE'}` | промпт, факты chess.js, лимиты (гость 5/24ч по IP, user 100/24ч, VIP ∞) |
| `api/chess/puzzles` | задачи и рейтинг | `GET /api/chess/puzzles/next?theme=&opening=&minRating=&exclude=id,id` → `200 {puzzle: {id, fen, moves: string[] /*uci, moves[0] — ход соперника*/, rating, themes, openingTags}, profile: {puzzleRating, solved, failed} \| null}` · `404 {error:'NONE'}`; `POST /api/chess/puzzles/[id]/attempt {solved:boolean}` → `200 {profile}` · `401`; `GET /api/chess/progress` → `200 {profile, byTheme: Record<string, {solved:number}>}` · `401` | подбор (окно ±150 от рейтинга, гость — 1200), формула (Elo, K=32) |
| `chess/data` (`src/shared/lib/chess/data/`) | списки обучения | `OPENINGS: Opening[]` `{id, eco, nameKey, ideaKey, side:'w'\|'b', moves: string[] /*SAN*/, lichessTag: string}`; `TACTICS: Tactic[]` `{id /*тема Lichess*/, nameKey, descKey}` | — |
| звонок (`src/widgets/VideoRoom/`) | режим `chess` главного слота | сообщения по data channel: `call_chess_start`, `call_chess_state {fen, lastMove, moveAllowed:'all'\|'owner', seq}`, `call_chess_move {from,to,promotion?, seq}`, `call_chess_stop`; `GET /api/call/rooms?…` дополнительно отдаёт `subjectSlug: string\|null` | синк, права |
| конструктор тестов | блоки | `TaskBlockType.CHESS_PUZZLE {fen, solution: string[] /*uci, ход ученика первым*/, prompt?: string}`, `TaskBlockType.CHESS_STUDY {fen, moves: {uci, comment?}[]}` | редактор позиции |

Данные (Prisma, дописываются В КОНЕЦ `prisma/schema.prisma` одним блоком — файл содержит чужие незакоммиченные правки, их не трогать): `ChessPuzzle`, `ChessPuzzleAttempt`, `ChessProfile` — как в spec §6. Категория-предмет: `Category.slug = 'chess'`.

Швы для проверок: `npx tsx src/shared/lib/chess/coachModel.selfcheck.ts` → `coachModel ok`; `npx tsx src/shared/lib/chess/server/puzzleRating.selfcheck.ts` → `puzzleRating ok`; `npx tsx src/shared/lib/chess/server/coachInput.selfcheck.ts` → `coachInput ok`.

## i18n шахмат

Строки шахмат НЕ кладутся в `messages/{ru,en,hi,zh}.json` (там чужие незакоммиченные правки). Namespace `chess` собирается в `src/shared/i18n/request.ts` из файлов `messages/chess/<area>/<locale>.json`, area ∈ `core, play, learn, call, course` → `t('chess.<area>.<key>')`, т.е. `useTranslations('chess.play')`. Каждый таск пишет только свой area-файл (4 локали). Таск 01 создаёт проводку и пустые `{}` для всех area.

## Общие правила проекта

- Рабочая папка — `/Users/nikitatisevic/Desktop/GoodWorkerRemaster` (ветка main). В дереве много ЧУЖИХ незакоммиченных правок — не откатывать, не форматировать, не трогать файлы вне своей зоны. Особенно: `messages/*.json`, `prisma/schema.prisma` (только дописать свой блок в конец), `app/layout.tsx`.
- Next.js 16 (App Router), React 19, Prisma 6, TypeScript strict, SCSS-модули (тёмная тема в конце файла: `:global(html.theme-dark), :global(html.pomodoro-dark) { … }`), next-intl, иконки интерфейса — lucide-react (фигуры скинов — исключение, это иллюстрации). `chess.js` ^1.4 уже стоит.
- Прочитай `CLAUDE.md` (корень), раздел «GoodWorker — основное Next.js-приложение» — роль ADMIN = TEACHER, `getChatSessionUser()`-паттерн.
- ИИ — только DeepSeek через `src/lib/openrouter.ts` (`callAI`, `hasAIProvider`). Переменная — `DEEPSEEK_API_KEY` (только имя).
- Лимиты — `checkRateLimit(key, {max, windowMs})`, `getIp(req)` из `src/shared/api/rate-limit.ts`.
- Миграции: только ручной `prisma/migrations/<ts>_chess/migration.sql`. НИКОГДА `prisma migrate dev`, `db push`, `migrate reset`. Применять локально — только `set -a; source .env; set +a && npx prisma db execute --file <sql> --schema prisma/schema.prisma` + `npx prisma migrate resolve --applied <name>` + `npx prisma generate` (миграция чисто аддитивная).
- Проверки: `npx tsc --noEmit -p . 2>&1 | grep -E "chess|Chess|<твои файлы>" | head -30` (в дереве могут быть чужие ошибки — важны твои), `npx eslint <изменённые файлы>`, самопроверки `npx tsx …selfcheck.ts`. Тестового раннера нет. UI — проверь в браузере (`npm run dev`, порт смотри в логе) если таск про UI.
- Не добавляй зависимостей (кроме явно разрешённого в таске). Не хватает — верни `BLOCKED` с названием.
- Не коммить — коммитит оркестратор.
- Стиль: ponytail — минимальный дифф, переиспользование, без абстракций «на потом»; осознанные упрощения — комментарий `// ponytail: <потолок и путь апгрейда>`.
- Крафт UI — планка скилла `impeccable` (загрузи его, если таск про интерфейс). Никаких эмодзи в UI.

## Из таска 02 — сервер

- Таблицы `ChessPuzzle` / `ChessPuzzleAttempt` / `ChessProfile` (блок `// ─── Chess ───` в конце `schema.prisma`), миграция `prisma/migrations/20261016120000_chess/` применена локально.
- Категория `chess`: id `a91fdf2e-cf46-433e-a1d1-3edc4428a068` (levelNumber 1, 4 перевода) — в коде искать по `slug: 'chess'`, не по id.
- Импорт: `set -a; source .env; set +a && npx tsx prisma/importLichessPuzzles.ts` (идемпотентен). Локально 50 055 задач; темы: mateIn1 7114, mateIn2 5890, fork 5836, sacrifice 4284, pin 3174, discoveredAttack 2441, deflection 2133, hangingPiece 1932, attraction 1924, backRankMate 1803, mateIn3 1489, promotion 1283, skewer 1026, intermezzo 676.
- `theme=doubleAttack` в `next` = fork ИЛИ discoveredAttack; в `progress.byTheme` ключа `doubleAttack` нет (клиент суммирует сам).
- `next` вошедшему отдаёт профиль (по умолчанию 1200/0/0), гостю `profile: null`; уже решённые не исключаются сервером — клиент шлёт `exclude`.
- Рейтинг/счётчики меняет только ПЕРВАЯ попытка по задаче.
- Чистые: `validateCoachInput(body) → {ok:true,input,facts}|{ok:false}`, `buildCoachPrompt(input,facts)` (`src/shared/lib/chess/server/coachInput.ts`); `nextPuzzleRating(user,puzzle,solved)`, `ratingWindows(r)`, `GUEST_PUZZLE_RATING=1200` (`puzzleRating.ts`); `loadChessProfile(userId)` (`profile.ts`).
- `/api/chess/coach` отвечает `{text}`; модель отдаёт JSON (callAI шлёт json_object) — сервер разбирает.
- Сид-аккаунты локально все VIP — тариф «user» живьём не проверить без снятия VIP.

## Из таска 08 — прототипы Hero

- `ForNewDesign/prototypes/chess-hero-{a-live,b-gallery,c-explain}.html`, свитчер `<nav data-chess-switcher aria-label="Варианты Hero">` + `<a data-hero="a|b|c">`.
- Общий копирайт: H1 «Шахматы, которые объясняют каждый ход»; CTA «Играть с тренером» / «Решать задачи»; пункты «Движок 8 уровней», «ИИ-тренер объясняет ходы», «50 000 задач», «Доска в видеозвонке с репетитором». Партия в A — «Оперная партия» Морфи (1858), оценки в C — иллюстративные.
- Фигуры в прототипах — отдельный рисунок; при переносе выбранного Hero в прод фигуры брать из `src/widgets/Chess/skins/*`, не из прототипа.

## Из таска 01 — ядро

- `@/shared/lib/chess/engine`: `getEngine()`, `ENGINE_LEVELS`, `EngineLine`, `ChessEngine` (`bestMove`/`analyse`/`stop`); сбой → `Error('ENGINE_UNAVAILABLE')`. Файлы движка — `public/stockfish/stockfish-19-lite-single.{js,wasm}` (+ LICENSE/README), копирует `scripts/copy-stockfish.mjs` в `postinstall` (на проде без devDeps молча пропускает — файлы закоммичены).
- `@/shared/lib/chess/coachModel`: `classifyMove`, `cpLoss`, `toWhiteCp`, `MoveClass`.
- `@/shared/lib/chess/sound`: `playMoveSound(kind)` (сам проверяет выключатель), `useSoundEnabled()`.
- `@/widgets/Chess/Board`: `ChessBoard` (пропсы по контракту + `className`), `BoardMove`, `BoardArrow`, `useChessSkin`, `SKINS`, `getSkin`, `SkinDef`/`SkinId`/`PieceCode`. Скины — по файлу в `src/widgets/Chess/skins/`, регистрация в `skins/index.ts` (4 заглушки → классика), тип `SkinDef` в `skins/types.ts`.
- `@/widgets/Chess/Coach`: `useMoveCoach() → {review(fenBefore, playedUci, context='game'), explain(review)}`; `MoveReview` дополнительно несёт `playedUci`, `context`. `CoachPanel {review?, explain?: (r)=>Promise<ExplainResult>, onExplain?: (result)=>void, autoExplain?, analysing?, className?}`; `EvalBar {cp, mate?, orientation?, className?}` (тянется по высоте flex-ряда); `formatEval`.
- i18n: `useTranslations('chess.<area>')`; общие ключи — `messages/chess/core/*.json`.
- `/game/chess` сейчас — минимальная подмена (доска + движок + тренер, без тёмной темы и сохранения); целиком переделывает таск 04. На ней же рендерится `<ChessBoard>` со скином из `localStorage['gw-chess-skin']` — для скриншотов скинов.
- Строка-комментарий хода движка (R14, `context:'engine-move'`) НЕ сделана в ядре — это таск 04.
- ПОСЛЕ РЕВЬЮ (обязательно): `getEngine()` = `{bestMove, analyse, stop, cancelAll}`. `stop()` отклоняет текущее задание `ENGINE_CANCELLED` (очередь идёт дальше); `cancelAll()` отклоняет текущее и всю очередь, движок жив. Ошибки: `ENGINE_UNAVAILABLE` (навсегда), `ENGINE_CANCELLED`, `BAD_FEN` (до воркера), `NO_MOVE` (bestMove в законченной позиции). Очередь FIFO: на странице сначала `bestMove`, потом `review`. Новая партия / ход назад / смена задачи → `cancelAll()`.
- `classifyMove`/`cpLoss` бросают `NO_ANALYSIS`; после конца партии передавать `{mate:0}` (мат) или `{scoreCp:0}` (ничья). `useMoveCoach().review` отклоняется `NO_ANALYSIS`/`ENGINE_CANCELLED`/`ENGINE_UNAVAILABLE`/`BAD_FEN`.
- `ChessBoard.onMove?: (m: BoardMove) => void` — доска контролируемая: принять ход = передать новый `fen`; не менять `fen` = фигура уезжает назад.
- `CoachPanel` проп `noAnalysis?: boolean`. Паттерн вызова (JSDoc `useMoveCoach.review`, повторять ТОЧНО): перед ревью `setReview(null); setNoAnalysis(false); setAnalysing(true)` → `.then(setReview)` → `.catch(e => e.message !== 'ENGINE_CANCELLED' && (setReview(null), setNoAnalysis(true)))` → `.finally(() => setAnalysing(false))`; результаты устаревшего хода/партии отбрасывать счётчиком поколения. Эталон — `src/_pages/ChessGamePage/ChessGamePage.tsx`.
- `formatEval(±100000) = '#'`, мат в N = `M N` / `−M N`. `stockfish` закреплён `19.0.1`.

## Из таска 06 — доска в звонке

- `src/widgets/VideoRoom/CallChess/{chessSync.ts, CallChess.tsx}`; самопроверка `npx tsx src/widgets/VideoRoom/CallChess/chessSync.selfcheck.ts` → `chessSync ok`.
- Сообщения: `call_chess_start {fen,lastMove,moveAllowed,seq}` (полное состояние, и для старта, и для опоздавших), `call_chess_state {…}` (только владелец, seq растёт на любом изменении), `call_chess_move {from,to,promotion?,seq}` (seq — позиция, которую видел отправитель), `call_chess_stop {}`.
- `GET /api/call/rooms?name=|?id=` отдаёт `subjectSlug: string|null`. Повторная отдача главного слота новичку — общая `announceMainSlot()` в VideoCallPage.
- Модалка создания комнаты показывает учителю только его корневые категории — «Шахматы» видны, если предмет есть в профиле учителя.

## Из таска 04 — хаб и игра

- Маршруты: `/chess` (хаб), `/chess/play`; `/chess/play?fen=<FEN>[&color=w|b]` (цвет по умолчанию = сторона хода; невалидный FEN → обычное начало + инлайн-уведомление). `/game/chess` → 307 на `/chess/play`.
- localStorage: `gw-chess-game` = `{start, moves: SAN[], level, color, mode:'ai'|'duo', resigned}`, `gw-chess-evalbar`, `gw-chess-autoexplain` ('1'/'0', по умолчанию выкл).
- `src/_pages/Chess/Play/gameFacts.ts`: `engineMoveFacts(fenBefore, uci) → {san, facts: MoveFact[]}`, `endReason(chess, resigned)`; самопроверка `gameFacts ok`.
- На каждом ходе игрока `getEngine().cancelAll()` — устаревшее ревью отменяется, ответ движка не ждёт.
- Плитка «Курсы» → `/workflows-list?search=<«шахмат» локализованно>` (у каталога нет фильтра по категории).
- `src/_pages/ChessGamePage/` больше никем не импортируется (удалить не дали права).
- ИСПРАВЛЕНО после ревью 04: плитка «Курсы» → `/workflows-list?category=chess`; каталог и `GET /api/roadmap` принимают `?category=<Category.slug>` (`IRoadmapQuery.category`), без параметра — как раньше. Карточка «Шахматы» на /game → `/chess`. «Подробнее» к ходу движка — `review(fenBefore, uci, 'engine-move')` по клику. В `gw-chess-game` ещё `evalCp: number|null`.

## Из таска 07 — блоки в тестах/курсах

- `CHESS_PUZZLE {fen, solution: string[] /*UCI, первым ход ученика*/, prompt?}`, `CHESS_STUDY {fen, moves:{uci,comment?}[]}`; ответ ученика `{type: CHESS_PUZZLE, value:{done, mistakes}}`, балл 1 только при `done && mistakes===0`; CHESS_STUDY — инфо-блок.
- `@/shared/lib/chess/puzzle` (перенесено из features/Tasks/chess; самопроверка `npx tsx src/shared/lib/chess/puzzle.selfcheck.ts` → `puzzle ok`): `checkPuzzleMove(fen, solution, ply, uci) → {ok:false}|{ok:true, reply, done}` (любой матующий ход тоже засчитывается), `scorePuzzle`, `playUci`, `lineToSan`, `fenError`, `normalizeFen`, `checkSquare`, `START_FEN`; самопроверка `chessPuzzle ok`.
- Виджеты: `ChessPuzzleEditor`/`ChessStudyEditor({blockId,payload})`, `ChessPuzzleStudent({payload,onChange,disabled})`, `ChessStudyStudent({payload})` — `src/widgets/Tasks/BlockEditor/ChessEditor/`.
- Правило итога задачи (решебник и блок курса одинаково): первая ошибка или любая подсказка → не чисто (`solved:false` / 0 баллов).
- Для `context:'opening'` сервер НЕ использует classification и оценки (промпт объясняет идею книжного хода); клиент шлёт 'best'/0 только как заполнитель контракта. В других контекстах так делать нельзя — там только реальные данные ревью.

## Из таска 09 — стрелки, доска/фигуры отдельно, аватар

- `BoardArrow.opacity?: number` (по умолчанию 0.82; рисуются по возрастанию — слабые снизу). `ChessBoard` — `boardId?`/`piecesId?` вместо `skinId`.
- `useBoardTheme()` / `usePieceSet()` → `[SkinId, set]` из `@/widgets/Chess/Board` (`useChessSkin` удалён); `<SkinPicker/>` — два ряда свотчей. Ключи `gw-chess-board`, `gw-chess-pieces`; старый `gw-chess-skin` мигрирует один раз (`migrateSkinPref` в `localPref.ts`) и удаляется. Все фигуры — с тонкой обводкой в противоположном тоне (читаемость любой пары).
- `hintArrows(lines: EngineLine[]) → {from,to,opacity}[]` (`@/shared/lib/chess/hintArrows`, самопроверка `hintArrows ok`): до 3 линий, линии хуже лучшей >100 cp отбрасываются. `gw-chess-hints` ('1' по умолчанию).
- `CoachAvatar {mood?: 'idle'|'thinking'|'concerned', size?}`, `CoachSays {mood?, title?, children}` — `@/widgets/Chess/Coach`.

## Из таска 10 — шахматный узел road-map

- `RoadMapBlockType.CHESS = 'CHESS'`, данные `RoadNodeData.chess = {mode:'puzzle'|'study', fen, solution?, moves?, prompt?}`; редактор/плеер — переиспользуют ChessEditor (`onChange?` проп). Метки узлов — `roadMapLabel(label)` в registry.tsx (ключ с точкой — полный ключ).
- Прогресс: решённая задача → `useRoadmapProgress().markCompleted([nodeId])`; разбор — информационный (двойной клик, как INFO_*). Валидация — через `validateTestBlocks`; самопроверка `npx tsx src/features/helpers/validateRoadMapNodes.selfcheck.ts`.
- Решённая шахматная задача в road-map отмечает пройденным только свой узел (не предков, в отличие от двойного клика); задачу нельзя пройти двойным кликом или как предка.
- Осознанно: узел курса «Шахматы/задача» проходится решением, даже с ошибками (иначе узел запирается — перерешать нельзя). В тесте и решебнике ошибка = не засчитано.

## Волна 4–5 (2026-10-19)

- i18n: новые area `progress` (T11), `online` (T12), `storm` (T13), `tutor` (T15) подключены в `request.ts` таском 11; остальные таски пишут только свои файлы `messages/chess/<area>/`.
- Schema: каждый таск дописывает СВОЙ блок в самый конец `prisma/schema.prisma` (после блока Chess) и свою миграцию `prisma/migrations/<ts>_chess_<имя>/`. T11 раньше T12 — порядок блоков: Chess → Chess progress → Chess online.
- Спека этой волны — `spec.md`, раздел «Дополнения 2026-10-19».

## Из таска 11 — прогресс

- `ChessProfile` + `botPoints, streakCurrent, streakBest, lastActiveDay String?, rating(1200), ratingGames, stormBest3, stormBest5`; `ChessBadge {id, userId, code, earnedAt, @@unique([userId, code])}`. Миграция `20261019120000_chess_progress` применена локально.
- `recordChessActivity(userId, {kind:'bot'|'online'|'puzzle'|'storm', tzOffsetMin, botLevel?, result?:'win'|'draw'|'loss', plies?, score?}, now?) → {profile, newBadges, streakChanged}` (`src/shared/lib/chess/server/progress.ts`; чистое ядро `progressModel.ts`, самопроверка `progress ok`). `online` — только с сервера. `stormBest*` она НЕ пишет — это делает шторм.
- API: `POST /api/chess/activity` (bot|puzzle|storm) → `{profile,newBadges,streakChanged}` | 400/401/429 (120/ч); `GET /api/chess/profile/me` → `{player,profile}`; `GET /api/chess/profile/[userId]` → `{player:{id,name,avatarUrl,isTeacher},profile}` | 404.
- `@/widgets/Chess/Progress`: `<StreakFlame/>` (сам грузит /me), `<RatingChip label value sub?/>`, `<BadgeGrid earned/>`, `<BadgeMedal/>`, `<BadgeToast/>`, `useMyChessProgress()`, `useChessActivity() → report(input)` (+ тост), `useBotGameActivity(...)`, `todayLocal()`. StreakFlame ещё нигде не встроен — шапка/хаб это T13.
- Коды значков `BADGE_CODES`: `first_win_l1..l8`, `points_100/500/1000/2500/5000`, `streak_3/7/30/100`, `storm_10/20`, `online_first_win`. `VIP_REWARDS` (все null) — `progressModel.ts`; выдача VIP как `applyPromoCode` (vipExpiresAt + VipTransaction).
- Страницы `/chess/profile`, `/chess/u/[id]`. История партий на профиле — после T12 (онлайн-партии).

## Из таска 15 — шахматный репетитор

- Фильтр каталога — существующий `GET /api/teachers?categoryId=<id chess>` (CategorySelect). На `TeacherCard` чип «Шахматы» первым (`data-chess`).
- `<ChessTutorBlock teacherId/>` (`@/widgets/Chess/Tutor/ChessTutorBlock`) в публичном профиле репетитора при категории `chess`: RatingChip×2, огонёк, значки, «Сыграть со мной» → `POST /api/chess/games {timeControl:'10+0', opponentId}` → `/chess/game/{id}`, «Записаться» → `/users/[id]?openService=<sid>`.
- Сид: teacher@seed.dev теперь репетитор по шахматам с услугой «Шахматы: разбор партий».

## Из таска 12 — онлайн

- Модели `ChessGame` (whiteId?/blackId?/invitedId?, initialFen, moves UCI через пробел, timeControl 'M+I', whiteMs/blackMs, turnStartedAt, status waiting|active|finished|aborted, result, termination, rated, drawOfferBy w|b, rematchOf @unique, white/blackRating, white/blackDelta), `ChessSeek`. Миграция `20261019140000_chess_online` применена.
- Ядро `src/shared/lib/chess/server/online.ts` (самопроверка `online ok`), хранилище `onlineStore.ts`.
- API: `POST/DELETE /api/chess/seek` (POST — и опрос ждущего → `{gameId}|{waiting,window}`); `POST /api/chess/games {timeControl, color?, opponentId?}` → `{id}`; `GET /api/chess/games` → `{active, invites, recent}`, `?userId=` → `{recent}`; `GET /api/chess/games/[id]?since=ply` → `OnlineGameState`; `POST …/move {uci, ply}`, `…/join`, `…/resign`, `…/draw {action}`, `…/abort`, `…/rematch` → `{id}`; `GET /api/chess/players?q=` → `{players}`; ошибки 409 `{error, state}`.
- Страницы `/chess/online`, `/chess/game/[id]`; опрос 1 с / 1,5 с / 3 с только при видимой вкладке (`useVisiblePoll`). Первые 2 полухода без часов; без первого хода — отмена через 60 с. Все партии рейтинговые.

## Из таска 13 — модалки, боты, шторм

- `@/widgets/Chess/Settings`: `NewGameModal {open, onClose, tab?: 'bot'|'online'|'friend'|'duo', onBot(c: BotChoice), onDuo(), bot?, botDisabled?}` (`BotChoice = {botId, level, color, coach}`), `SettingsModal {open, onClose}`, `ChessDialog` (нативный `<dialog>`, на телефоне bottom-sheet), `BotAvatar {look, size?}`, `TIME_CONTROLS`.
- `ChessBoard` + `coords?`, `animate?` (по умолчанию из `gw-chess-coords`/`gw-chess-anim`); ключи `gw-chess-confirm`, `gw-chess-coords`, `gw-chess-anim`; в `gw-chess-game` + `botId`, `coach`. `/chess/play?new=bot&bot=<id>&color=w|b&coach=0|1` или `?new=duo`.
- Боты: `BOTS` (13: 8 по уровням + 5 спец), `getBot`, `levelBot`, `bookMove`, `botUnlocked(bot, badges|null)` в `@/shared/lib/chess/data`; строки `chess.play.bot_<id>*`.
- Шторм `/chess/storm`; `POST /api/chess/storm {mode:3|5, score, tzOffsetMin}` → `{best, record, profile, newBadges, streakChanged}`; чистая модель `stormModel.ts` (`storm ok`).

## Из таска 16 — разбор партии

- `reviewModel.ts`: `winPct`, `accuracy`, `reviewGame({initialFen, moves: UCI[], analyses: EngineLine[][]}) → GameReview {moves, accuracy{w,b}, counts{w,b}, keyMoments}` (бросает NO_ANALYSIS/BAD_MOVE), `loadGame({pgn}|{moves, initialFen?})`, `coachClass(cls)`, `REVIEW_CLASSES`, `KEY_CLASSES`, `ReviewClass`; самопроверка `review ok`.
- Передача партии: `sessionStorage[ANALYSIS_KEY='gw-chess-analysis']` = `AnalysisHandoff {pgn?, moves?, initialFen?, white?, black?, result?, source?: 'bot'|'online'|'duo'|'pgn'}`; маршрут `/chess/analysis[?game=<id>]`.
- `ChessBoard` + `squareBadges?: Record<square, ReactNode>`. Компоненты `@/widgets/Chess/Review`: `ClassIcon`, `CLASS_COLOR`, `AccuracyCard`, `EvalGraph`, `ReviewMoves`.
