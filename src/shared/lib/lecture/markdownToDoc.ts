import { Lexer, type MarkedExtension, type Token, type Tokens } from 'marked'
import { parseBoardSpec } from './boardSpec'

// DeepSeek writes lecture notes as markdown plus four house extensions:
//   $…$            inline formula (LaTeX)        $$…$$   block formula
//   ==text==       highlight (yellow)            =={green}text==  highlight colour
//   {red|text}     coloured text
// This turns that into TipTap/ProseMirror JSON through a whitelist — no HTML
// from the model ever reaches the editor, so a phrase planted in the
// transcript can't inject markup. Prisma-free: the client may import it too.

export const TEXT_COLORS: Record<string, string> = {
  red: '#dc2626', orange: '#ea580c', green: '#16a34a', blue: '#2563eb', purple: '#7c3aed', gray: '#6b7280',
}
export const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#fef08a', green: '#bbf7d0', blue: '#bfdbfe', pink: '#fbcfe8', orange: '#fed7aa',
}

export interface PMMark { type: string; attrs?: Record<string, unknown> }
export interface PMNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  text?: string
  marks?: PMMark[]
}

const lecturedExtensions: MarkedExtension = {
  extensions: [
    {
      name: 'mathBlock',
      level: 'block',
      start: src => src.match(/^\$\$/m)?.index,
      tokenizer(src) {
        const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/.exec(src)
        if (m) return { type: 'mathBlock', raw: m[0], latex: m[1].trim() }
      },
    },
    {
      name: 'mathInline',
      level: 'inline',
      start: src => src.indexOf('$'),
      tokenizer(src) {
        const m = /^\$(?!\$)((?:\\\$|[^$\n])+?)\$/.exec(src)
        if (m) return { type: 'mathInline', raw: m[0], latex: m[1].trim() }
      },
    },
    {
      name: 'highlight',
      level: 'inline',
      start: src => src.indexOf('=='),
      tokenizer(src) {
        const m = /^==(?:\{([a-z]+)\})?([^=\n]+?)==/.exec(src)
        if (m) return { type: 'highlight', raw: m[0], color: m[1] ?? 'yellow', tokens: this.lexer.inlineTokens(m[2]) }
      },
    },
    {
      name: 'colored',
      level: 'inline',
      start: src => src.indexOf('{'),
      tokenizer(src) {
        const m = /^\{([a-z]+)\|([^}\n]+)\}/.exec(src)
        if (m && TEXT_COLORS[m[1]]) return { type: 'colored', raw: m[0], color: m[1], tokens: this.lexer.inlineTokens(m[2]) }
      },
    },
  ],
}

function lexer(): Lexer {
  // A fresh lexer per call: marked's global `use()` would leak these
  // extensions into every other markdown render in the app.
  return new Lexer({ gfm: true, breaks: false, extensions: buildExtensions() })
}

function buildExtensions() {
  const ext = { block: [] as unknown[], inline: [] as unknown[], startBlock: [] as unknown[], startInline: [] as unknown[], renderers: {}, childTokens: {} } as Record<string, unknown>
  for (const e of lecturedExtensions.extensions ?? []) {
    if (!('tokenizer' in e) || !e.tokenizer) continue
    ;(ext[e.level === 'block' ? 'block' : 'inline'] as unknown[]).push(e.tokenizer)
    if (e.start) (ext[e.level === 'block' ? 'startBlock' : 'startInline'] as unknown[]).push(e.start)
  }
  return ext as never
}

function withMark(nodes: PMNode[], mark: PMMark): PMNode[] {
  return nodes.map(n => (n.type === 'text' ? { ...n, marks: [...(n.marks ?? []), mark] } : n))
}

function inline(tokens: Token[] | undefined): PMNode[] {
  const out: PMNode[] = []
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'text':
      case 'escape':
        if ('tokens' in t && t.tokens?.length) out.push(...inline(t.tokens))
        else if (t.text) out.push({ type: 'text', text: decode(t.text) })
        break
      case 'strong': out.push(...withMark(inline((t as Tokens.Strong).tokens), { type: 'bold' })); break
      case 'em': out.push(...withMark(inline((t as Tokens.Em).tokens), { type: 'italic' })); break
      case 'del': out.push(...withMark(inline((t as Tokens.Del).tokens), { type: 'strike' })); break
      case 'codespan': out.push({ type: 'text', text: decode((t as Tokens.Codespan).text), marks: [{ type: 'code' }] }); break
      case 'br': out.push({ type: 'hardBreak' }); break
      case 'link': out.push(...inline((t as Tokens.Link).tokens)); break // links from the model are dropped to their text
      case 'mathInline': out.push({ type: 'mathInline', attrs: { latex: (t as unknown as { latex: string }).latex } }); break
      case 'highlight': {
        const color = HIGHLIGHT_COLORS[(t as unknown as { color: string }).color] ?? HIGHLIGHT_COLORS.yellow
        out.push(...withMark(inline((t as unknown as { tokens: Token[] }).tokens), { type: 'highlight', attrs: { color } }))
        break
      }
      case 'colored': {
        const color = TEXT_COLORS[(t as unknown as { color: string }).color]
        out.push(...withMark(inline((t as unknown as { tokens: Token[] }).tokens), { type: 'textStyle', attrs: { color } }))
        break
      }
      default:
        // html, image and anything unexpected: keep only the visible text.
        if ('text' in t && typeof t.text === 'string' && t.text.trim() && t.type !== 'html') out.push({ type: 'text', text: decode(t.text) })
    }
  }
  return out.filter(n => n.type !== 'text' || !!n.text)
}

function paragraph(content: PMNode[]): PMNode {
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function blocks(tokens: Token[]): PMNode[] {
  const out: PMNode[] = []
  for (const t of tokens) {
    switch (t.type) {
      case 'heading': out.push({ type: 'heading', attrs: { level: Math.min(Math.max((t as Tokens.Heading).depth, 2), 4) }, content: inline((t as Tokens.Heading).tokens) }); break
      case 'paragraph': out.push(paragraph(inline((t as Tokens.Paragraph).tokens))); break
      case 'text': out.push(paragraph(inline((t as Tokens.Text).tokens ?? [{ type: 'text', raw: t.raw, text: (t as Tokens.Text).text } as Token]))); break
      case 'list': {
        const list = t as Tokens.List
        out.push({
          type: list.ordered ? 'orderedList' : 'bulletList',
          content: list.items.map(item => {
            const inner = blocks(item.tokens)
            return { type: 'listItem', content: inner.length && inner[0].type === 'paragraph' ? inner : [paragraph([]), ...inner] }
          }),
        })
        break
      }
      case 'blockquote': out.push({ type: 'blockquote', content: blocks((t as Tokens.Blockquote).tokens) }); break
      case 'code': {
        const code = t as Tokens.Code
        // ```board {spec}``` — a whiteboard block (3D figure + given values).
        if (code.lang?.trim() === 'board') {
          let spec = null
          try { spec = parseBoardSpec(JSON.parse(code.text)) } catch { spec = null }
          if (spec) { out.push({ type: 'boardBlock', attrs: { spec } }); break }
        }
        out.push({ type: 'codeBlock', content: code.text ? [{ type: 'text', text: code.text }] : undefined })
        break
      }
      case 'hr': out.push({ type: 'horizontalRule' }); break
      case 'mathBlock': out.push({ type: 'mathBlock', attrs: { latex: (t as unknown as { latex: string }).latex } }); break
      case 'table': {
        // Tables become one paragraph per row — the lecture editor has no table node.
        const tb = t as Tokens.Table
        for (const row of [tb.header, ...tb.rows]) out.push(paragraph(row.flatMap((c, i) => [...(i ? [{ type: 'text', text: ' | ' }] : []), ...inline(c.tokens)])))
        break
      }
      case 'space': break
      default:
        if ('text' in t && typeof t.text === 'string' && t.text.trim() && t.type !== 'html') out.push(paragraph([{ type: 'text', text: decode(t.text) }]))
    }
  }
  return out
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
function decode(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, m => ENTITIES[m] ?? m)
}

/** Markdown (house dialect) → a list of TipTap block nodes. */
export function markdownToBlocks(markdown: string): PMNode[] {
  return blocks(lexer().lex(markdown.replace(/\r\n?/g, '\n')))
}

/** Plain text of a ProseMirror JSON subtree — for DeepSeek context and search. */
export function nodeText(node: PMNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'mathInline') return `$${node.attrs?.latex ?? ''}$`
  if (node.type === 'mathBlock') return `\n$$${node.attrs?.latex ?? ''}$$\n`
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'boardBlock') return '\n[доска]\n'
  const inner = (node.content ?? []).map(nodeText).join('')
  return ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(node.type) ? `${inner}\n` : inner
}
