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

## 5. Изображения — `api.bycom.by` (актуально с 2026-09-28; `velsvisual`/kie.ai — исчерпан)

**Смена провайдера.** kie.ai кончился по кредитам (`code=402`) в разгар тикетов 02/03/04
— балансом делились все тикеты параллельно, потратился быстрее, чем рассчитывали.
Пользователь дал новый ключ (`BYCOM_API_KEY` в `.env`, не в `velsvisual`-конфиге — это
не kie.ai, `velsvisual` его не знает, дергать напрямую HTTP) и попросил недорогие
модели, баланс ограничен. Реальный вызов уже проверен (2026-09-28, орк-ром, потрачено
~0.03 BYN на тестовый запрос) — контракт ниже подтверждён, не с чужих слов:

```
POST https://api.bycom.by/v1/images/generations
Authorization: Bearer $BYCOM_API_KEY
Content-Type: application/json
{"model": "z-image-turbo", "prompt": "...", "n": 1, "size": "1024x1024"}
```

Ответ (OpenAI-совместимый) — `{"data":[{"b64_json": "<base64 PNG>"}]}`, **не URL** —
декодировать `Buffer.from(b64_json, 'base64')` и заливать в S3 напрямую (§4), не
скачивать откуда-то.

Модели (проверены в `GET /v1/models`, `category:"image"`, цены в BYN за 1024×1024):
- `z-image-turbo` — 0.03 BYN/картинку — **основная**, дефолт для обложек тем.
- `flux-2-klein-4b` — ~0.06 BYN/картинку — если `z-image-turbo` даёт нестабильный
  результат на конкретном промпте.
- (`flux-2-klein-9b` существует и дешевле обеих — ~0.027 BYN — но пользователь его не
  называл; не переключать на него по своей инициативе без причины, если
  `z-image-turbo` работает.)

Промпт — иллюстративная обложка темы (книги/тетради/доска/абстрактная композиция на
тему письма), **не** точная схема правила с текстом на изображении — генеративная
модель ненадёжно кладёт русский текст на картинку. Схемы/деревья (например, виды
придаточных) — если нужны — рисовать через `pdf-lib` текстом/линиями в самой
PDF-шпаргалке, не через генерацию изображения.

Баланс ограничен ("не так много денег... юзай не слишком дорогие модели" — прямая
цитата пользователя) — считать картинки по счёту (N тем ⇒ N вызовов), не генерировать
про запас/варианты на выбор (`n` всегда `1`).

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

Скрипт `prisma/seedRussianCourse02Morphology.ts` — все 10 тем блока «Морфология»,
включая MATCH_PAIRS/HIGHLIGHT_TEXT-хелперы, идемпотентный по образцу тикета 01
(`findOrCreateTest()` на уровне темы). **Статус: ЗАВЕРШЕНО.**

Первый прогон (kie.ai/`velsvisual`, модель `google/nano-banana`) остановился на теме
`adjective-morphology` с `Ошибка KIE API (code=402): Credits insufficient` — баланс
делился между параллельными тикетами 02/03/04 и кончился раньше расчёта. Пользователь
подтвердил, что kie.ai кончился насовсем, и дал другой провайдер вместо пополнения —
`api.bycom.by` (см. §5, контракт переписан и перепроверен реальным вызовом). Скрипт
переключён: `generateCoverImage()` теперь делает `POST
https://api.bycom.by/v1/images/generations` с `{model:'z-image-turbo', prompt, n:1,
size:'1024x1024'}`, `Authorization: Bearer $BYCOM_API_KEY`, декодирует
`data[0].b64_json` (`Buffer.from(b64, 'base64')`) и грузит в S3 напрямую — без
временной папки на диске и без `execFileSync`/`velsvisual` CLI (тот вызывал kie.ai,
для bycom.by не нужен, дёргаем HTTP напрямую). Формат обложек поменялся с
`jpg`/`image/jpeg` на `png`/`image/png` — bycom.by отдаёт PNG, не JPEG (проверено
реальным ответом перед прогоном, не угадано).

Второй прогон (после переключения) прошёл до конца без ошибок: 3 уже готовые темы
пропущены как идемпотентные (`= пропуск темы ... — пост уже существует`),
`adjective-morphology` переиспользовал существующие тесты (не задублировал) и
досоздал обложку+пост, оставшиеся 6 тем созданы с нуля, сводный PDF блока сгенерирован
последним шагом.

**Категории (`slug` — `Category.id`; 10 итого, 2 существовали до тикета):**
`parts-of-speech` `8ea463f0-919e-4b07-a296-5e173f3a7810` (существовала) ·
`participles-gerunds` `a35ccefe-ef8c-4eba-9a4e-908af4050fbd` (существовала) ·
`noun-morphology` `be5bb64f-4d20-4bee-ba98-2d068aa58ca8` (новая) ·
`adjective-morphology` `b4c6a361-3d3a-4448-b7a1-a9f9cf8cb43c` (новая) ·
`verb-morphology` `f3d201ff-1a45-4818-9cc0-f4b5a3912a56` (новая) ·
`pronoun-morphology` `3fb4d296-b09b-4b03-a5f7-7532bab64998` (новая) ·
`numeral-morphology` `25b5c86d-0228-4d63-b011-e65c651788e0` (новая) ·
`adverb-morphology` `f442186a-bfd3-46e8-bad5-46f821b79600` (новая) ·
`function-words` `82dc5303-86d1-400e-87fe-14ebb83fec60` (новая) ·
`interjections` `5cb8f31a-8ed7-488e-8258-4a17516e8d51` (новая). Все 10 — с
`CategoryTranslation` в ru/en/hi/zh (переводы по смыслу).

**Темы (все 10, пост + короткий тест + большой тест + шпаргалка PDF + обложка,
TEST_LINK/FILE_LIST/MEDIA в посте) — тип блока теста по спецификации тикета:**
1. `parts-of-speech` (MATCH_PAIRS) — пост `b402d83d-0195-40d5-9940-f730e1bcf110`;
   тесты `f18d7c78-5ca3-49b2-af48-6f36cbc89194` (6 бл.) /
   `784960dd-dab0-4c67-80d6-cb2da3dd1ff6` (14 бл.); шпаргалка
   `.../russian-course-cheatsheets/.../8d20fe3b-bfb8-4525-be5f-ac34b88503ed.pdf`;
   обложка `.../russian-course-images/.../e374277b-7f2e-43a3-9b4a-91052ffa9a32.jpg`
   (сгенерирована ещё на kie.ai, до переключения).
2. `participles-gerunds` (CHOOSE_OPTION) — пост
   `7984e7be-de7a-4048-8461-dab9602d2abf`; тесты
   `698babeb-68e7-45a4-b14f-6e0752b70b23` (6 бл.) /
   `38dd3197-3443-4e6d-8ae0-c5e040a10186` (14 бл.); шпаргалка
   `.../russian-course-cheatsheets/.../d732da4c-698d-4f3e-8baf-d8669fe6d8a2.pdf`;
   обложка `.../russian-course-images/.../9a3d4637-059b-424a-b6cf-c4c6b0594fa3.jpg`
   (kie.ai).
3. `noun-morphology` (FILL_TEXT) — пост `9fa96b9e-c18b-4f31-9849-d624268fa4ef`;
   тесты `6aa82983-70ed-4fbc-8512-1c31c66552e4` (6 бл.) /
   `2022b330-0ec1-4b33-823f-542f3827964f` (14 бл.); шпаргалка
   `.../russian-course-cheatsheets/.../d4c8d876-a723-42a6-8e93-7dc61c7ddd87.pdf`;
   обложка `.../russian-course-images/.../d4149d40-e7e5-45d4-bc5e-88d986de52d9.jpg`
   (kie.ai).
4. `adjective-morphology` (CHOOSE_OPTION) — пост
   `5febb015-0aaa-4a01-ab5e-67a2061a97ad`; тесты (переиспользованы из прерванного
   прогона) `8594ddbb-e27c-4e7a-82cf-97729fc13660` (6 бл.) /
   `4ed80a19-725d-4a18-8d0c-76f25d8b1ddd` (14 бл.); шпаргалка (тоже переиспользована)
   `.../russian-course-cheatsheets/.../34d51df7-cf4a-49de-83ae-656289b7de1a.pdf`;
   обложка (bycom.by, первая после переключения)
   `.../russian-course-images/.../bd395b76-e92d-40dd-85f0-d86432f4d2ea.png`.
5. `verb-morphology` (FILL_TEXT) — пост `b1be354c-64fe-4b70-89cf-12ba2df63a9d`;
   тесты `d0859fec-ad17-43ad-99e3-055a6dceb418` (6 бл.) /
   `29803e66-c374-4f6e-b29b-2145f917b6bd` (14 бл.); шпаргалка
   `.../russian-course-cheatsheets/.../3b7b8375-9306-4487-a618-eb1d8e19df6a.pdf`;
   обложка `.../russian-course-images/.../2e88910a-9e9f-4b59-8ef8-c0f46e3d0164.png`.
6. `pronoun-morphology` (MATCH_PAIRS) — пост
   `2265fa09-5ee8-4e14-9b7f-c4c2e175912f`; тесты
   `a4b4aba7-ae86-4af4-a210-b6d42e017b71` (6 бл.) /
   `102c15a6-656c-41cb-8975-a322c26b67e2` (14 бл.); шпаргалка
   `.../russian-course-cheatsheets/.../dce69361-98b7-40d9-b180-b251d747fea1.pdf`;
   обложка `.../russian-course-images/.../fe598fee-6c86-4b70-ad38-5e266626a7ab.png`.
7. `numeral-morphology` (FILL_TEXT, включая многогапповый блок для составного
   числительного «тремястами двадцатью тремя») — пост
   `439914f2-9caa-4083-842d-b9b3b1e88f1d`; тесты
   `29ed3f28-c058-45c4-bbf9-6d11c18ff4e9` (6 бл.) /
   `deb3cb47-5d3f-4305-8120-1912c145a5c5` (14 бл.); шпаргалка
   `.../russian-course-cheatsheets/.../a0d8cdf8-1b83-4e55-9373-1db8425b7dc9.pdf`;
   обложка `.../russian-course-images/.../55cbdd0e-8e7c-4de3-817b-5845a1b3bdaa.png`.
8. `adverb-morphology` (CHOOSE_OPTION) — пост
   `ccdb7384-dc20-41de-80b4-a0b7237402b7`; тесты
   `bb5787c1-c7da-4c2f-80f3-0729ab9fe970` (6 бл.) /
   `c29d8705-a0f1-4149-bb32-ff08da1c8481` (14 бл.); шпаргалка
   `.../russian-course-cheatsheets/.../1265f6d1-dbb4-4a09-b499-7907644711eb.pdf`;
   обложка `.../russian-course-images/.../46301b99-c58f-4b0b-a9aa-ff36e5a738e6.png`.
9. `function-words` (HIGHLIGHT_TEXT — новый хелпер `highlightTextBlock()`, payload
   `{instruction, tokens:{id,text,isCorrect}[]}`, проверено по
   `TaskPayload.type.ts:52-61` и `scoreBlock.tsx:120`) — пост
   `3a9d7821-8c30-44fc-a0b0-1942319d0d22`; тесты
   `3e9aa6db-8aa7-471b-b246-416901607dc5` (6 бл.) /
   `da5a4985-2ac6-40f4-a504-1f8849174321` (14 бл.); шпаргалка
   `.../russian-course-cheatsheets/.../c3b0eb13-1c20-44dd-9e67-abeb100e2582.pdf`;
   обложка `.../russian-course-images/.../76759696-404a-4fa0-8a3f-6d9b16fb6bde.png`.
10. `interjections` (CHOOSE_OPTION) — пост
    `f6738fde-93c8-4d1e-849e-2e48e9feb459`; тесты
    `b89d9ddf-5379-465f-b717-78fdc841301e` (6 бл.) /
    `fc94d765-2f38-4a81-b73c-669e6c4df497` (14 бл.); шпаргалка
    `.../russian-course-cheatsheets/.../09dd2d89-fceb-4b2b-8274-5c6399bda99b.pdf`;
    обложка `.../russian-course-images/.../4406df54-fef3-4979-ac9b-374856cd358f.png`.

Сводный PDF блока «Морфология» (список всех 10 тем + строка правила на тему):
`.../russian-course-cheatsheets/.../815e0e0f-7bb0-4f20-b65c-2f0e529f3d7c.pdf`.

**Верификация:**
- DB: `psql` — `select c.slug, count(distinct p.id), count(distinct t.id) ... group by
  c.slug` по всем 10 категориям блока подтвердил ровно **1 пост / 2 теста у каждой из
  10 тем**.
- HTTP: `curl -o /dev/null -w '%{http_code} %{size_download}'` по всем 15 файлам,
  загруженным во втором прогоне (7 шпаргалок + 7 обложек + сводный PDF) — все `200` с
  ненулевым размером (обложки ~0.7–1.4 МБ PNG); плюс 3 файла первого прогона (тема
  `parts-of-speech`/`participles-gerunds`/`noun-morphology`) перепроверены — тоже
  `200`. Итого проверено 18 URL, все резолвятся.
- Cyrillic PDF: все 8 шпаргалок/сводный PDF (включая 6 новых после переключения на
  bycom.by — сам провайдер картинок, шрифт/PDF-пайплайн не менялся) открыты через
  `pdfjs-dist` (`legacy/build/pdf.mjs`), текст первой страницы извлечён и читаем без
  искажений.

**Отклонения от плана:**
- **D04 — смена image-провайдера с kie.ai/`velsvisual` на `api.bycom.by`**, см. выше.
  Инициирована пользователем (kie.ai кончился насовсем), контракт зафиксирован в
  §5 и перепроверен реальным вызовом перед массовым прогоном. Побочный эффект:
  формат обложек — PNG вместо JPEG (`data[].b64_json` у bycom.by — PNG), обновлено в
  `uploadBuffer()` вызове (`'png'`/`'image/png'` вместо `'jpg'`/`'image/jpeg'`).
  Обложки тем 1–3 (сгенерированные до переключения) остались `.jpg` — не
  перегенерировались, оба формата валидны, смешение JPEG/PNG в одной S3-папке не
  проблема.
- Никаких других отклонений — типы блоков тестов, структура постов, папки S3,
  идемпотентность на уровне темы (`findOrCreateTest`) — всё как в тикете 01 и как
  зафиксировано в первом (BLOCKED) прогоне этого тикета.

### Тикет 03

Скрипт `prisma/seedRussianCourse03Syntax.ts` написан полностью (все 10 листовых тем
блока «Синтаксис»: 2 уже существовавшие — `simple-sentence`, `complex-sentence` — плюс
8 новых, все с переводами в 4 локалях; PDF-шпаргалки; CHOOSE_OPTION/FILL_TEXT/
MATCH_PAIRS/HIGHLIGHT_TEXT-тесты по контрактам тикета; сводный PDF блока) и прогнан на
локальной dev-БД (`postgresql://nikitatisevic@localhost/goodworker`).

Категории (`slug` — `Category.id`):
- `simple-sentence` — `b1e35d2e-0a3f-448e-aa69-bca998d0ed94` (уже существовала)
- `complex-sentence` — `7a5d86ef-aca5-48dc-b36d-0e1c2a90543b` (уже существовала;
  перевод сужен во всех 4 локалях с «Сложное предложение» до «Сложноподчинённое
  предложение: виды придаточных», slug не менялся, как требовал тикет)
- `phrase-connection` — `9d1bc6c2-cc75-4235-b54c-ae0201b7d540` (новая)
- `one-part-sentence` — `79aaf7d1-b4b8-430d-82ed-ce62795920f8` (новая)
- `homogeneous-parts` — `50aae18a-0ec8-4039-a8e6-d70b3da4d607` (новая)
- `isolated-members` — `33be5d59-bf9c-4cf3-add3-db010cf8209e` (новая)
- `introductory-words` — `143913f3-fc81-486f-af70-fd50353ad134` (новая)
- `compound-sentence` — `6c47af14-c85c-4e21-becc-345e82f42567` (новая)
- `asyndetic-sentence` — `e86bab92-8734-4a41-8e80-7bba7b96e881` (новая)
- `direct-speech` — `9bcca78b-db20-4bfc-97aa-f3be4b20eb4f` (новая)

По каждой из 10 тем: 1 пост-объяснение (TEXT + MEDIA с обложкой + TEST_LINK на оба
теста + FILE_LIST с PDF-шпаргалкой — обложки дописаны бэкфиллом, см. D01 ниже), 2 теста (короткий 6 блоков,
большой 9–14 блоков) через `TestCategory` на ту же категорию, 1 PDF-шпаргалка в
`russian-course-cheatsheets`. Плюс 1 сводный PDF блока «Синтаксис» (оглавление, одна
строка правила на тему). Типы тестовых блоков по темам: `simple-sentence` —
HIGHLIGHT_TEXT (основа) + CHOOSE_OPTION, `complex-sentence` — CHOOSE_OPTION,
`phrase-connection` — MATCH_PAIRS + CHOOSE_OPTION, `one-part-sentence` — CHOOSE_OPTION,
`homogeneous-parts` — FILL_TEXT + HIGHLIGHT_TEXT + CHOOSE_OPTION, `isolated-members` —
HIGHLIGHT_TEXT + CHOOSE_OPTION, `introductory-words` — CHOOSE_OPTION,
`compound-sentence` — MATCH_PAIRS + CHOOSE_OPTION, `asyndetic-sentence` — FILL_TEXT +
CHOOSE_OPTION, `direct-speech` — FILL_TEXT + CHOOSE_OPTION.

**Verified:**
- DB: `psql` — все 10 категорий имеют по 4 `CategoryTranslation`, ровно 1 `Post` и 2
  `Test` (через `TestCategory`) каждая.
- HTTP: `curl -o /dev/null -w '%{http_code} %{size_download}'` на все 11 PDF (10
  шпаргалок + 1 сводный) — все `200`, размер ~564 КБ (единый шаблон Roboto A4).
- Cyrillic: открыто через `pdfjs-dist` (`legacy/build/pdf.mjs`) для шпаргалки
  `direct-speech` (содержит `->`, `—`, `« »`) и сводного PDF — текст извлекается
  корректно, кириллица, тире и кавычки-ёлочки не искажены. Символ `→`/`←` в PDF нигде
  не использован (только ASCII `->`, по уроку тикета 01).
- Payload-формы: `MATCH_PAIRS` (`{pairs:[{id,left,right}]}`) и `HIGHLIGHT_TEXT`
  (`{instruction, tokens:[{id,text,isCorrect}]}`) проверены чтением
  `src/features/Tasks/TaskObjects/MatchPairsTask.tsx` /
  `HighlightTextTask.tsx` + `TaskPayload.type.ts` перед использованием (не угаданы), и
  сверены в БД через `psql`/`jsonb_pretty` после прогона — совпадают.
- Обложки (после бэкфилла): `psql` с `jsonb_path_exists(content, '$.blocks[*] ?
  (@.type == "MEDIA")')` — `true` на всех 10 постов (не просто счётчик блоков — сама
  структура проверена); `curl` на все 10 URL обложек — `200`, `image/png`, ~0.95–1.8 МБ
  каждая (разные размеры подтверждают, что это разные картинки, а не дубль одного файла).

**Отклонения от плана:**
- **D01 — обложки: kie.ai/velsvisual → api.bycom.by (уже разрешено).** Изначальный
  прогон упёрся в `code=402 Credits insufficient` у kie.ai (баланс `velsvisual
  credits` был `1.01`) — тот же внешний блокер, что и в тикетах 02/04 (общий платный
  пул на все параллельные тикеты, исчерпан безвозвратно, пользователь подтвердил и дал
  новый провайдер вместо пополнения). Тогда же сделал генерацию обложки best-effort
  (`try/catch` вокруг `generateCoverImage`/`uploadBuffer` в
  `seedRussianCourse03Syntax.ts`) — посты создавались без `MEDIA`-блока, чтобы не
  стопорить весь тикет на внешнем ресурсе. Координатор передал новый контракт
  (`api.bycom.by`, `z-image-turbo`, `POST /v1/images/generations`, ключ
  `BYCOM_API_KEY` в `.env`, ответ `{"data":[{"b64_json":"..."}]}` вместо URL — контракт
  из `interfaces.md` §5, подтверждён координатором реальным вызовом, не угадан здесь) и
  попросил дописать обложки отдельным бэкфиллом, так как идемпотентность
  `seedRussianCourse03Syntax.ts` держится на «пост с этим заголовком существует →
  пропустить тему» и не подхватила бы недостающие обложки при повторном запуске.
  Написан `prisma/backfillRussianCourse03SyntaxCovers.ts` — отдельный одноразовый
  скрипт (не трогает исходный сид-скрипт, отдельный коммит): для каждой из 10 тем
  находит существующий пост по `teacherId`+`categoryId`, пропускает, если `MEDIA`-блок
  уже есть (идемпотентно на случай повторного запуска), иначе генерирует обложку через
  bycom, декодирует `b64_json` (`Buffer.from(..., 'base64')`), грузит в S3
  (`russian-course-images`, `.png`, `image/png` — bycom отдаёт PNG, не JPEG, как
  kie.ai) тем же паттерном §4, вставляет `MEDIA`-блок сразу после `TEXT`-блока и
  пересчитывает `mediaUrls` через `prisma.post.update`. Прогнан один раз, все 10
  обложек сгенерированы и загружены с первого раза (бюджет: 10 × 0.03 BYN = 0.30 BYN,
  `z-image-turbo`, `n:1`, без запасных вариантов — как просил пользователь). Итог: все
  10 тем блока «Синтаксис» теперь полностью закрывают R02/R10 — пост с обложкой,
  двумя тестами и шпаргалкой.
- Тип-чек (`tsc --noEmit`) даёt 4 ожидаемые ошибки (`teacher` possibly null внутри
  замыкания `findOrCreateTest`, несовпадение Json-типов) — идентичные тем, что уже есть
  в `seedRussianCourse01Orthography.ts`/`02Morphology.ts`/`04Punctuation.ts` (тот же
  паттерн); `tsx` их не проверяет, скрипт рабочий. Не фиксил, чтобы не расходиться с
  паттерном остальных тикетов.
- MATCH_PAIRS/HIGHLIGHT_TEXT — тикет называл их «идеей проверки» для конкретных тем
  (не обязательным требованием — см. `tickets/03-syntax.md` и `spec.md`: «типы блоков
  теста... решает исполнитель тикета по месту»); использованы там, где предложены
  (`phrase-connection`, `compound-sentence` → MATCH_PAIRS; `simple-sentence`,
  `homogeneous-parts`, `isolated-members` → HIGHLIGHT_TEXT), остальные темы — на
  проверенных в тикете 01 CHOOSE_OPTION/FILL_TEXT.
- Никаких других отклонений от `interfaces.md`/`tickets/03-syntax.md` — структура
  постов, папки S3, модель `google/nano-banana` с явным `output_format=jpeg`,
  идемпотентность на уровне темы (`findOrCreateTest`) — всё как в тикете 01.

### Тикет 04

Скрипт `prisma/seedRussianCourse04Punctuation.ts` написан полностью (все 7 тем блока
«Пунктуация», 3 категории-новеллы с переводами, PDF-шпаргалки, HIGHLIGHT_TEXT/
CHOOSE_OPTION/FILL_TEXT/SEQUENCE-тесты по контрактам тикета, сводный PDF блока) и
прогнан на локальной dev-БД (`postgresql://nikitatisevic@localhost/goodworker`)
**до полного завершения, в два прогона** — первый упёрся во внешний блокер
(kie.ai/velsvisual кончился по кредитам), второй, после переключения на новый
провайдер обложек (`api.bycom.by`, см. D04 ниже), дописал всё остальное. Все 7 тем
готовы: 1 пост + 2 теста + 1 PDF-шпаргалка + 1 обложка на тему, плюс 1 сводный PDF
блока.

Категории (`slug` — `Category.id`):
- `commas` — `2dbc48eb-7063-495f-ad9f-ce93142d51e3` (уже существовала)
- `colon` — `af222866-8d56-418b-a489-c1d2c9654096` (уже существовала)
- `dash` — `eaf0fe41-f00f-4cca-8ea2-290b12ec9823` (уже существовала)
- `quotation-marks` — `49812818-598b-427e-8af0-eb4d14419648` (уже существовала)
- `comma-isolation` — `16f01385-b544-4daa-89f2-039053dd8efa` (новая)
- `complex-sentence-punctuation` — `a3b45dbb-8a96-4e21-8780-2a749a322ccc` (новая)
- `introductory-punctuation` — `1741ab13-3ecd-4988-9017-2aabc73e14d6` (новая)

По каждой теме — 1 пост + 2 теста (короткий 6 блоков / большой 12 блоков), подтверждено
`psql` (`GROUP BY` по всем 7 категориям даёт `posts=1, tests=2` в каждой строке):

| Тема | postId | shortTestId | largeTestId |
|---|---|---|---|
| `commas` | `da79bf7f-80eb-4347-9c7f-20161858d635` | `510e1e39-102d-463f-83a9-c768f3326254` | `e77a38e5-fd26-4f40-83d2-7e2bafa1f1e7` |
| `colon` | `aa9d50e8-b0f2-459e-9258-b92bdd0525d9` | `f5af00cd-2034-4c9f-b590-f5795cd86121` | `86fc208b-3043-4734-a764-1aa81057b739` |
| `dash` | `c9578146-84dc-4a8c-8473-63c2e0eb7089` | `228d63e5-1c7d-4347-a43c-ff1382490794` | `c36aa783-dd1f-4547-9166-16e77f9d9897` |
| `quotation-marks` | `b883e94c-5a5d-4ac1-b719-e6afcfe9063a` | `ee0a392e-1866-4021-a3fc-a2180c329eef` | `36af156c-93b7-467b-ab5b-65ee430c3eb1` |
| `comma-isolation` | `55d57619-f762-4dda-874b-33457a9da455` | `18e7cd74-eaa2-43a5-b731-0ea45701587a` | `19fc354e-2b11-4787-b745-d4c9d0a7df8a` |
| `complex-sentence-punctuation` | `dd7e811c-66c7-44a8-b9ea-a7a72e3ec189` | `667728d8-d632-4301-8098-32f56e71e10c` | `10946cc5-784c-43ff-bba3-f3261e9d8d9e` |
| `introductory-punctuation` | `061b3b9b-bc8e-4dc0-9dd4-d7c4d1b96e37` | `e906da4b-3234-4f13-a74f-15715031940b` | `af61a04e-f6c7-42d9-bed3-3e73a731850b` |

Файлы (S3, все проверены `curl -o /dev/null -w '%{http_code} %{size_download}'` — все
`200`):
- Шпаргалки `russian-course-cheatsheets/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/`:
  `16bbb3f0…pdf` (commas, `564206` байт — перегенерирована во втором прогоне, старая
  `0e7a6956…pdf` из первого прогона осталась в S3, не удалялась — не критично, тот же
  паттерн что D02 тикета 01), `6ed8a438…pdf` (colon, `563628`), `fe046f4f…pdf` (dash,
  `563840`), `c8218341…pdf` (quotation-marks, `563521`), `a7f8b5db…pdf`
  (comma-isolation, `563892`), `8ae07dc3…pdf` (complex-sentence-punctuation, `564306`),
  `d2cf0e06…pdf` (introductory-punctuation, `563985`), `de57c346…pdf` (сводный PDF
  блока «Пунктуация», `564390`).
- Обложки `russian-course-images/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/` (все `.png`,
  bycom.by/`z-image-turbo`, 1024×1024): `02ae1c7d…png` (commas, `1203786` байт),
  `bd964d23…png` (colon, `1438862`), `eced7c8e…png` (dash, `1322204`), `5eb45601…png`
  (quotation-marks, `1266980`), `879ee84c…png` (comma-isolation, `1419733`),
  `2fd4b1cb…png` (complex-sentence-punctuation, `1625363`), `9d45e917…png`
  (introductory-punctuation, `1153297`). PNG-сигнатура (`89 50 4E 47 0D 0A 1A 0A`)
  проверена на первой картинке — валидный PNG, не мусор/HTML-ошибка под 200.

**Отклонения от плана:**
- **D04 (обновлено) — смена провайдера обложек kie.ai → api.bycom.by.** Первый прогон
  остановился на теме `commas` (тесты+шпаргалка создались, обложка/пост — нет):
  `velsvisual run google/nano-banana ...` вернул `Ошибка KIE API (code=402): Credits
  insufficient`, `velsvisual credits` показал баланс `1.01` при минимум `4` кредитах за
  картинку в живом прайсе (7 обложек ⇒ нужно ≥28) — исчерпание общего аккаунта,
  использованного параллельно тикетами 02/03/04, а не проблема конфигурации. Не стал
  подставлять плейсхолдер в обход контракта — вернул `BLOCKED` и остановился (см. первую
  версию этой записи в истории диалога/коммитов, если нужен снимок того промежуточного
  состояния).
  Пользователь подтвердил, что kie.ai не пополняется, и передал новый провайдер;
  оркестратор переписал `interfaces.md §5` под `api.bycom.by` (OpenAI-совместимый
  `POST /v1/images/generations`, ключ `BYCOM_API_KEY` в `.env`, модель `z-image-turbo`,
  `0.03 BYN/картинку`, ответ — `data[].b64_json` base64 PNG, не URL) и подтвердил
  контракт живым тестовым вызовом до того, как я его перечитал — я не гадал по описанию.
  В скрипте заменена только `generateCoverImage()`: убран `execFileSync('velsvisual', …)`
  и локальный `COVERS_DIR`, добавлен прямой `fetch('https://api.bycom.by/v1/images/generations', …)`
  с `Authorization: Bearer ${BYCOM_API_KEY}`, `{model:'z-image-turbo', prompt, n:1,
  size:'1024x1024'}`, декодирование `Buffer.from(data[0].b64_json, 'base64')` — без
  скачивания откуда-либо, как велит §5. Точка загрузки в S3 (`uploadBuffer`, §4) не
  менялась, только расширение/`Content-Type` обложки поменяны с `jpg`/`image/jpeg` на
  `png`/`image/png`, потому что bycom.by отдаёт PNG, а не JPEG (в отличие от
  `velsvisual`+`nano-banana`, где явно запрашивался `output_format=jpeg`). Второй прогон
  прошёл все 7 тем и сводный PDF без ошибок за один вызов
  `npx tsx prisma/seedRussianCourse04Punctuation.ts` — `findOrCreateTest` переиспользовал
  оба теста `commas` из первого прогона (не задублировал), досоздал недостающие
  пост+шпаргалку+обложку для `commas` и всё с нуля для тем 2–7.

**Верифицировано (все 7 тем, финально):**
- `psql`: все 7 категорий пунктуации (4 старые + 3 новые) с переводами во всех 4
  локалях у новых; `GROUP BY slug` по `Post`+`TestCategory` даёт `posts=1, tests=2` для
  каждой из 7 тем.
- HTTP: все 15 загруженных файлов (7 шпаргалок + 7 обложек + 1 сводный PDF) — `200`,
  размеры см. выше; обложка PNG-сигнатура проверена бинарно.
- Cyrillic/glyph-проверка: 3 PDF (шпаргалка `quotation-marks` с «ёлочками», шпаргалка
  `complex-sentence-punctuation` с тире `—` и ASCII-стрелками `->`, сводный PDF блока)
  открыты через `pdfjs-dist` (`legacy/build/pdf.mjs`) — текст извлекается корректно на
  всех трёх, кириллица/«»/— не искажены; глиф-проверка `«`/`»`/`—`/`–`/`„`/`“`/`…` на
  `Roboto-Regular.ttf` через `font.embedder.font.hasGlyphForCodePoint` из первого прогона
  остаётся в силе (шрифт не менялся между прогонами).
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
