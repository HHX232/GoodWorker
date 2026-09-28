# Интерфейсы — курс «Русский язык»

Проверено чтением реального кода (не придумано). Каждый тикет читает этот файл
целиком до первой строчки кода. Если по ходу тикета контракт не бьётся с реальностью —
править этот файл + класть строку `D##` с тем, что показал код, а не молча обходить.

## 1. Где что лежит

- `prisma/seed.ts` — существующее дерево категорий (`CategoryNode`, ru/en/hi/zh),
  ветка `russian` со слагами `orthography`/`morphology`/`syntax`/`punctuation` и т.д.
  **Не редактировать этот файл** — категории первой волны добавляются отдельным
  скриптом `prisma/seedRussianCourse0N<Block>.ts` (по одному на тикет), который сам
  апсертит недостающие `Category` через `prisma.category.upsert` по `slug`
  (существующие 2–4 листа блока не трогает, только добавляет новые сиблинги).
- `prisma/seedposts.ts` — образец формы `Post.content` (см. §3).
- `src/shared/types/Post/Post.type.ts` — `PostBlockType`, все payload-типы блоков поста.
- `src/shared/types/Tasks/TaskType.type.ts` — `TaskBlockType` (11 типов блоков теста).
- `src/features/Tasks/TaskObjects/*.tsx` — `defaultPayload`/форма каждого типа блока
  теста (`ChooseOptionTask.tsx`, `FillTextTask.tsx`, `MatchPairsTask.tsx`,
  `HighlightTextTask.tsx`, `SequenceTask.tsx`, `WordScrambleTask.tsx`,
  `FreeAnswerTask.tsx` и т.д.) — читать перед тем, как писать блок этого типа.
- `src/shared/s3/s3Client.ts` — `s3`, `S3_BUCKET`, `publicUrlForKey(key)`.
- `app/api/upload/route.ts` — образец: как оттуда берётся `key` (см. §4), но сам роут
  не вызывается (нет браузерной сессии в Node-скрипте).
- `package.json` — `pdf-lib` уже зависимость, новую библиотеку под PDF не ставить.

## 2. Категории (Prisma `Category`)

```ts
model Category — id, slug (unique), levelNumber, parentId
model CategoryTranslation — categoryId, langCode, name
```

Паттерн апсерта на тикет (пример для одной новой листовой темы):

```ts
const parent = await prisma.category.findUniqueOrThrow({where: {slug: 'orthography'}})
const cat = await prisma.category.upsert({
  where: {slug: 'unstressed-vowels-root'},
  create: {slug: 'unstressed-vowels-root', levelNumber: 3, parentId: parent.id},
  update: {}
})
for (const [langCode, name] of Object.entries({
  ru: 'Безударные гласные в корне', en: 'Unstressed Vowels in the Root',
  hi: 'मूल में अस्वरित स्वर', zh: '词根中的非重读元音'
})) {
  await prisma.categoryTranslation.upsert({
    where: {categoryId_langCode: {categoryId: cat.id, langCode}},
    create: {categoryId: cat.id, langCode, name}, update: {name}
  })
}
```

(Проверить точное имя составного unique-индекса `CategoryTranslation` в
`prisma/schema.prisma` перед использованием — выше это ожидаемая форма по конвенции
Prisma `@@unique([categoryId, langCode])`, не переписанная один-в-один из схемы.)

## 3. Посты (`Post.content`)

Форма (см. `prisma/seedposts.ts:38-64`):

```ts
type PostBlock = {id: string; type: PostBlockType; payload: unknown}
// TEXT
{id, type: 'TEXT', payload: {content: {type: 'doc', content: [{type: 'paragraph', content: [{text, type: 'text'}]}]}}}
// MEDIA (обложка темы)
{id, type: 'MEDIA', payload: {kind: 'image', url, caption: string | null}}
// TEST_LINK (оба теста темы — один блок, tests: массив)
{id, type: 'TEST_LINK', payload: {tests: [{id: testId, title: testTitle}, ...]}}
// FILE_LIST (шпаргалка темы)
{id, type: 'FILE_LIST', payload: {files: [{name, size, mimeType: 'application/pdf', url}]}}
```

`Post.mediaUrls` — плоский массив URL всех `MEDIA`-блоков (см. `extractMediaUrls` в
`seedposts.ts`), заполнять так же.
`Post.teacherId` — id репетитора с `email: 'teacher@seed.dev'` (лукап, не хардкод —
паттерн `prisma/seedContent.ts:291`, `prisma/seedErrors.ts:131`).
`Post.categoryId` — id листовой темы.

## 4. Файлы и изображения (S3, напрямую из Node)

```ts
import {PutObjectCommand} from '@aws-sdk/client-s3'
import {randomUUID} from 'crypto'
import {s3, S3_BUCKET, publicUrlForKey} from '@/shared/s3/s3Client'

async function uploadBuffer(buffer: Buffer, folder: string, ext: string, teacherId: string) {
  const key = `${folder}/${teacherId}/${randomUUID()}.${ext}`
  await s3.send(new PutObjectCommand({Bucket: S3_BUCKET, Key: key, Body: buffer}))
  return publicUrlForKey(key)
}
```

Требует те же переменные окружения, что и остальной upload-пайплайн
(`S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`,
`NEXT_PUBLIC_S3_PUBLIC_URL`) — проверить, что `.env` их содержит, до первого вызова;
если нет — `BLOCKED`, не выдумывать значения.

Папки: `russian-course-images/...` для обложек тем, `russian-course-cheatsheets/...`
для PDF.

## 5. Изображения — `velsvisual`

Ключ уже настроен (`~/.velsvisual/config.json`), заново не спрашивать и не просить у
пользователя. Перед первой генерацией в тикете:

```bash
velsvisual models --refresh --json                      # раз на весь прогон, не на тикет
velsvisual recommend image --refresh                    # подобрать актуальную image-модель
velsvisual run <модель> --prompt "..." --download ./tmp/covers --wait
```

Промпт — иллюстративная обложка темы (книги/тетради/доска/абстрактная композиция на
тему письма), **не** точная схема правила с текстом на изображении — генеративная
модель ненадёжно кладёт русский текст на картинку (см. риск, поднятый в диалоге).
Схемы/деревья (например, виды придаточных) — если нужны — рисовать через `pdf-lib`
текстом/линиями в самой PDF-шпаргалке, не через генерацию изображения.

## 6. PDF-шпаргалки — `pdf-lib` + `@pdf-lib/fontkit`

Один текстовый поток (заголовок темы + список правил/примеров), формат A4.
Standard14-шрифты `pdf-lib` (`StandardFonts.Helvetica` и т.п.) — латиница-only, для
кириллицы нужен встроенный TTF через `fontkit`. Решено и поставлено
(`@pdf-lib/fontkit`, подтверждено пользователем) — шрифт берём готовый из
репозитория, новый не тащим:

```ts
import {PDFDocument, rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs/promises'

const pdfDoc = await PDFDocument.create()
pdfDoc.registerFontkit(fontkit)
const fontBytes = await fs.readFile('public/fonts/Roboto-Regular.ttf')
const boldBytes = await fs.readFile('public/fonts/Roboto-Bold.ttf')
const font = await pdfDoc.embedFont(fontBytes)
const bold = await pdfDoc.embedFont(boldBytes)
const page = pdfDoc.addPage([595.28, 841.89]) // A4 pt
page.drawText('Заголовок', {x: 50, y: 780, size: 20, font: bold, color: rgb(0.04, 0.04, 0.04)})
// ... правила построчно через page.drawText с font (обычный вес)
const bytes = await pdfDoc.save()
```

Схемы/деревья (например, виды придаточных) — если нужны — рисовать через
`page.drawLine`/`drawRectangle`/`drawText` в той же PDF, не через генерацию картинки
(генеративная модель ненадёжно кладёт русский текст на изображение, см. §5).

## 7. Тесты (`Test.content`)

```ts
type TestContent = {description: string; blocks: TestBlock[]}
type TestBlock = {id: string; type: TaskBlockType; payload: unknown}
```

`payload` каждого `type` — из `TaskUserBlockRegistry[type].defaultPayload` в
`src/features/Tasks/TaskRegistry.tsx`, форма конкретного типа — в соответствующем
`src/features/Tasks/TaskObjects/<Type>Task.tsx`. Читать перед использованием, не
угадывать по названию типа.
`TestCategory` — связка `testId` + `categoryId` (той же листовой темы).

## 9. Уроки тикета 01 (обязательны для тикетов 02–04)

- **Модель изображений** — `google/nano-banana` (рекомендована `velsvisual recommend
  image --refresh`), с явным `--set output_format=jpeg` (по умолчанию модель отдаёт
  `png`, а загрузчик кладёт файл с расширением `.jpg`). `nano-banana-2` в живом
  каталоге не существует, не использовать.
- **Глиф стрелки `→`/`←` отсутствует в `public/fonts/Roboto-Regular.ttf`** —
  `pdf-lib`/`fontkit` молча превращает его в пустоту (не крэш, невидимый пробел).
  В строках, которые идут в PDF через `page.drawText` (шпаргалки), использовать ASCII
  `->`/`<-` или переформулировать без стрелки. В тексте постов (рендерится в браузере,
  не через `pdf-lib`) обычные `→`/`←` — можно, отображаются нормально. Перед
  использованием любого небуквенного юникод-символа в PDF — проверить
  `font.hasGlyphForCodePoint(codePoint)`.
- **Идемпотентность — на уровне темы, не только поста.** Проверка «пост уже
  существует → пропустить тему» недостаточна: если прошлый прогон упал между
  созданием тестов и созданием поста, повторный запуск задублирует тесты. Нужна
  `findOrCreateTest()` (ищет `Test` по `teacherId`+`title` в категории перед
  `create`), и создание поста — последний шаг темы, после того как оба теста
  гарантированно существуют (найдены или созданы).
- **Не оставлять внешние вызовы (генерация картинки, upload) в фоне.** Оба падения
  тикета 01 были из-за того, что медленный шаг (скорее всего `velsvisual run`)
  остался «подвешен» вне видимости управляющего процесса. Каждый внешний вызов —
  синхронно, дождаться реального завершения, прежде чем переходить к следующему шагу.

## 8. Что уже сделал тикет 01 (заполняется по ходу сборки)

### Тикет 01

Скрипт `prisma/seedRussianCourse01Orthography.ts` дописан и прогнан на локальной dev-БД
(`postgresql://nikitatisevic@localhost/goodworker`). Все 8 тем блока «Орфография»
завершены: по 1 посту + 2 теста (короткий/большой) на тему, у каждого поста —
`TEXT` + `MEDIA` (обложка) + `TEST_LINK` (оба теста) + `FILE_LIST` (PDF-шпаргалка).
Плюс 1 сводный PDF блока. Verified напрямую через `psql` и HTTP-проверку каждого
URL (`curl -o /dev/null -w '%{http_code} %{size_download}'`) — все 17 файлов (8 обложек
+ 8 шпаргалок + 1 сводный PDF) отдают `200` с размером, совпадающим с тем, что записано
в `Post.content`.

Категории (`slug` — `Category.id`):
- `spelling-words` — `ab5831c8-85a2-444a-8050-9fe17f7df854` (уже существовала)
- `prefixes-suffixes` — `4ba95964-6481-4db3-8ee0-2cd795fb55c5` (уже существовала)
- `unstressed-vowels-root` — `4391a799-bf16-40bd-a683-e7b48ea38361` (новая)
- `hard-soft-signs` — `951921e6-77a5-4ac7-97e9-74defda035d5` (новая)
- `ne-ni-spelling` — `a8ff7275-128e-4bac-867d-bf5244533a0f` (новая)
- `n-nn-spelling` — `cbec041d-d8f8-4c10-9125-a790302082b7` (новая)
- `hyphenation-rules` — `b42a9edb-a9d3-415a-beb7-1b63ad69992f` (новая)
- `endings-spelling` — `18afc603-a381-498c-b492-811853cb3e9c` (новая)

Изображения — `velsvisual`, модель `google/nano-banana` (см. отклонение D01 ниже),
`aspect_ratio=4:3`, `output_format=jpeg`. Все 8 обложек сгенерированы и загружены
в `russian-course-cheatsheets`/`russian-course-images` через прямой `PutObjectCommand`
(не через `/api/upload`).

Cyrillic-проверка PDF: открыт через `pdfjs-dist` (`legacy/build/pdf.mjs`) — текст
извлекается корректно, кириллица не превращается в кракозябры (проверено на нескольких
шпаргалках + сводном PDF).

**Отклонения от плана:**
- **D01 — `IMAGE_MODEL`.** В скрипте, унаследованном от прерванного прогона, был указан
  `'nano-banana-2'` — такой модели нет в живом каталоге `velsvisual models --refresh --json`
  (69 моделей, ни одной с этим id). Заменено на `google/nano-banana` (рекомендованная
  `velsvisual recommend image --refresh`, максимальное качество). Добавлен явный
  `--set output_format=jpeg` (модель по умолчанию отдаёт `png`, а скрипт грузит с
  расширением `.jpg`/`Content-Type: image/jpeg`).
- **D02 — глиф `→`/`←` отсутствует в `Roboto-Regular.ttf`** (проверено через
  `@pdf-lib/fontkit`: `font.hasGlyphForCodePoint(0x2192) === false`). В PDF-шпаргалках
  (`cheatSheetLines`, рендерятся через `pdf-lib`) символ молча заменялся на пустоту
  (не крэш, но невидимый пробел — «Вода → воды» превращалось в «Вода   воды»). Заменено
  на ASCII `->` в 5 строках `cheatSheetLines` (`unstressed-vowels-root`, `n-nn-spelling`×3,
  `endings-spelling`×2, переформулировано без стрелки). В тексте постов (`explanation`,
  рендерится в браузере, не через `pdf-lib`) стрелки не трогались — там `→`/`←`
  отображаются нормально. Топик `unstressed-vowels-root` был уже сгенерирован прошлым
  прогоном с багом (пост уже существовал, поэтому идемпотентный скрипт его пропускал) —
  шпаргалка перегенерирована отдельным разовым патчем (не частью коммита) и перелита
  в S3: новый URL
  `https://ec2d0826-ed65-4e17-9296-2eb821c2e6bb.srvstatic.kz/russian-course-cheatsheets/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/f47d8fbc-ad8f-40bd-9f62-18f2e6e6e3a0.pdf`
  записан в `Post.content` (`FILE_LIST`) поста `2b05adff-6ed8-406f-8fd8-8378f727df3b`,
  проверено извлечением текста через `pdfjs-dist` — стрелка теперь рендерится как `->`.
  Старый файл в S3 остался, не удалялся — не критично.
- **D03 — идемпотентность тестов.** Унаследованный скрипт проверял только существование
  `Post` перед созданием темы; если прошлый прогон падал между созданием тестов и созданием
  поста (как оказалось, произошло для `ne-ni-spelling`/`n-nn-spelling`), повторный запуск
  создавал бы тесты-дубли. Добавлена `findOrCreateTest()` (ищет `Test` по `teacherId`+`title`
  в пределах категории перед `create`) — тема теперь идемпотентна на уровне
  «пост ИЛИ тесты» уже существуют, не только «пост существует». Два тестовых
  ряда-сироты `ne-ni-spelling`, созданных прошлым прогоном без поста, удалены вручную
  через `psql` перед финальным прогоном; тесты `n-nn-spelling` (тоже без поста, но с
  правильными заголовками/блоками) переиспользованы, не пересозданы.

Итоговый прогон (после фиксов) обработал только недостающее: `n-nn-spelling` (тесты
переиспользованы, досоздан пост+шпаргалка+обложка), `hyphenation-rules`,
`endings-spelling` — оба темы полностью с нуля. Остальные 5 тем были пропущены как уже
готовые (`= пропуск темы ... — пост уже существует`).

### Тикет 02

Скрипт `prisma/seedRussianCourse02Morphology.ts` написан полностью (все 10 тем блока
«Морфология», включая MATCH_PAIRS/HIGHLIGHT_TEXT-хелперы, идемпотентный по образцу
тикета 01 — `findOrCreateTest()` на уровне темы). Прогнан один раз на локальной dev-БД
(`postgresql://nikitatisevic@localhost/goodworker`) через `npx tsx
prisma/seedRussianCourse02Morphology.ts`.

**Статус: BLOCKED на генерации изображений** — у аккаунта `velsvisual`/KIE API кончились
кредиты (`velsvisual credits` -> `1.01 кредитов`, `google/nano-banana` стоит 4
кредита/изображение, см. `velsvisual pricing --search nano-banana`). Прогон упал на
шаге генерации обложки для `adjective-morphology` с `Ошибка KIE API (code=402): Credits
insufficient`. Это внешняя зависимость вне контроля скрипта — пополнить баланс
самостоятельно нельзя, поэтому по конвенции CLAUDE.md («Недостающую зависимость не
ставим — возвращаем BLOCKED») тикет остановлен на этом месте, а не завершён с
заглушками/фейковыми URL.

**Что реально создано в БД (проверено `psql` + `curl` + `pdfjs-dist`):**

Категории (`slug` — `Category.id`; всего 10, из них 2 существовали до тикета):
- `parts-of-speech` — `8ea463f0-919e-4b07-a296-5e173f3a7810` (уже существовала)
- `participles-gerunds` — `a35ccefe-ef8c-4eba-9a4e-908af4050fbd` (уже существовала)
- `noun-morphology` — `be5bb64f-4d20-4bee-ba98-2d068aa58ca8` (новая)
- `adjective-morphology` — `b4c6a361-3d3a-4448-b7a1-a9f9cf8cb43c` (новая)
- `verb-morphology` — `f3d201ff-1a45-4818-9cc0-f4b5a3912a56` (новая)
- `pronoun-morphology` — `3fb4d296-b09b-4b03-a5f7-7532bab64998` (новая)
- `numeral-morphology` — `25b5c86d-0228-4d63-b011-e65c651788e0` (новая)
- `adverb-morphology` — `f442186a-bfd3-46e8-bad5-46f821b79600` (новая)
- `function-words` — `82dc5303-86d1-400e-87fe-14ebb83fec60` (новая)
- `interjections` — `5cb8f31a-8ed7-488e-8258-4a17516e8d51` (новая)

Все 10 категорий получили `CategoryTranslation` в ru/en/hi/zh (переводы по смыслу, не
копия русского текста) — этот шаг кредитов не требует и выполнен полностью для всех
10 тем.

Темы, доведённые до конца (пост + оба теста + шпаргалка + обложка, все связи
TEST_LINK/FILE_LIST/MEDIA в посте):
1. `parts-of-speech` — пост `b402d83d-0195-40d5-9940-f730e1bcf110`; короткий тест
   (MATCH_PAIRS, 6 блоков) `f18d7c78-5ca3-49b2-af48-6f36cbc89194`; большой тест (14
   блоков) `784960dd-dab0-4c67-80d6-cb2da3dd1ff6`; шпаргалка
   `.../russian-course-cheatsheets/.../8d20fe3b-bfb8-4525-be5f-ac34b88503ed.pdf`;
   обложка `.../russian-course-images/.../e374277b-7f2e-43a3-9b4a-91052ffa9a32.jpg`.
2. `participles-gerunds` — пост `7984e7be-de7a-4048-8461-dab9602d2abf`; короткий тест
   (CHOOSE_OPTION, 6 блоков) `698babeb-68e7-45a4-b14f-6e0752b70b23`; большой тест (14
   блоков) `38dd3197-3443-4e6d-8ae0-c5e040a10186`; шпаргалка
   `.../russian-course-cheatsheets/.../d732da4c-698d-4f3e-8baf-d8669fe6d8a2.pdf`;
   обложка `.../russian-course-images/.../9a3d4637-059b-424a-b6cf-c4c6b0594fa3.jpg`.
3. `noun-morphology` — пост `9fa96b9e-c18b-4f31-9849-d624268fa4ef`; короткий тест
   (FILL_TEXT, 6 блоков) `6aa82983-70ed-4fbc-8512-1c31c66552e4`; большой тест (14
   блоков) `2022b330-0ec1-4b33-823f-542f3827964f`; шпаргалка
   `.../russian-course-cheatsheets/.../d4c8d876-a723-42a6-8e93-7dc61c7ddd87.pdf`;
   обложка `.../russian-course-images/.../d4149d40-e7e5-45d4-bc5e-88d986de52d9.jpg`.

Тема с частичным прогрессом (тесты и шпаргалка созданы, пост и обложка — нет,
т.к. скрипт падает на генерации обложки до создания поста): `adjective-morphology` —
короткий тест (CHOOSE_OPTION, 6 блоков) `8594ddbb-e27c-4e7a-82cf-97729fc13660`; большой
тест (14 блоков) `4ed80a19-725d-4a18-8d0c-76f25d8b1ddd`; шпаргалка
`.../russian-course-cheatsheets/.../b893e123-9f68-4b36-8502-36d8234db8c7.pdf`. При
повторном запуске `findOrCreateTest()` переиспользует эти тесты (не задублирует),
скрипт досоздаст только обложку и пост.

Темы, не начатые вовсе (категория + переводы созданы, постов/тестов нет): `verb-morphology`,
`pronoun-morphology`, `numeral-morphology`, `adverb-morphology`, `function-words`,
`interjections`. Сводный PDF блока «Морфология» тоже не создан (шаг идёт после цикла по
темам).

**Верификация выполненного:**
- DB: `psql` — подсчёт `Post`/`Test` per категория (`select c.slug, count(distinct p.id),
  count(distinct t.id) ... group by c.slug`) подтвердил ровно 1 пост / 2 теста у трёх
  завершённых тем, 0 постов / 2 теста у `adjective-morphology`, 0/0 у остальных шести.
- HTTP: `curl -o /dev/null -w '%{http_code} %{size_download}'` по всем 7 загруженным
  файлам (3 обложки + 4 шпаргалки, включая шпаргалку сироту `adjective-morphology`) —
  все `200` с ненулевым размером.
- Cyrillic PDF: все 4 шпаргалки открыты через `pdfjs-dist` (`legacy/build/pdf.mjs`),
  текст первой страницы извлечён и читаем без искажений (кириллица не превращается в
  кракозябры) — вручную сверено с ожидаемым текстом каждой шпаргалки.

**Типы блоков тестов по темам (10 из 10 распределены по спецификации тикета):**
`parts-of-speech` → MATCH_PAIRS, `participles-gerunds` → CHOOSE_OPTION,
`noun-morphology` → FILL_TEXT, `adjective-morphology` → CHOOSE_OPTION, `verb-morphology`
→ FILL_TEXT (контент готов в скрипте, в БД ещё нет), `pronoun-morphology` → MATCH_PAIRS
(готов в скрипте), `numeral-morphology` → FILL_TEXT (готов в скрипте, включая
многогапповый блок для составного числительного «тремястами двадцатью тремя»),
`adverb-morphology` → CHOOSE_OPTION (готов в скрипте), `function-words` →
HIGHLIGHT_TEXT (готов в скрипте, включая новый хелпер `highlightTextBlock()` — payload
`{instruction, tokens:{id,text,isCorrect}[]}`, проверено по `TaskPayload.type.ts:52-61`
и `scoreBlock.tsx:120`), `interjections` → CHOOSE_OPTION (готов в скрипте).

**Отклонения от плана:**
- **D04 — BLOCKED на кредитах KIE API**, см. выше. Не отклонение от контракта, а
  внешний блокер, который сам исполнитель разрешить не может (пополнение баланса —
  вне зоны доступа скрипта/агента).
- Никаких других отклонений от `interfaces.md`/`tickets/02-morphology.md` — типы блоков
  тестов, структура постов, папки S3, модель `google/nano-banana` с явным
  `output_format=jpeg`, идемпотентность на уровне темы (`findOrCreateTest`) — всё как в
  тикете 01.

**Как продолжить:** после пополнения баланса `velsvisual` (или переключения на другую
image-модель через `velsvisual recommend image --refresh`, если `google/nano-banana`
перестанет быть рекомендованной) — просто перезапустить `npx tsx
prisma/seedRussianCourse02Morphology.ts`. Скрипт идемпотентен: 3 готовые темы будут
пропущены (`= пропуск темы ... — пост уже существует`), `adjective-morphology`
переиспользует существующие тесты и допишет обложку+пост, остальные 6 тем и сводный
PDF будут созданы с нуля.

### Тикет 04

Скрипт `prisma/seedRussianCourse04Punctuation.ts` написан полностью (все 7 тем блока
«Пунктуация», обе категории-новеллы с переводами, PDF-шпаргалки, HIGHLIGHT_TEXT/
CHOOSE_OPTION/FILL_TEXT/SEQUENCE-тесты по контрактам тикета, сводный PDF блока) и
прогнан на локальной dev-БД (`postgresql://nikitatisevic@localhost/goodworker`).
**Прогон остановлен внешним блокером после первой темы** — см. «Отклонения» ниже;
DB-состояние и верификация зафиксированы как есть на момент остановки, дострой —
однокомандный повторный запуск скрипта после пополнения кредитов (идемпотентность
проверена: категории — upsert по slug, тесты — `findOrCreateTest` по teacherId+title
в категории, пост — по teacherId+categoryId+title).

Категории (`slug` — `Category.id`):
- `commas` — `2dbc48eb-7063-495f-ad9f-ce93142d51e3` (уже существовала)
- `colon` — `af222866-8d56-418b-a489-c1d2c9654096` (уже существовала)
- `dash` — `eaf0fe41-f00f-4cca-8ea2-290b12ec9823` (уже существовала)
- `quotation-marks` — `49812818-598b-427e-8af0-eb4d14419648` (уже существовала)
- `comma-isolation` — `16f01385-b544-4daa-89f2-039053dd8efa` (новая, создана этим прогоном)
- `complex-sentence-punctuation` — `a3b45dbb-8a96-4e21-8780-2a749a322ccc` (новая, создана этим прогоном)
- `introductory-punctuation` — `1741ab13-3ecd-4988-9017-2aabc73e14d6` (новая, создана этим прогоном)

Тема `commas` — единственная, дошедшая до генерации: 2 теста (6 + 12 блоков
`HIGHLIGHT_TEXT`, id `510e1e39-102d-463f-83a9-c768f3326254` /
`e77a38e5-fd26-4f40-83d2-7e2bafa1f1e7`, оба связаны `TestCategory` с `commas`) и 1
PDF-шпаргалка (`russian-course-cheatsheets`, см. ссылку ниже) реально созданы в БД/S3.
Пост для `commas` НЕ создан — скрипт упал на шаге генерации обложки (после тестов и
шпаргалки, перед постом), как раз тот сценарий, для которого рассчитана
`findOrCreateTest`: повторный прогон переиспользует оба существующих теста этой темы,
не задублирует их, и досоздаст только пост+шпаргалку(перегенерирует, не критично)+обложку.
Темы 2–7 (`colon`, `dash`, `quotation-marks`, `comma-isolation`,
`complex-sentence-punctuation`, `introductory-punctuation`) и сводный PDF блока —
**не запускались вовсе** (скрипт останавливается на первом внешнем вызове, который
падает, до перехода к следующей теме) — 0 постов в БД для всего поддерева `punctuation`
на момент остановки (проверено `psql`).

**Отклонения от плана:**
- **D04 — блокер: на `velsvisual`/KIE-аккаунте недостаточно кредитов для генерации
  обложек.** `velsvisual run google/nano-banana ...` вернул `Ошибка KIE API (code=402):
  Credits insufficient`. Проверено `velsvisual credits` — баланс `1.01`; проверено
  `velsvisual pricing --category image` — самая дешёвая доступная image-модель в живом
  прайсе стоит `4` кредита за изображение (`google/nano-banana`, `google/nano-banana-edit`,
  `google/imagen4-fast`, `gpt-image/1.5-*` и т.д. — минимум по всему каталогу), на 7
  обложек нужно ≥28 кредитов. Это исчерпание общего аккаунта (used up by parallel runs), а
  не отсутствие модели/конфигурации — ключ настроен и работает (сама генерация ушла в API,
  API вернул именно billing-ошибку, не auth/config). Не пытался подставить
  плейсхолдер/другую генерацию картинок в обход `velsvisual` — интерфейс/спецификация не
  разрешают других источников изображений, а спекулятивный воркэраунд без обложки нарушил
  бы контракт поста (`MEDIA`-блок обязателен по `spec.md`). **Возвращаю `BLOCKED`** на
  генерации обложек — как только баланс `velsvisual credits` пополнен, `npx tsx
  prisma/seedRussianCourse04Punctuation.ts` дописывает недостающее без ручного
  вмешательства (идемпотентно, тема `commas` продолжится с шага обложки, темы 2–7 —
  с нуля).

**Верифицировано на момент остановки** (полная верификация всех 7 тем — после
дозапуска, когда появятся кредиты):
- `psql`: 3 новые категории с переводами во всех 4 локалях (ru/en/hi/zh) — есть; 2 теста
  темы `commas` с правильными `TestCategory`-связками — есть; 0 постов во всём
  поддереве `punctuation` — подтверждено (пост создаётся последним шагом темы, ни одна
  тема его не достигла).
- HTTP: PDF-шпаргалка темы `commas` —
  `https://ec2d0826-ed65-4e17-9296-2eb821c2e6bb.srvstatic.kz/russian-course-cheatsheets/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/0e7a6956-381d-482f-b540-721c909a1012.pdf`
  — `200`, `564207` байт.
- Cyrillic-проверка: тот же PDF открыт через `pdfjs-dist` (`legacy/build/pdf.mjs`) —
  текст извлекается корректно, включая «ёлочки» `«»` и тире `—` (оба глифа
  дополнительно проверены через `font.embedder.font.hasGlyphForCodePoint` на
  `Roboto-Regular.ttf` — `true` для `«`/`»`/`—`/`–`/`„`/`“`/`…`, никаких замен на пустоту
  не требуется в этом тикете, в отличие от стрелок `→`/`←` из тикета 01).
- Код: TypeScript-паттерны (`BlockSpec`, `buildTestBlock`, идемпотентность) сверены со
  скриптом тикета 01 построчно; ad-hoc `tsc --noEmit` на изолированном файле даёт
  ожидаемые (не мои) ошибки Json-типизации Prisma/алиаса `@/entities/...` — тот же класс
  ошибок воспроизводится и на `seedRussianCourse01Orthography.ts` при том же способе
  проверки (несовпадение с реальным `tsconfig.json` проекта), не блокирует `tsx`
  (transpile-only, как и было задокументировано в §9 тикета 01).

**Дизайн блоков (для читателя тикета 05+/ревью):** типы теста распределены по темам
ровно как в `04-punctuation.md`: `commas`/`introductory-punctuation` → `HIGHLIGHT_TEXT`
(токенайзер скопирован дословно из `HighlightTextEditor.tsx`, тесты подсвечивают либо
слово ПЕРЕД нужной запятой, либо само вводное слово/обращение — в т.ч. с
пустым правильным ответом как «ловушкой» для омонимов кажется/однако/наконец и
одиночных союзов и/или); `colon`/`dash` → `CHOOSE_OPTION`; `quotation-marks`/
`comma-isolation` → `FILL_TEXT` (гэп — сам знак препинания: `,`/`«`/`»`, а не буква, как
в тикете 01, но тот же механизм `inputGap`, сверено по `scoreBlock.tsx`); `complex-sentence-punctuation`
→ `SEQUENCE` (один общий 6-шаговый алгоритм ССП/СПП/БСП + по одному 4-шаговому
разбору на каждое из 16 предложений-примеров, порядок шагов в массиве `items` — и есть
"правильный ответ" по `scoreBlock.tsx`). Тема `complex-sentence-punctuation` написана
самодостаточно (не ссылается на посты тикета 03 «Синтаксис» по контенту, только
упоминает их в тексте объяснения как соседний материал) — по требованию задания, т.к.
тикет 03 идёт параллельно и его посты могли не существовать на момент этого прогона.
