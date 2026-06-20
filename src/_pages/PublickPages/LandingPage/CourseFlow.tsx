'use client'
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useThemeCtx } from '@/app/providers/ThemeContext'
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

const cardStyle = (isDark: boolean): React.CSSProperties => ({
  background: isDark ? '#15161e' : '#fff',
  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e2e9',
  borderRadius: 14,
  minWidth: 220,
  maxWidth: 240,
  boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.4)' : '0 1px 4px rgba(14,14,18,0.06)',
  overflow: 'hidden',
  fontSize: 13,
  color: isDark ? '#d8dae8' : '#0e0e12',
})

const handleStyle = (isDark: boolean): React.CSSProperties => ({
  width: 10, height: 10, borderRadius: '50%',
  border: isDark ? '2px solid #15161e' : '2px solid #fff',
  background: isDark ? '#5a5a74' : '#a0a0aa',
})

function NodeHeader({ label, Icon, color, themeDark }: { label: string; Icon: React.FC<{size?: number; color?: string}>; color?: string; themeDark?: boolean }) {
  const isBg = !color || color === '#141416' || color === '#0e0e12' || color === '#ED0606'
  const lightHeader = color || (themeDark ? '#1e2030' : '#f7f7fa')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: lightHeader,
      borderBottom: themeDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
    }}>
      <Icon size={14} color={(isBg && color) ? '#fff' : (themeDark ? '#9ea4b5' : '#0e0e12')} />
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: (isBg && color) ? '#fff' : (themeDark ? '#9ea4b5' : '#0e0e12'),
      }}>{label}</span>
    </div>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 12px', fontSize: 13 }}>{children}</div>
}

function EntryNode() {
  const t = useTranslations('CourseFlow')
  const { isDark } = useThemeCtx()
  return (
    <div style={cardStyle(isDark)}>
      <NodeHeader label={t('entry_label')} Icon={MapIcon} color="#141416" themeDark={isDark} />
      <Body>
        <div style={{ fontSize: 12, color: isDark ? 'rgba(200,202,215,0.55)' : '#8c8c98', lineHeight: 1.5 }}>
          {t('entry_desc')}
        </div>
      </Body>
      <Handle type="source" position={Position.Right} style={handleStyle(isDark)} />
    </div>
  )
}

function TextNode({ data }: { data: { title: string; preview: string } }) {
  const t = useTranslations('CourseFlow')
  const { isDark } = useThemeCtx()
  return (
    <div style={cardStyle(isDark)}>
      <NodeHeader label={t('text_label')} Icon={TextCursorIcon} themeDark={isDark} />
      <Body>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.title}</div>
        <div style={{ fontSize: 12, color: isDark ? 'rgba(200,202,215,0.55)' : '#8c8c98', lineHeight: 1.5 }}>{data.preview}</div>
      </Body>
      <Handle type="target" position={Position.Left}  style={handleStyle(isDark)} />
      <Handle type="source" position={Position.Right} style={handleStyle(isDark)} />
    </div>
  )
}

function MediaNode({ data }: { data: { title: string } }) {
  const t = useTranslations('CourseFlow')
  const { isDark } = useThemeCtx()
  return (
    <div style={cardStyle(isDark)}>
      <NodeHeader label={t('media_label')} Icon={ImageIcon} color={isDark ? '#1e2436' : '#f0f9ff'} themeDark={isDark} />
      <Body>
        <div style={{
          width: '100%', height: 70, borderRadius: 8,
          background: isDark ? 'linear-gradient(135deg, #1e2436, #1e2030)' : 'linear-gradient(135deg, #dbeafe, #e0e7ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 8,
        }}>
          <ImageIcon size={22} color={isDark ? '#6366f1' : '#6366f1'} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 12 }}>{data.title}</div>
      </Body>
      <Handle type="target" position={Position.Left}  style={handleStyle(isDark)} />
      <Handle type="source" position={Position.Right} style={handleStyle(isDark)} />
    </div>
  )
}

const TEST_CORRECT = [0, 1]

function TestNode({ data }: { data: { title: string; count: number } }) {
  const t = useTranslations('CourseFlow')
  const { isDark } = useThemeCtx()
  const TEST_OPTIONS = [t('test_opt1'), t('test_opt2'), t('test_opt3')]

  const [checked, setChecked] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)

  const toggle = (i: number) => {
    if (submitted) return
    setChecked(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }
  const submit = (e: React.MouseEvent) => { e.stopPropagation(); setSubmitted(true) }
  const reset  = (e: React.MouseEvent) => { e.stopPropagation(); setChecked([]); setSubmitted(false) }

  const score = submitted
    ? checked.filter(i => TEST_CORRECT.includes(i)).length === TEST_CORRECT.length
      && checked.length === TEST_CORRECT.length
    : null

  return (
    <div style={{ ...cardStyle(isDark), borderColor: isDark ? 'rgba(237,6,6,0.35)' : 'rgba(237,6,6,0.45)' }}>
      <NodeHeader label={t('test_label')} Icon={NotebookPen} color={isDark ? 'rgba(237,6,6,0.7)' : '#ED0606'} themeDark={isDark} />
      <Body>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12, lineHeight: 1.4 }}>{data.title}</div>

        {TEST_OPTIONS.map((opt, i) => {
          const on = checked.includes(i)
          const isRight = TEST_CORRECT.includes(i)
          const bg = submitted
            ? on && isRight ? '#dcfce7' : on && !isRight ? '#fee2e2' : !on && isRight ? '#fef9c3' : (isDark ? '#1e2030' : '#fff')
            : on ? (isDark ? '#2a1520' : '#fdf2f8') : (isDark ? '#1e2030' : '#fff')
          const borderColor = submitted
            ? on && isRight ? '#16a34a' : on && !isRight ? '#dc2626' : !on && isRight ? '#ca8a04' : '#d8d8e0'
            : on ? '#ED0606' : '#e2e2e9'

          return (
            <button key={i} onClick={() => toggle(i)} onPointerDown={e => e.stopPropagation()}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                marginTop: 5, padding: '5px 7px', borderRadius: 7, cursor: submitted ? 'default' : 'pointer',
                border: `1.5px solid ${borderColor}`, background: bg,
                font: 'inherit', textAlign: 'left', transition: 'all 0.15s',
              }}>
              <span style={{
                width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                border: `1.5px solid ${borderColor}`,
                background: on ? (submitted ? (isRight ? '#16a34a' : '#dc2626') : '#ED0606') : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}>
                {on && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><path d="M20 6 9 17l-5-5"/></svg>}
              </span>
              <span style={{ fontSize: 11, lineHeight: 1.3, color: isDark ? '#c8cad8' : '#0e0e12' }}>{opt}</span>
            </button>
          )
        })}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: '#ED0606', fontWeight: 600 }}>{data.count} {t('test_questions')}</span>
          {!submitted ? (
            <button onClick={submit} onPointerDown={e => e.stopPropagation()}
              style={{ fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 6, background: '#ED0606', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {t('test_submit')}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: score ? '#16a34a' : '#dc2626' }}>
                {score ? t('test_correct') : t('test_wrong')}
              </span>
              <button onClick={reset} onPointerDown={e => e.stopPropagation()}
                style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d8d8e0'}`, background: isDark ? '#1e2030' : '#fff', color: isDark ? '#9ea4b5' : '#666' }}>↺</button>
            </div>
          )}
        </div>
      </Body>
      <Handle type="target" position={Position.Left}  style={{ ...handleStyle(isDark), background: '#ED0606' }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle(isDark), background: '#ED0606' }} />
    </div>
  )
}

function PostNode({ data }: { data: { title: string } }) {
  const t = useTranslations('CourseFlow')
  const { isDark } = useThemeCtx()
  return (
    <div style={cardStyle(isDark)}>
      <NodeHeader label={t('post_label')} Icon={LayoutGridIcon} color={isDark ? '#1e1a2e' : '#faf5ff'} themeDark={isDark} />
      <Body>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.title}</div>
        <div style={{ fontSize: 11, color: isDark ? 'rgba(200,202,215,0.55)' : '#8c8c98' }}>{t('post_desc')}</div>
      </Body>
      <Handle type="target" position={Position.Left}  style={handleStyle(isDark)} />
      <Handle type="source" position={Position.Right} style={handleStyle(isDark)} />
    </div>
  )
}

function FileNode({ data }: { data: { title: string; ext: string } }) {
  const t = useTranslations('CourseFlow')
  const { isDark } = useThemeCtx()
  const [installing, setInstalling] = useState(false)
  const [done, setDone] = useState(false)

  const handleInstall = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (done) return
    setInstalling(true)
    setTimeout(() => { setInstalling(false); setDone(true) }, 1400)
  }

  return (
    <div style={cardStyle(isDark)}>
      <NodeHeader label={t('file_label')} Icon={PaperclipIcon} color={isDark ? '#1e1c10' : '#fffbeb'} themeDark={isDark} />
      <Body>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{
              padding: '3px 7px', borderRadius: 6,
              background: isDark ? '#2a2410' : '#fef3c7', flexShrink: 0,
              border: `1px solid ${isDark ? '#4a3a10' : '#fde68a'}`,
              fontSize: 10, fontWeight: 700, color: isDark ? '#d4a017' : '#92400e',
            }}>{data.ext}</span>
            <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.title}</span>
          </div>
          <button onClick={handleInstall} onPointerDown={e => e.stopPropagation()}
            title={done ? t('file_installed') : t('file_download')}
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8,
              border: `1.5px solid ${done ? '#16a34a' : (isDark ? 'rgba(255,255,255,0.12)' : '#e2e2e9')}`,
              background: done ? '#dcfce7' : (isDark ? '#1e2030' : '#fff'),
              cursor: done ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
            }}>
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
              <DownloadIcon size={12} color={isDark ? '#6a6a84' : '#8c8c98'} />
            )}
          </button>
        </div>
        {installing && (
          <div style={{ marginTop: 8, height: 3, background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e2e9', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#ca8a04', borderRadius: 2, animation: 'fileProgress 1.4s ease-in-out forwards' }}/>
          </div>
        )}
        <style>{`@keyframes fileProgress { from { width: 0% } to { width: 100% } }`}</style>
      </Body>
      <Handle type="target" position={Position.Left}  style={handleStyle(isDark)} />
      <Handle type="source" position={Position.Right} style={handleStyle(isDark)} />
    </div>
  )
}

function DoneNode() {
  const t = useTranslations('CourseFlow')
  const { isDark } = useThemeCtx()
  return (
    <div style={{ ...cardStyle(isDark), borderColor: '#16a34a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#16a34a' }}>
        <CheckCircle2Icon size={16} color="#fff" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t('done_label')}</span>
      </div>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle(isDark), background: '#16a34a' }} />
    </div>
  )
}

function AudioNode({ data }: { data: { title: string; duration: string } }) {
  const t = useTranslations('CourseFlow')
  const { isDark } = useThemeCtx()
  return (
    <div style={cardStyle(isDark)}>
      <NodeHeader label={t('audio_label')} Icon={Volume2Icon} color={isDark ? '#0e1e14' : '#f0fdf4'} themeDark={isDark} />
      <Body>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
          background: isDark ? '#0e1e14' : '#f0fdf4', borderRadius: 8,
          border: isDark ? '1px solid rgba(22,163,74,0.25)' : '1px solid #bbf7d0',
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
            <div style={{ fontSize: 10, color: isDark ? 'rgba(200,202,215,0.45)' : '#8c8c98', fontFamily: 'JetBrains Mono, monospace' }}>{data.duration}</div>
          </div>
        </div>
      </Body>
      <Handle type="target" position={Position.Left}  style={handleStyle(isDark)} />
      <Handle type="source" position={Position.Right} style={handleStyle(isDark)} />
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

export default function CourseFlow() {
  const t = useTranslations('CourseFlow')
  const { isDark } = useThemeCtx()

  const E = (id: string, s: string, target: string, animated = false): Edge => ({
    id, source: s, target, type: 'smoothstep', animated,
    style: { stroke: animated ? '#ED0606' : (isDark ? 'rgba(255,255,255,0.15)' : '#d0d0dc'), strokeWidth: animated ? 2 : 1.5 },
  })

  const initEdges: Edge[] = [
    E('e1-2','1','2'), E('e1-3','1','3'), E('e1-4','1','4'),
    E('e2-5','2','5'), E('e3-6','3','6'), E('e4-7','4','7'),
    E('e5-8','5','8', true), E('e6-8','6','8', true), E('e7-8','7','8', true),
  ]

  const initNodes: Node[] = [
    { id: '1', type: 'entry', position: { x: 0,   y: 160 }, data: {} },
    { id: '2', type: 'text',  position: { x: 280, y: 20  }, data: { title: t('n_text_title'),  preview: t('n_text_preview') } },
    { id: '3', type: 'media', position: { x: 280, y: 180 }, data: { title: t('n_media_title') } },
    { id: '4', type: 'file',  position: { x: 280, y: 330 }, data: { title: t('n_file_title'),  ext: 'PDF' } },
    { id: '5', type: 'post',  position: { x: 570, y: 20  }, data: { title: t('n_post_title') } },
    { id: '6', type: 'audio', position: { x: 570, y: 180 }, data: { title: t('n_audio_title'), duration: '12:34' } },
    { id: '7', type: 'test',  position: { x: 570, y: 335 }, data: { title: t('n_test_title'),  count: 10 } },
    { id: '8', type: 'done',  position: { x: 860, y: 205 }, data: {} },
  ]

  const [nodes, , onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  const onInit = useCallback(() => {}, [])

  useEffect(() => {
    setEdges(initEdges)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark])

  return (
    <div style={{ border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #ececf2', borderRadius: 18, overflow: 'hidden', background: isDark ? '#0e0e12' : '#fff', height: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #ececf2' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#e0e2ec' : '#0e0e12' }}>{t('header')}</span>
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
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={isDark ? '#252838' : '#e6e6ec'} />
        </ReactFlow>
      </div>
    </div>
  )
}
