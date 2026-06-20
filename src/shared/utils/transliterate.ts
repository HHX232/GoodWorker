const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
  ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

// Minimal Devanagari (Hindi) → Latin mapping (common consonants/vowels)
const DEV: Record<string, string> = {
  'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
  'क':'k','ख':'kh','ग':'g','घ':'gh','च':'ch','छ':'chh','ज':'j','झ':'jh',
  'ट':'t','ठ':'th','ड':'d','ढ':'dh','त':'t','थ':'th','द':'d','ध':'dh',
  'न':'n','प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r',
  'ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
  'ा':'a','ि':'i','ी':'ee','ु':'u','ू':'oo','े':'e','ै':'ai','ो':'o','ौ':'au',
  '्':'','ं':'n','ः':'h',
}

function hasCyrillic(s: string) { return /[а-яёА-ЯЁ]/.test(s) }
function hasDevanagari(s: string) { return /[ऀ-ॿ]/.test(s) }
function hasLatin(s: string) { return /[a-zA-Z]/.test(s) }

function transliterateCyrillic(s: string): string {
  return s.split('').map(ch => {
    const lo = ch.toLowerCase()
    const mapped = CYR[lo]
    if (mapped === undefined) return ch
    if (ch === lo) return mapped
    return mapped ? mapped[0].toUpperCase() + mapped.slice(1) : ''
  }).join('')
}

function transliterateDevanagari(s: string): string {
  let result = ''
  for (let i = 0; i < s.length; i++) {
    result += DEV[s[i]] ?? s[i]
  }
  return result
}

export function getDisplayName(name: string, locale: string, nameTransliterated?: string | null): string {
  if (nameTransliterated) {
    try {
      const parsed = JSON.parse(nameTransliterated) as Record<string, string>
      if (parsed[locale]) return parsed[locale]
    } catch {
      // Legacy format: plain Latin string (old Cyrillic romanization)
      if (locale !== 'ru') return nameTransliterated
    }
  }
  if (locale === 'ru') return name
  if (hasCyrillic(name)) return transliterateCyrillic(name)
  if (locale === 'en' || locale === 'zh') {
    if (hasDevanagari(name)) return transliterateDevanagari(name)
  }
  return name
}

export function needsTranslit(name: string, locale: string, nameTransliterated?: string | null): boolean {
  if (nameTransliterated) {
    try {
      const parsed = JSON.parse(nameTransliterated) as Record<string, string>
      return !!(parsed[locale] && parsed[locale] !== name)
    } catch {
      return locale !== 'ru'
    }
  }
  if (locale === 'ru') return false
  if (hasCyrillic(name)) return true
  if ((locale === 'en' || locale === 'zh') && hasDevanagari(name)) return true
  return false
}
