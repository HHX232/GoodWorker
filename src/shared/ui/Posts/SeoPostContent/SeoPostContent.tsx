/* eslint-disable @typescript-eslint/no-explicit-any */
import {PostBlock, PostBlockType} from '@/shared/types/Post/Post.type'

interface Props {
  blocks: PostBlock[]
}

const hidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  opacity: 0,
  pointerEvents: 'none',
  userSelect: 'none'
}

export function SeoPostContent({blocks}: Props) {
  return (
    <div style={hidden} aria-hidden='true'>
      {blocks.map((block) => {
        switch (block.type) {
          case PostBlockType.TEXT: {
            const payload = block.payload as {content: any}
            const text = extractTextFromTiptap(payload.content)
            return text ? <p key={block.id}>{text}</p> : null
          }

          case PostBlockType.MEDIA: {
            const payload = block.payload as {url: string | null; kind: string | null; caption: string | null}
            if (!payload.url) return null
            return payload.kind === 'image' ? (
              <figure key={block.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={payload.url} alt={payload.caption ?? ''} />
                {payload.caption && <figcaption>{payload.caption}</figcaption>}
              </figure>
            ) : (
              <figure key={block.id}>
                <video src={payload.url} />
                {payload.caption && <figcaption>{payload.caption}</figcaption>}
              </figure>
            )
          }

          case PostBlockType.AUDIO: {
            const payload = block.payload as {url: string | null; filename: string | null}
            if (!payload.url) return null
            return (
              <figure key={block.id}>
                <audio src={payload.url} />
                {payload.filename && <figcaption>{payload.filename}</figcaption>}
              </figure>
            )
          }

          case PostBlockType.TEST_LINK: {
            const payload = block.payload as {testId: string | null; title: string | null}
            if (!payload.title) return null
            return <p key={block.id}>{payload.title}</p>
          }

          default:
            return null
        }
      })}
    </div>
  )
}

function extractTextFromTiptap(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (Array.isArray(node.content)) {
    return node.content.map(extractTextFromTiptap).join(' ')
  }
  return ''
}
