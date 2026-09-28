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
