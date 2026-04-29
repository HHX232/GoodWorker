/* eslint-disable @typescript-eslint/no-explicit-any */
import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()
type LangCode = 'ru' | 'en' | 'hi' | 'zh'

type TranslationMap = Record<LangCode, string>

type CategoryNode = {
  slug: string
  levelNumber: number
  translations: TranslationMap
  children?: CategoryNode[]
  parentSlug?: string
}

const categoriesFirstPart: CategoryNode[] = [
  {
    slug: 'russian',
    levelNumber: 1,
    translations: {
      ru: 'Русский',
      en: 'Russian',
      hi: 'रूसी',
      zh: '俄语'
    },
    children: [
      {
        slug: 'phonetics',
        levelNumber: 2,
        translations: {
          ru: 'Фонетика',
          en: 'Phonetics',
          hi: 'ध्वनिविज्ञान',
          zh: '语音学'
        },
        children: [
          {
            slug: 'vowels-consonants',
            levelNumber: 3,
            translations: {
              ru: 'Гласные и согласные',
              en: 'Vowels and Consonants',
              hi: 'स्वर और व्यंजन',
              zh: '元音和辅音'
            }
          },
          {
            slug: 'stress-rules',
            levelNumber: 3,
            translations: {
              ru: 'Ударение',
              en: 'Stress Rules',
              hi: 'बलाघात के नियम',
              zh: '重音规则'
            }
          }
        ]
      },
      {
        slug: 'orthography',
        levelNumber: 2,
        translations: {
          ru: 'Орфография',
          en: 'Orthography',
          hi: 'वर्तनी',
          zh: '拼写'
        },
        children: [
          {
            slug: 'spelling-words',
            levelNumber: 3,
            translations: {
              ru: 'Правописание слов',
              en: 'Word Spelling',
              hi: 'शब्द वर्तनी',
              zh: '单词拼写'
            }
          },
          {
            slug: 'prefixes-suffixes',
            levelNumber: 3,
            translations: {
              ru: 'Приставки и суффиксы',
              en: 'Prefixes and Suffixes',
              hi: 'उपसर्ग और प्रत्यय',
              zh: '前缀和后缀'
            }
          }
        ]
      },
      {
        slug: 'morphology',
        levelNumber: 2,
        translations: {
          ru: 'Морфология',
          en: 'Morphology',
          hi: 'रूपविज्ञान',
          zh: '形态学'
        },
        children: [
          {
            slug: 'parts-of-speech',
            levelNumber: 3,
            translations: {
              ru: 'Части речи',
              en: 'Parts of Speech',
              hi: 'शब्द भेद',
              zh: '词类'
            }
          },
          {
            slug: 'participles-gerunds',
            levelNumber: 3,
            translations: {
              ru: 'Причастия и деепричастия',
              en: 'Participles and Gerunds',
              hi: 'कृदंत और कृदन्तीय रूप',
              zh: '分词和副动词'
            }
          }
        ]
      },
      {
        slug: 'syntax',
        levelNumber: 2,
        translations: {
          ru: 'Синтаксис',
          en: 'Syntax',
          hi: 'वाक्यविन्यास',
          zh: '句法'
        },
        children: [
          {
            slug: 'simple-sentence',
            levelNumber: 3,
            translations: {
              ru: 'Простое предложение',
              en: 'Simple Sentence',
              hi: 'सरल वाक्य',
              zh: '简单句'
            }
          },
          {
            slug: 'complex-sentence',
            levelNumber: 3,
            translations: {
              ru: 'Сложное предложение',
              en: 'Complex Sentence',
              hi: 'संयुक्त वाक्य',
              zh: '复句'
            }
          }
        ]
      }
    ]
  },
  {
    slug: 'mathematics',
    levelNumber: 1,
    translations: {
      ru: 'Математика',
      en: 'Mathematics',
      hi: 'गणित',
      zh: '数学'
    },
    children: [
      {
        slug: 'arithmetic',
        levelNumber: 2,
        translations: {
          ru: 'Арифметика',
          en: 'Arithmetic',
          hi: 'अंकगणित',
          zh: '算术'
        },
        children: [
          {
            slug: 'fractions',
            levelNumber: 3,
            translations: {
              ru: 'Дроби',
              en: 'Fractions',
              hi: 'भिन्न',
              zh: '分数'
            }
          },
          {
            slug: 'percentages',
            levelNumber: 3,
            translations: {
              ru: 'Проценты',
              en: 'Percentages',
              hi: 'प्रतिशत',
              zh: '百分比'
            }
          }
        ]
      },
      {
        slug: 'algebra',
        levelNumber: 2,
        translations: {
          ru: 'Алгебра',
          en: 'Algebra',
          hi: 'बीजगणित',
          zh: '代数'
        },
        children: [
          {
            slug: 'equations',
            levelNumber: 3,
            translations: {
              ru: 'Уравнения',
              en: 'Equations',
              hi: 'समीकरण',
              zh: '方程'
            }
          },
          {
            slug: 'inequalities',
            levelNumber: 3,
            translations: {
              ru: 'Неравенства',
              en: 'Inequalities',
              hi: 'असमानताएँ',
              zh: '不等式'
            }
          }
        ]
      },
      {
        slug: 'geometry',
        levelNumber: 2,
        translations: {
          ru: 'Геометрия',
          en: 'Geometry',
          hi: 'ज्यामिति',
          zh: '几何'
        },
        children: [
          {
            slug: 'polygons',
            levelNumber: 3,
            translations: {
              ru: 'Многоугольники',
              en: 'Polygons',
              hi: 'बहुभुज',
              zh: '多边形'
            }
          },
          {
            slug: 'right-triangle',
            levelNumber: 3,
            translations: {
              ru: 'Прямоугольный треугольник',
              en: 'Right Triangle',
              hi: 'समकोण त्रिभुज',
              zh: '直角三角形'
            }
          },
          {
            slug: 'pythagorean-theorem',
            levelNumber: 3,
            translations: {
              ru: 'Теорема Пифагора',
              en: 'Pythagorean Theorem',
              hi: 'पाइथागोरस प्रमेय',
              zh: '勾股定理'
            }
          }
        ]
      },
      {
        slug: 'functions',
        levelNumber: 2,
        translations: {
          ru: 'Функции',
          en: 'Functions',
          hi: 'फलन',
          zh: '函数'
        },
        children: [
          {
            slug: 'linear-functions',
            levelNumber: 3,
            translations: {
              ru: 'Линейные функции',
              en: 'Linear Functions',
              hi: 'रैखिक फलन',
              zh: '一次函数'
            }
          },
          {
            slug: 'quadratic-functions',
            levelNumber: 3,
            translations: {
              ru: 'Квадратичные функции',
              en: 'Quadratic Functions',
              hi: 'द्विघात फलन',
              zh: '二次函数'
            }
          }
        ]
      }
    ]
  },
  {
    slug: 'computer-science',
    levelNumber: 1,
    translations: {
      ru: 'Информатика',
      en: 'Computer Science',
      hi: 'कंप्यूटर विज्ञान',
      zh: '计算机科学'
    },
    children: [
      {
        slug: 'programming-basics',
        levelNumber: 2,
        translations: {
          ru: 'Основы программирования',
          en: 'Programming Basics',
          hi: 'प्रोग्रामिंग की मूल बातें',
          zh: '编程基础'
        },
        children: [
          {
            slug: 'variables-types',
            levelNumber: 3,
            translations: {
              ru: 'Переменные и типы',
              en: 'Variables and Types',
              hi: 'चर और प्रकार',
              zh: '变量和类型'
            }
          },
          {
            slug: 'conditions-loops',
            levelNumber: 3,
            translations: {
              ru: 'Условия и циклы',
              en: 'Conditions and Loops',
              hi: 'शर्तें और लूप',
              zh: '条件和循环'
            }
          }
        ]
      },
      {
        slug: 'algorithms',
        levelNumber: 2,
        translations: {
          ru: 'Алгоритмы',
          en: 'Algorithms',
          hi: 'एल्गोरिदम',
          zh: '算法'
        },
        children: [
          {
            slug: 'sorting-algorithms',
            levelNumber: 3,
            translations: {
              ru: 'Сортировки',
              en: 'Sorting Algorithms',
              hi: 'क्रमबद्ध करने के एल्गोरिदम',
              zh: '排序算法'
            }
          },
          {
            slug: 'searching-algorithms',
            levelNumber: 3,
            translations: {
              ru: 'Поиск',
              en: 'Searching Algorithms',
              hi: 'खोज एल्गोरिदम',
              zh: '搜索算法'
            }
          }
        ]
      },
      {
        slug: 'data-structures',
        levelNumber: 2,
        translations: {
          ru: 'Структуры данных',
          en: 'Data Structures',
          hi: 'डेटा संरचनाएँ',
          zh: '数据结构'
        },
        children: [
          {
            slug: 'arrays-lists',
            levelNumber: 3,
            translations: {
              ru: 'Массивы и списки',
              en: 'Arrays and Lists',
              hi: 'सरणियाँ और सूचियाँ',
              zh: '数组和列表'
            }
          },
          {
            slug: 'trees-graphs',
            levelNumber: 3,
            translations: {
              ru: 'Деревья и графы',
              en: 'Trees and Graphs',
              hi: 'पेड़ और ग्राफ',
              zh: '树和图'
            }
          }
        ]
      },
      {
        slug: 'databases',
        levelNumber: 2,
        translations: {
          ru: 'Базы данных',
          en: 'Databases',
          hi: 'डेटाबेस',
          zh: '数据库'
        },
        children: [
          {
            slug: 'sql-basics',
            levelNumber: 3,
            translations: {
              ru: 'Основы SQL',
              en: 'SQL Basics',
              hi: 'SQL की मूल बातें',
              zh: 'SQL基础'
            }
          },
          {
            slug: 'database-design',
            levelNumber: 3,
            translations: {
              ru: 'Проектирование БД',
              en: 'Database Design',
              hi: 'डेटाबेस डिज़ाइन',
              zh: '数据库设计'
            }
          }
        ]
      }
    ]
  },
  {
    slug: 'english',
    levelNumber: 1,
    translations: {
      ru: 'Английский',
      en: 'English',
      hi: 'अंग्रेज़ी',
      zh: '英语'
    },
    children: [
      {
        slug: 'grammar',
        levelNumber: 2,
        translations: {
          ru: 'Грамматика',
          en: 'Grammar',
          hi: 'व्याकरण',
          zh: '语法'
        },
        children: [
          {
            slug: 'tenses',
            levelNumber: 3,
            translations: {
              ru: 'Времена',
              en: 'Tenses',
              hi: 'काल',
              zh: '时态'
            }
          },
          {
            slug: 'articles',
            levelNumber: 3,
            translations: {
              ru: 'Артикли',
              en: 'Articles',
              hi: 'आर्टिकल',
              zh: '冠词'
            }
          }
        ]
      },
      {
        slug: 'vocabulary',
        levelNumber: 2,
        translations: {
          ru: 'Лексика',
          en: 'Vocabulary',
          hi: 'शब्दावली',
          zh: '词汇'
        },
        children: [
          {
            slug: 'phrasal-verbs',
            levelNumber: 3,
            translations: {
              ru: 'Фразовые глаголы',
              en: 'Phrasal Verbs',
              hi: 'फ्रेज़ल वर्ब',
              zh: '短语动词'
            }
          },
          {
            slug: 'idioms',
            levelNumber: 3,
            translations: {
              ru: 'Идиомы',
              en: 'Idioms',
              hi: 'मुहावरे',
              zh: '习语'
            }
          }
        ]
      },
      {
        slug: 'speaking',
        levelNumber: 2,
        translations: {
          ru: 'Разговорная речь',
          en: 'Speaking',
          hi: 'बोलना',
          zh: '口语'
        },
        children: [
          {
            slug: 'dialogues',
            levelNumber: 3,
            translations: {
              ru: 'Диалоги',
              en: 'Dialogues',
              hi: 'संवाद',
              zh: '对话'
            }
          },
          {
            slug: 'pronunciation',
            levelNumber: 3,
            translations: {
              ru: 'Произношение',
              en: 'Pronunciation',
              hi: 'उच्चारण',
              zh: '发音'
            }
          }
        ]
      },
      {
        slug: 'writing',
        levelNumber: 2,
        translations: {
          ru: 'Письмо',
          en: 'Writing',
          hi: 'लेखन',
          zh: '写作'
        },
        children: [
          {
            slug: 'essay-writing',
            levelNumber: 3,
            translations: {
              ru: 'Написание эссе',
              en: 'Essay Writing',
              hi: 'निबंध लेखन',
              zh: '作文写作'
            }
          },
          {
            slug: 'emails',
            levelNumber: 3,
            translations: {
              ru: 'Письма и email',
              en: 'Emails',
              hi: 'ईमेल और पत्र',
              zh: '邮件和书信'
            }
          }
        ]
      }
    ]
  }
]
const categoriesSecondPart: CategoryNode[] = [
  {
    slug: 'punctuation',
    levelNumber: 2,
    parentSlug: 'russian',
    translations: {
      ru: 'Пунктуация',
      en: 'Punctuation',
      hi: 'विराम चिह्न',
      zh: '标点符号'
    },
    children: [
      {
        slug: 'commas',
        levelNumber: 3,
        translations: {
          ru: 'Запятые',
          en: 'Commas',
          hi: 'अल्पविराम',
          zh: '逗号'
        }
      },
      {
        slug: 'colon',
        levelNumber: 3,
        translations: {
          ru: 'Двоеточие',
          en: 'Colon',
          hi: 'द्विबिंदु',
          zh: '冒号'
        }
      },
      {
        slug: 'dash',
        levelNumber: 3,
        translations: {
          ru: 'Тире',
          en: 'Dash',
          hi: 'डैश',
          zh: '破折号'
        }
      },
      {
        slug: 'quotation-marks',
        levelNumber: 3,
        translations: {
          ru: 'Кавычки',
          en: 'Quotation Marks',
          hi: 'उद्धरण चिह्न',
          zh: '引号'
        }
      }
    ]
  },
  {
    slug: 'text-analysis',
    levelNumber: 2,
    parentSlug: 'russian',
    translations: {
      ru: 'Анализ текста',
      en: 'Text Analysis',
      hi: 'पाठ विश्लेषण',
      zh: '文本分析'
    },
    children: [
      {
        slug: 'style-analysis',
        levelNumber: 3,
        translations: {
          ru: 'Стилистический анализ',
          en: 'Style Analysis',
          hi: 'शैली विश्लेषण',
          zh: '文体分析'
        }
      },
      {
        slug: 'text-structure',
        levelNumber: 3,
        translations: {
          ru: 'Структура текста',
          en: 'Text Structure',
          hi: 'पाठ संरचना',
          zh: '文本结构'
        }
      },
      {
        slug: 'main-idea',
        levelNumber: 3,
        translations: {
          ru: 'Главная мысль',
          en: 'Main Idea',
          hi: 'मुख्य विचार',
          zh: '中心思想'
        }
      },
      {
        slug: 'argumentation',
        levelNumber: 3,
        translations: {
          ru: 'Аргументация',
          en: 'Argumentation',
          hi: 'तर्क-वितर्क',
          zh: '论证'
        }
      }
    ]
  },

  {
    slug: 'prepositions',
    levelNumber: 2,
    parentSlug: 'english',
    translations: {
      ru: 'Предлоги',
      en: 'Prepositions',
      hi: 'पूर्वसर्ग',
      zh: '介词'
    },
    children: [
      {
        slug: 'time-prepositions',
        levelNumber: 3,
        translations: {
          ru: 'Предлоги времени',
          en: 'Time Prepositions',
          hi: 'समय के पूर्वसर्ग',
          zh: '时间介词'
        }
      },
      {
        slug: 'place-prepositions',
        levelNumber: 3,
        translations: {
          ru: 'Предлоги места',
          en: 'Place Prepositions',
          hi: 'स्थान के पूर्वसर्ग',
          zh: '地点介词'
        }
      }
    ]
  },
  {
    slug: 'pronouns',
    levelNumber: 2,
    parentSlug: 'english',
    translations: {
      ru: 'Местоимения',
      en: 'Pronouns',
      hi: 'सर्वनाम',
      zh: '代词'
    },
    children: [
      {
        slug: 'personal-pronouns',
        levelNumber: 3,
        translations: {
          ru: 'Личные местоимения',
          en: 'Personal Pronouns',
          hi: 'पुरुषवाचक सर्वनाम',
          zh: '人称代词'
        }
      },
      {
        slug: 'possessive-pronouns',
        levelNumber: 3,
        translations: {
          ru: 'Притяжательные местоимения',
          en: 'Possessive Pronouns',
          hi: 'स्वत्वबोधक सर्वनाम',
          zh: '物主代词'
        }
      }
    ]
  },
  {
    slug: 'modals',
    levelNumber: 2,
    parentSlug: 'english',
    translations: {
      ru: 'Модальные глаголы',
      en: 'Modal Verbs',
      hi: 'सहायक क्रियाएँ',
      zh: '情态动词'
    },
    children: [
      {
        slug: 'ability-modals',
        levelNumber: 3,
        translations: {
          ru: 'Способность и возможность',
          en: 'Ability and Possibility',
          hi: 'क्षमता और संभावना',
          zh: '能力和可能性'
        }
      },
      {
        slug: 'permission-modals',
        levelNumber: 3,
        translations: {
          ru: 'Разрешение',
          en: 'Permission',
          hi: 'अनुमति',
          zh: '许可'
        }
      }
    ]
  },
  {
    slug: 'reading',
    levelNumber: 2,
    parentSlug: 'english',
    translations: {
      ru: 'Чтение',
      en: 'Reading',
      hi: 'पठन',
      zh: '阅读'
    },
    children: [
      {
        slug: 'reading-comprehension',
        levelNumber: 3,
        translations: {
          ru: 'Понимание текста',
          en: 'Reading Comprehension',
          hi: 'पाठ बोध',
          zh: '阅读理解'
        }
      },
      {
        slug: 'exam-reading',
        levelNumber: 3,
        translations: {
          ru: 'Экзаменационное чтение',
          en: 'Exam Reading',
          hi: 'परीक्षा पठन',
          zh: '考试阅读'
        }
      }
    ]
  },
  {
    slug: 'listening',
    levelNumber: 2,
    parentSlug: 'english',
    translations: {
      ru: 'Аудирование',
      en: 'Listening',
      hi: 'श्रवण',
      zh: '听力'
    },
    children: [
      {
        slug: 'listening-comprehension',
        levelNumber: 3,
        translations: {
          ru: 'Понимание на слух',
          en: 'Listening Comprehension',
          hi: 'श्रवण बोध',
          zh: '听力理解'
        }
      },
      {
        slug: 'audio-exercises',
        levelNumber: 3,
        translations: {
          ru: 'Аудио-упражнения',
          en: 'Audio Exercises',
          hi: 'ऑडियो अभ्यास',
          zh: '音频练习'
        }
      }
    ]
  },

  {
    slug: 'cs-functions',
    levelNumber: 2,
    parentSlug: 'computer-science',
    translations: {
      ru: 'Функции',
      en: 'Functions',
      hi: 'फ़ंक्शन',
      zh: '函数'
    },
    children: [
      {
        slug: 'recursion',
        levelNumber: 3,
        translations: {
          ru: 'Рекурсия',
          en: 'Recursion',
          hi: 'पुनरावृत्ति',
          zh: '递归'
        }
      },
      {
        slug: 'parameters-returns',
        levelNumber: 3,
        translations: {
          ru: 'Параметры и возвращаемые значения',
          en: 'Parameters and Returns',
          hi: 'पैरामीटर और रिटर्न',
          zh: '参数और返回值'
        }
      }
    ]
  },
  {
    slug: 'complexity',
    levelNumber: 2,
    parentSlug: 'computer-science',
    translations: {
      ru: 'Сложность алгоритмов',
      en: 'Algorithm Complexity',
      hi: 'एल्गोरिदम जटिलता',
      zh: '算法复杂度'
    },
    children: [
      {
        slug: 'time-complexity',
        levelNumber: 3,
        translations: {
          ru: 'Временная сложность',
          en: 'Time Complexity',
          hi: 'समय जटिलता',
          zh: '时间复杂度'
        }
      },
      {
        slug: 'space-complexity',
        levelNumber: 3,
        translations: {
          ru: 'Памятная сложность',
          en: 'Space Complexity',
          hi: 'स्थान जटिलता',
          zh: '空间复杂度'
        }
      }
    ]
  },
  {
    slug: 'web-development',
    levelNumber: 2,
    parentSlug: 'computer-science',
    translations: {
      ru: 'Веб-разработка',
      en: 'Web Development',
      hi: 'वेब विकास',
      zh: '网页开发'
    },
    children: [
      {
        slug: 'html-css',
        levelNumber: 3,
        translations: {
          ru: 'HTML и CSS',
          en: 'HTML and CSS',
          hi: 'HTML और CSS',
          zh: 'HTML 和 CSS'
        }
      },
      {
        slug: 'javascript-basics',
        levelNumber: 3,
        translations: {
          ru: 'Основы JavaScript',
          en: 'JavaScript Basics',
          hi: 'JavaScript की मूल बातें',
          zh: 'JavaScript基础'
        }
      },
      {
        slug: 'api-design',
        levelNumber: 3,
        translations: {
          ru: 'Проектирование API',
          en: 'API Design',
          hi: 'API डिज़ाइन',
          zh: 'API设计'
        }
      }
    ]
  },
  {
    slug: 'cybersecurity',
    levelNumber: 2,
    parentSlug: 'computer-science',
    translations: {
      ru: 'Кибербезопасность',
      en: 'Cybersecurity',
      hi: 'साइबर सुरक्षा',
      zh: '网络安全'
    },
    children: [
      {
        slug: 'password-security',
        levelNumber: 3,
        translations: {
          ru: 'Безопасность паролей',
          en: 'Password Security',
          hi: 'पासवर्ड सुरक्षा',
          zh: '密码安全'
        }
      },
      {
        slug: 'phishing',
        levelNumber: 3,
        translations: {
          ru: 'Фишинг',
          en: 'Phishing',
          hi: 'फ़िशिंग',
          zh: '网络钓鱼'
        }
      },
      {
        slug: 'data-protection',
        levelNumber: 3,
        translations: {
          ru: 'Защита данных',
          en: 'Data Protection',
          hi: 'डेटा सुरक्षा',
          zh: '数据保护'
        }
      }
    ]
  }
]

async function main() {
  const createCategory = async (item: CategoryNode, parentId: string | null = null): Promise<void> => {
    const category = await prisma.category.create({
      data: {slug: item.slug, levelNumber: item.levelNumber, parentId}
    })

    await prisma.categoryTranslation.createMany({
      data: (Object.entries(item.translations) as [LangCode, string][]).map(([langCode, name]) => ({
        categoryId: category.id,
        langCode,
        name
      }))
    })

    for (const child of item.children ?? []) {
      await createCategory(child, category.id)
    }
  }

  for (const category of categoriesFirstPart) {
    await createCategory(category)
  }

  for (const category of categoriesSecondPart) {
    const parent = category.parentSlug
      ? await prisma.category.findUnique({where: {slug: category.parentSlug}, select: {id: true}})
      : null

    await createCategory(category, parent?.id ?? null)
  }
}
main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
