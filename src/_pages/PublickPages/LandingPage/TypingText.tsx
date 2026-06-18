'use client'
import { useEffect, useState } from 'react'

interface Props {
  phrases: string[]
  accent: string
  pauseMs?: number
}

export default function TypingText({ phrases, accent, pauseMs = 1800 }: Props) {
  const [text, setText] = useState('')
  const [idx, setIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const cur = phrases[idx]
    let to: ReturnType<typeof setTimeout>
    if (!deleting && text === cur) {
      to = setTimeout(() => setDeleting(true), pauseMs)
    } else if (deleting && text === '') {
      setDeleting(false)
      setIdx((idx + 1) % phrases.length)
    } else {
      const speed = deleting ? 22 : 48
      to = setTimeout(() => {
        setText(deleting ? cur.slice(0, text.length - 1) : cur.slice(0, text.length + 1))
      }, speed)
    }
    return () => clearTimeout(to)
  }, [text, deleting, idx, phrases, pauseMs])

  return (
    <span>
      {text}
      <span style={{
        display: 'inline-block', width: 2, height: '1em', marginLeft: 2,
        background: accent, verticalAlign: '-2px',
        animation: 'rd_caret 1s steps(2) infinite',
      }} />
    </span>
  )
}
