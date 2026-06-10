/**
 * Seed script: creates JS "Переменные" lesson post with 6 varied test formats
 * Run: npx tsx scripts/seed-js-variables-post.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEACHER_ID = 'eac0ceeb-4226-4b43-9705-4aaec0f1f6a2'

function uid() {
  return crypto.randomUUID()
}

// ── Tiptap helpers ──────────────────────────────────────────────────────────

function doc(...nodes: object[]) {
  return { type: 'doc', content: nodes }
}

function heading(level: number, text: string) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

function p(...children: object[]) {
  return { type: 'paragraph', content: children }
}

function txt(text: string, ...marks: { type: string; attrs?: object }[]) {
  return marks.length ? { type: 'text', text, marks } : { type: 'text', text }
}

function code(text: string) {
  return txt(text, { type: 'code' })
}

function codeBlock(lang: string, text: string) {
  return { type: 'codeBlock', attrs: { language: lang }, content: [{ type: 'text', text }] }
}

function bullet(...items: object[][]) {
  return {
    type: 'bulletList',
    content: items.map(children => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: children }]
    }))
  }
}

// selectGap inline node for FILL_TEXT
function selectGap(options: string[], correctOption: string) {
  return {
    type: 'selectGap',
    attrs: { gapId: uid(), options, correctOption }
  }
}

// inputGap inline node for FILL_TEXT
function inputGap(answer: string) {
  return {
    type: 'inputGap',
    attrs: { gapId: uid(), answer }
  }
}

// ── Post content ─────────────────────────────────────────────────────────────

const postContent = {
  blocks: [
    // ── Теория: что такое переменная ──────────────────────────────────────
    {
      id: uid(),
      type: 'TEXT',
      payload: {
        content: doc(
          heading(1, 'Переменные'),
          p(txt('Переменная — это «именованное хранилище» для данных. Мы используем переменные для хранения различных значений.')),
          p(txt('В JavaScript для объявления переменной чаще всего используется ключевое слово '), code('let'), txt(':')),
          codeBlock('javascript', `let message;\nmessage = 'Привет!';\nalert(message); // Привет!`),
          p(txt('Можно объявить и сразу присвоить значение:')),
          codeBlock('javascript', `let message = 'Привет!';\nalert(message);`),
          p(txt('Объявить несколько переменных можно в одну строку, но лучше — каждую отдельно:')),
          codeBlock('javascript', `let user = 'Иван';\nlet age = 25;\nlet message = 'Привет';`),
        )
      }
    },

    // ── Теория: let / const / var ─────────────────────────────────────────
    {
      id: uid(),
      type: 'TEXT',
      payload: {
        content: doc(
          heading(2, 'let, const и var'),
          p(txt('Помимо '), code('let'), txt(' существуют ещё два способа объявить переменную:')),
          bullet(
            [code('let'), txt(' — современный способ, значение можно менять.')],
            [code('const'), txt(' — константа: значение нельзя переназначить после объявления.')],
            [code('var'), txt(' — устаревший способ, отличается областью видимости. Лучше не использовать.')],
          ),
          codeBlock('javascript', `const PI = 3.14159;\n// PI = 3; // Ошибка! Нельзя переназначить константу\n\nlet counter = 0;\ncounter = 1; // OK`),
          p(txt('Правила именования переменных:')),
          bullet(
            [txt('Можно использовать буквы, цифры, '), code('_'), txt(' и '), code('$'), txt('.')],
            [txt('Имя не может начинаться с цифры.')],
            [txt('Зарезервированные слова ('), code('let'), txt(', '), code('return'), txt(', '), code('class'), txt('...) использовать нельзя.')],
            [txt('Регистр важен: '), code('apple'), txt(' и '), code('Apple'), txt(' — разные переменные.')],
          )
        )
      }
    },

    // ── Тест: 6 блоков разного формата ───────────────────────────────────
    {
      id: uid(),
      type: 'MINI_TEST',
      payload: {
        title: 'Проверь себя',
        blocks: [

          // 1. CHOOSE_OPTION — одиночный выбор
          {
            id: uid(),
            type: 'CHOOSE_OPTION',
            payload: {
              question: 'Какое ключевое слово запрещает переназначение переменной?',
              options: [
                { id: 'a', text: 'var' },
                { id: 'b', text: 'let' },
                { id: 'c', text: 'const' },
                { id: 'd', text: 'static' },
              ],
              correctId: 'c',
            }
          },

          // 2. CHOOSE_OPTION — множественный выбор
          {
            id: uid(),
            type: 'CHOOSE_OPTION',
            payload: {
              question: 'Выберите все допустимые имена переменных:',
              options: [
                { id: 'a', text: 'myVar' },
                { id: 'b', text: '1name' },
                { id: 'c', text: '_count' },
                { id: 'd', text: '$price' },
                { id: 'e', text: 'let' },
              ],
              correctId: ['a', 'c', 'd'],
            }
          },

          // 3. MATCH_PAIRS — сопоставление
          {
            id: uid(),
            type: 'MATCH_PAIRS',
            payload: {
              pairs: [
                { id: uid(), left: 'let',       right: 'Переменная, значение можно менять' },
                { id: uid(), left: 'const',      right: 'Значение нельзя переназначить' },
                { id: uid(), left: 'var',        right: 'Устаревший способ объявления' },
                { id: uid(), left: 'undefined',  right: 'Значение переменной до инициализации' },
              ]
            }
          },

          // 4. SEQUENCE — расстановка в правильном порядке
          {
            id: uid(),
            type: 'SEQUENCE',
            payload: {
              items: [
                { id: uid(), text: 'let name;' },
                { id: uid(), text: "name = 'Иван';" },
                { id: uid(), text: 'console.log(name);' },
              ]
            }
          },

          // 5. HIGHLIGHT_TEXT — выдели ключевые слова объявления
          {
            id: uid(),
            type: 'HIGHLIGHT_TEXT',
            payload: {
              instruction: 'Выдели все ключевые слова объявления переменных:',
              tokens: [
                { id: 1,  text: 'let',    isCorrect: true  },
                { id: 2,  text: ' ',      isCorrect: false },
                { id: 3,  text: 'name',   isCorrect: false },
                { id: 4,  text: ' = ',    isCorrect: false },
                { id: 5,  text: "'Иван'", isCorrect: false },
                { id: 6,  text: '; ',     isCorrect: false },
                { id: 7,  text: 'const',  isCorrect: true  },
                { id: 8,  text: ' ',      isCorrect: false },
                { id: 9,  text: 'age',    isCorrect: false },
                { id: 10, text: ' = ',    isCorrect: false },
                { id: 11, text: '25',     isCorrect: false },
                { id: 12, text: '; ',     isCorrect: false },
                { id: 13, text: 'var',    isCorrect: true  },
                { id: 14, text: ' ',      isCorrect: false },
                { id: 15, text: 'city',   isCorrect: false },
                { id: 16, text: ' = ',    isCorrect: false },
                { id: 17, text: "'Москва'", isCorrect: false },
                { id: 18, text: ';',      isCorrect: false },
              ]
            }
          },

          // 6. FILL_TEXT — выбери из выпадающего списка
          {
            id: uid(),
            type: 'FILL_TEXT',
            payload: {
              content: doc(
                p(
                  txt('Для объявления переменной, которую нельзя изменить, используют '),
                  selectGap(['let', 'const', 'var'], 'const'),
                  txt('. Для переменной, которую можно переназначить — '),
                  selectGap(['let', 'const', 'var'], 'let'),
                  txt('. Устаревшее ключевое слово — '),
                  selectGap(['let', 'const', 'var'], 'var'),
                  txt('.')
                )
              )
            }
          },

          // 7. WORD_SCRAMBLE — составь слово
          {
            id: uid(),
            type: 'WORD_SCRAMBLE',
            payload: {
              mode: 'letters',
              source: 'константа',
              hint: 'Переменная, значение которой нельзя изменить после присвоения',
            }
          },

        ]
      }
    }
  ]
}

async function main() {
  const post = await prisma.post.create({
    data: {
      teacherId: TEACHER_ID,
      title: 'Переменные в JavaScript',
      additionalTitle: 'Урок 2 — let, const, var и правила именования',
      visibility: 'PUBLIC',
      content: postContent as object,
      mediaUrls: [],
      hasMiniTest: true,
      aiTopics: [],
    }
  })

  console.log(`✅ Created post: ${post.id}`)
  console.log(`   Title: ${post.title}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
