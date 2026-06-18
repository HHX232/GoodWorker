'use client'
import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  type NodeTypes,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  MapIcon, TextCursorIcon, NotebookPen, LayoutGridIcon,
  PaperclipIcon, ImageIcon, Volume2Icon, CheckCircle2Icon,
  DownloadIcon,
} from 'lucide-react'

// ── Visual constants matching real NodeCard ──────────────────────
const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e2e9',
  borderRadius: 14,
  minWidth: 220,
  maxWidth: 240,
  boxShadow: '0 1px 4px rgba(14,14,18,0.06)',
  overflow: 'hidden',
  fontSize: 13,
  color: '#0e0e12',
}

const HANDLE_STYLE: React.CSSProperties = {
  width: 10, height: 10, borderRadius: '50%',
  border: '2px solid #fff',
  background: '#a0a0aa',
}

function NodeHeader({ label, Icon, color }: { label: string; Icon: React.FC<{size?: number; color?: string}>; color?: string }) {
  const isDark = !color || color === '#141416' || color === '#0e0e12'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: color || '#f7f7fa',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
    }}>
      <Icon size={14} color={isDark && color ? '#fff' : '#0e0e12'} />
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: isDark && color ? '#fff' : '#0e0e12',
      }}>{label}</span>
    </div>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 12px', fontSize: 13 }}>{children}</div>
}

// ── ENTRY POINT ──────────────────────────────────────────────────
function EntryNode() {
  return (
    <div style={CARD}>
      <NodeHeader label="Точка входа" Icon={MapIcon} color="#141416" />
      <Body>
        <div style={{ fontSize: 12, color: '#8c8c98', lineHeight: 1.5 }}>
          Начало курса — все блоки соединяются отсюда
        </div>
      </Body>
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

// ── INFO TEXT ────────────────────────────────────────────────────
function TextNode({ data }: { data: { title: string; preview: string } }) {
  return (
    <div style={CARD}>
      <NodeHeader label="Текст" Icon={TextCursorIcon} />
      <Body>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.title}</div>
        <div style={{ fontSize: 12, color: '#8c8c98', lineHeight: 1.5 }}>{data.preview}</div>
      </Body>
      <Handle type="target" position={Position.Left}  style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

// ── INFO MEDIA ───────────────────────────────────────────────────
function MediaNode({ data }: { data: { title: string } }) {
  return (
    <div style={CARD}>
      <NodeHeader label="Медиа" Icon={ImageIcon} color="#f0f9ff" />
      <Body>
        <div style={{
          height: 56, borderRadius: 8, background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
        }}>
          <ImageIcon size={22} color="#0ea5e9" />
        </div>
        <div style={{ fontWeight: 600, fontSize: 12 }}>{data.title}</div>
      </Body>
      <Handle type="target" position={Position.Left}  style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

// ── ACTIVE TEST — interactive checkboxes ────────────────────────
const TEST_OPTIONS = ['JSX — это синтаксис JS', 'Компиляция в createElement', 'Только для React Native']
const TEST_CORRECT = [0, 1]

function TestNode({ data }: { data: { title: string; count: number } }) {
  const [checked, setChecked] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)

  const toggle = (i: number) => {
    if (submitted) return
    setChecked(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }
  const submit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSubmitted(true)
  }
  const reset = (e: React.MouseEvent) => {
    e.stopPropagation()
    setChecked([]); setSubmitted(false)
  }

  const score = submitted
    ? checked.filter(i => TEST_CORRECT.includes(i)).length === TEST_CORRECT.length
      && checked.length === TEST_CORRECT.length
    : null

  return (
    <div style={{ ...CARD, borderColor: '#ED0606' }}>
      <NodeHeader label="Тест" Icon={NotebookPen} color="#ED0606" />
      <Body>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12, lineHeight: 1.4 }}>{data.title}</div>

        {TEST_OPTIONS.map((opt, i) => {
          const on = checked.includes(i)
          const isRight = TEST_CORRECT.includes(i)
          const bg = submitted
            ? on && isRight ? '#dcfce7' : on && !isRight ? '#fee2e2' : !on && isRight ? '#fef9c3' : '#fff'
            : on ? '#fdf2f8' : '#fff'
          const borderColor = submitted
            ? on && isRight ? '#16a34a' : on && !isRight ? '#dc2626' : !on && isRight ? '#ca8a04' : '#d8d8e0'
            : on ? '#ED0606' : '#e2e2e9'

          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              onPointerDown={e => e.stopPropagation()}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                marginTop: 5, padding: '5px 7px', borderRadius: 7, cursor: submitted ? 'default' : 'pointer',
                border: `1.5px solid ${borderColor}`, background: bg,
                font: 'inherit', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{
                width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                border: `1.5px solid ${borderColor}`,
                background: on ? (submitted ? (isRight ? '#16a34a' : '#dc2626') : '#ED0606') : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {on && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><path d="M20 6 9 17l-5-5"/></svg>}
              </span>
              <span style={{ fontSize: 11, lineHeight: 1.3, color: '#0e0e12' }}>{opt}</span>
            </button>
          )
        })}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: '#ED0606', fontWeight: 600 }}>{data.count} вопросов</span>
          {!submitted
            ? (
              <button
                onClick={submit}
                onPointerDown={e => e.stopPropagation()}
                style={{
                  fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 6,
                  background: '#ED0606', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >Ответить</button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: score ? '#16a34a' : '#dc2626' }}>
                  {score ? '✓ Верно!' : '✗ Ошибка'}
                </span>
                <button
                  onClick={reset}
                  onPointerDown={e => e.stopPropagation()}
                  style={{
                    fontSize: 10, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid #d8d8e0', background: '#fff', color: '#666',
                  }}
                >↺</button>
              </div>
            )
          }
        </div>
      </Body>
      <Handle type="target" position={Position.Left}  style={{ ...HANDLE_STYLE, background: '#ED0606' }} />
      <Handle type="source" position={Position.Right} style={{ ...HANDLE_STYLE, background: '#ED0606' }} />
    </div>
  )
}

// ── POST LINK ────────────────────────────────────────────────────
function PostNode({ data }: { data: { title: string } }) {
  return (
    <div style={CARD}>
      <NodeHeader label="Пост" Icon={LayoutGridIcon} color="#faf5ff" />
      <Body>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.title}</div>
        <div style={{ fontSize: 11, color: '#8c8c98' }}>Ссылка на пост в ленте</div>
      </Body>
      <Handle type="target" position={Position.Left}  style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

// ── FILE LINK ────────────────────────────────────────────────────
function FileNode({ data }: { data: { title: string; ext: string } }) {
  const [installing, setInstalling] = useState(false)
  const [done, setDone] = useState(false)

  const handleInstall = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (done) return
    setInstalling(true)
    setTimeout(() => { setInstalling(false); setDone(true) }, 1400)
  }

  return (
    <div style={CARD}>
      <NodeHeader label="Файл" Icon={PaperclipIcon} color="#fffbeb" />
      <Body>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{
              padding: '3px 7px', borderRadius: 6, background: '#fef3c7', flexShrink: 0,
              border: '1px solid #fde68a', fontSize: 10, fontWeight: 700, color: '#92400e',
            }}>{data.ext}</span>
            <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.title}</span>
          </div>
          <button
            onClick={handleInstall}
            onPointerDown={e => e.stopPropagation()}
            title={done ? 'Установлено' : 'Скачать'}
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8,
              border: `1.5px solid ${done ? '#16a34a' : '#e2e2e9'}`,
              background: done ? '#dcfce7' : '#fff',
              cursor: done ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {installing ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                </path>
              </svg>
            ) : done ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            ) : (
              <DownloadIcon size={12} color="#8c8c98" />
            )}
          </button>
        </div>
        {installing && (
          <div style={{ marginTop: 8, height: 3, background: '#e2e2e9', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#ca8a04', borderRadius: 2,
              animation: 'fileProgress 1.4s ease-in-out forwards',
            }}/>
          </div>
        )}
        <style>{`@keyframes fileProgress { from { width: 0% } to { width: 100% } }`}</style>
      </Body>
      <Handle type="target" position={Position.Left}  style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

// ── DONE ─────────────────────────────────────────────────────────
function DoneNode() {
  return (
    <div style={{ ...CARD, borderColor: '#16a34a' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', background: '#16a34a',
      }}>
        <CheckCircle2Icon size={16} color="#fff" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Курс пройден</span>
      </div>
      <Handle type="target" position={Position.Left} style={{ ...HANDLE_STYLE, background: '#16a34a' }} />
    </div>
  )
}

// ── AUDIO ────────────────────────────────────────────────────────
function AudioNode({ data }: { data: { title: string; duration: string } }) {
  return (
    <div style={CARD}>
      <NodeHeader label="Аудио" Icon={Volume2Icon} color="#f0fdf4" />
      <Body>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
          background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0',
        }}>
          <button style={{
            width: 28, height: 28, borderRadius: '50%', border: 'none',
            background: '#16a34a', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{data.title}</div>
            <div style={{ fontSize: 10, color: '#8c8c98', fontFamily: 'JetBrains Mono, monospace' }}>{data.duration}</div>
          </div>
        </div>
      </Body>
      <Handle type="target" position={Position.Left}  style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  entry:  EntryNode  as NodeTypes[string],
  text:   TextNode   as NodeTypes[string],
  media:  MediaNode  as NodeTypes[string],
  test:   TestNode   as NodeTypes[string],
  post:   PostNode   as NodeTypes[string],
  file:   FileNode   as NodeTypes[string],
  audio:  AudioNode  as NodeTypes[string],
  done:   DoneNode   as NodeTypes[string],
}

const initNodes: Node[] = [
  { id: '1', type: 'entry', position: { x: 0,   y: 160 }, data: {} },
  { id: '2', type: 'text',  position: { x: 280, y: 20  }, data: { title: 'Введение в React', preview: 'Что такое JSX, компоненты и props...' } },
  { id: '3', type: 'media', position: { x: 280, y: 180 }, data: { title: 'Видео: Hello World' } },
  { id: '4', type: 'file',  position: { x: 280, y: 330 }, data: { title: 'Шпаргалка по хукам', ext: 'PDF' } },
  { id: '5', type: 'post',  position: { x: 570, y: 20  }, data: { title: 'React Flow на практике' } },
  { id: '6', type: 'audio', position: { x: 570, y: 180 }, data: { title: 'Разбор кода урока', duration: '12:34' } },
  { id: '7', type: 'test',  position: { x: 570, y: 335 }, data: { title: 'Тест: Основы React', count: 10 } },
  { id: '8', type: 'done',  position: { x: 860, y: 205 }, data: {} },
]

const E = (id: string, s: string, t: string, animated = false): Edge => ({
  id, source: s, target: t, type: 'smoothstep', animated,
  style: { stroke: animated ? '#ED0606' : '#d0d0dc', strokeWidth: animated ? 2 : 1.5 },
})

const initEdges: Edge[] = [
  E('e1-2','1','2'), E('e1-3','1','3'), E('e1-4','1','4'),
  E('e2-5','2','5'), E('e3-6','3','6'), E('e4-7','4','7'),
  E('e5-8','5','8', true), E('e6-8','6','8', true), E('e7-8','7','8', true),
]

export default function CourseFlow() {
  const [nodes, , onNodesChange] = useNodesState(initNodes)
  const [edges, , onEdgesChange] = useEdgesState(initEdges)
  const onInit = useCallback(() => {}, [])

  return (
    <div style={{ border: '1px solid #ececf2', borderRadius: 18, overflow: 'hidden', background: '#fff', height: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #ececf2' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0e0e12' }}>Конструктор курса</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#ED0606',
          background: 'rgba(237,6,6,0.08)', padding: '3px 7px', borderRadius: 999, letterSpacing: '0.05em',
        }}>REACT FLOW</span>
      </div>
      <div style={{ height: 432 }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onInit={onInit} nodeTypes={nodeTypes}
          fitView fitViewOptions={{ padding: 0.15 }}
          nodesDraggable nodesConnectable={false}
          elementsSelectable panOnDrag zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#e6e6ec" />
        </ReactFlow>
      </div>
    </div>
  )
}
