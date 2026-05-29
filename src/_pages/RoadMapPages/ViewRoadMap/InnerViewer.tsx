'use client'
import React from 'react'
import {useRoadmapAccess} from '@/features/hooks/Roadmap/useRoadmapAccess'
import {RoadmapNodeAccessType} from '@/features/services/RoadmapService.service'
import {RoadmapAccessContext} from '@/shared/ui/RoadMap/context/RoadmapAccessContext'
import {ViewModeContext} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {PurchaseAccessModal} from '@/shared/ui/RoadMap/PurchaseAccessModal/PurchaseAccessModal'
import {RoadmapReviewBar} from '@/shared/ui/RoadMap/RoadmapReviewBar/RoadmapReviewBar'
import {RoadmapStatsModal} from '@/shared/ui/RoadMap/RoadmapStatsModal/RoadmapStatsModal'
import {useLocale, useTranslations} from 'next-intl'
import Link from 'next/link'
import DeletableEdge from '@/widgets/RoadMap/UI/nodes/DeletableEdge/DeletableEdge'
import NodeComponent from '@/widgets/RoadMap/UI/nodes/NodeComponent/NodeComponent'
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  Node,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {useEffect, useState} from 'react'
import {useRoadmapAccessContext} from '@/shared/ui/RoadMap/context/RoadmapAccessContext'

const nodeTypes = {FlowScrapeNode: NodeComponent}
const edgeTypes = {default: DeletableEdge}

interface RoadMapViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: Node<any>[]
  edges: Edge[]
  roadmapId: string
  roadmapTitle?: string
  roadmapPrice?: number
  nodeAccessType?: RoadmapNodeAccessType | null
  initialAvgRating?: number
  originalLanguage?: string | null
}

function BuyButton({price}: {price: number}) {
  const {openPurchaseModal} = useRoadmapAccessContext()
  const t = useTranslations('roadmapViewer')
  const label = price > 0 ? `${t('buy')} · ${price} ₽` : t('buyAccess')

  return (
    <button
      onClick={openPurchaseModal}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '9px 16px',
        borderRadius: 10,
        border: 'none',
        background: '#141416',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'Roboto, sans-serif',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(20,20,22,0.18)',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
        <rect x='3' y='11' width='18' height='11' rx='2' stroke='currentColor' strokeWidth='2.2' />
        <path d='M7 11V7a5 5 0 0 1 10 0v4' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' />
      </svg>
      {label}
    </button>
  )
}

function StatsButton({onClick}: {onClick: () => void}) {
  const t = useTranslations('roadmapViewer')
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '9px 16px',
        borderRadius: 10,
        border: 'none',
        background: '#141416',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'Roboto, sans-serif',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(20,20,22,0.18)',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
        <rect x='3' y='12' width='4' height='9' rx='1' fill='currentColor' />
        <rect x='10' y='7' width='4' height='14' rx='1' fill='currentColor' />
        <rect x='17' y='3' width='4' height='18' rx='1' fill='currentColor' />
      </svg>
      {t('stats')}
    </button>
  )
}

function InnerFlow({
  nodes: initialNodes,
  edges: initialEdges,
  roadmapId,
  initialAvgRating,
  originalLanguage,
}: RoadMapViewerProps) {
  const {hasAccess, nodeAccessType, isOwner, roadmapPrice} = useRoadmapAccessContext()
  const locale = useLocale()
  const t = useTranslations('roadmapPreview')
  const tLangs = useTranslations('roadmapPreview.languages')
  const showLangBadge = originalLanguage && originalLanguage !== locale
  const isPaid = nodeAccessType !== null || roadmapPrice > 0
  const showBuyButton = isPaid && !hasAccess && !isOwner
  const [statsOpen, setStatsOpen] = useState(false)
  const [containerH, setContainerH] = useState('100vh')

  useEffect(() => {
    document.documentElement.classList.add('roadmap-page')

    const measure = () => {
      const header = document.querySelector('header')
      setContainerH(header ? `calc(100vh - ${header.offsetHeight}px)` : '100vh')
    }
    measure()
    window.addEventListener('resize', measure)

    return () => {
      document.documentElement.classList.remove('roadmap-page')
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    fetch(`/api/roadmap/${roadmapId}/view`, {method: 'POST'}).catch(() => {})
  }, [roadmapId])

  const [nodes, , onNodesChange] = useNodesState(
    initialNodes.map((n) => ({...n, type: 'FlowScrapeNode', dragging: false, selected: false}))
  )
  const [edges, , onEdgesChange] = useEdgesState(
    initialEdges.map((e) => ({
      ...e,
      type: 'default',
      animated: true,
      selectable: false,
      markerEnd: {type: MarkerType.ArrowClosed, width: 22, height: 22, color: '#868897'},
    }))
  )

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 16px',
    borderRadius: 10,
    border: 'none',
    background: '#141416',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Roboto, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 2px 12px rgba(20,20,22,0.18)',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
  }

  return (
    <div style={{width: '100%', height: containerH, backgroundColor: '#FFF', position: 'relative'}}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        fitViewOptions={{padding: 0.2, duration: 400}}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={15} />
        <Controls position='top-left' />

        {/* Language indicator — top-left below controls */}
        {showLangBadge && (
          <Panel position='top-left' style={{top: '50px', left: '10px', margin: 0, pointerEvents: 'none'}}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8,
              background: 'rgba(83,74,183,0.1)', color: '#534AB7',
              fontSize: 12, fontWeight: 600, fontFamily: 'Roboto, sans-serif',
              boxShadow: '0 1px 6px rgba(83,74,183,0.12)',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {t('originalLang')}: {tLangs(originalLanguage as Parameters<typeof tLangs>[0]) ?? originalLanguage}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Adaptive top overlay: review bar + action buttons */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 44,
        right: 10,
        zIndex: 4,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
        pointerEvents: 'none',
      }}>
        <div style={{flex: '1 1 auto', display: 'flex', justifyContent: 'center', pointerEvents: 'auto', minWidth: 0}}>
          <RoadmapReviewBar roadmapId={roadmapId} initialAvgRating={initialAvgRating} />
        </div>
        <div style={{display: 'flex', gap: 8, flex: '0 0 auto', pointerEvents: 'auto'}}>
          {isOwner ? (
            <>
              <StatsButton onClick={() => setStatsOpen(true)} />
              <Link href={`/create-road-map?edit=${roadmapId}`} style={btnStyle}>
                <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
                  <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
                </svg>
                Редактировать
              </Link>
            </>
          ) : (
            showBuyButton && <BuyButton price={roadmapPrice} />
          )}
        </div>
      </div>

      {isOwner && (
        <RoadmapStatsModal
          roadmapId={roadmapId}
          isOpen={statsOpen}
          onClose={() => setStatsOpen(false)}
        />
      )}
    </div>
  )
}

export default function RoadMapViewer(props: RoadMapViewerProps) {
  const {data} = useRoadmapAccess(props.roadmapId)
  const hasAccess = data?.hasAccess ?? false
  const isOwner = data?.grantedBy === 'owner'
  const nodeAccessType = props.nodeAccessType ?? null
  const [purchaseOpen, setPurchaseOpen] = useState(false)

  return (
    <ViewModeContext.Provider value='view'>
      <RoadmapAccessContext.Provider
        value={{
          hasAccess,
          nodeAccessType,
          openPurchaseModal: () => setPurchaseOpen(true),
          roadmapId: props.roadmapId,
          isOwner,
          roadmapPrice: props.roadmapPrice ?? 0,
        }}
      >
        <ReactFlowProvider>
          <InnerFlow {...props} originalLanguage={props.originalLanguage} />

          <PurchaseAccessModal
            isOpen={purchaseOpen}
            onClose={() => setPurchaseOpen(false)}
            roadmapId={props.roadmapId}
            price={props.roadmapPrice ?? 0}
            title={props.roadmapTitle ?? ''}
          />
        </ReactFlowProvider>
      </RoadmapAccessContext.Provider>
    </ViewModeContext.Provider>
  )
}
