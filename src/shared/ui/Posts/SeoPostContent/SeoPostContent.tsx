/* eslint-disable @typescript-eslint/no-explicit-any */
import {PostBlock, PostBlockType} from '@/shared/types/Post/Post.type'

interface Props {
  blocks: PostBlock[]
  title?: string
  authorName?: string
  authorId?: string
  publishedAt?: Date
  categoryName?: string
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

export function SeoPostContent({blocks, title, authorName, authorId, publishedAt, categoryName}: Props) {
  const firstImage = blocks.find(
    (b) => b.type === PostBlockType.MEDIA && (b.payload as any)?.kind === 'image'
  )
  const firstImageUrl = firstImage ? (firstImage.payload as any)?.url ?? null : null

  return (
    <article
      itemScope
      itemType='https://schema.org/Article'
      style={hidden}
      aria-hidden='true'
    >
      {title && <h1 itemProp='headline'>{title}</h1>}

      {authorName && (
        <div itemProp='author' itemScope itemType='https://schema.org/Person'>
          <span itemProp='name'>{authorName}</span>
          {authorId && <meta itemProp='url' content={`/users/${authorId}`} />}
        </div>
      )}

      {publishedAt && (
        <time itemProp='datePublished' dateTime={publishedAt.toISOString()}>
          {publishedAt.toLocaleDateString('ru-RU')}
        </time>
      )}

      {categoryName && <meta itemProp='articleSection' content={categoryName} />}

      {firstImageUrl && <meta itemProp='image' content={firstImageUrl} />}

      {blocks.map((block) => {
        switch (block.type) {
          case PostBlockType.TEXT: {
            const payload = block.payload as {content: any}
            const text = extractTextFromTiptap(payload.content)
            return text ? <p key={block.id} itemProp='text'>{text}</p> : null
          }

          case PostBlockType.MEDIA: {
            const payload = block.payload as {url: string | null; kind: string | null; caption: string | null}
            if (!payload.url) return null
            return payload.kind === 'image' ? (
              <figure key={block.id} itemProp='image' itemScope itemType='https://schema.org/ImageObject'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img itemProp='url' src={payload.url} alt={payload.caption ?? ''} />
                {payload.caption && <figcaption itemProp='caption'>{payload.caption}</figcaption>}
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
    </article>
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
