import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export interface NoteEntry {
  identity: string
  text: string
}

interface Props {
  entries: NoteEntry[]
  roomName: string
  topic?: string | null
  createdAt: string
}

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const mon = MONTHS[d.getMonth()]
  const yr  = d.getFullYear()
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${mon} ${yr}, ${hh}:${mm}`
}

const PURPLE = '#7c3aed'
const PAGE_H_PAD = 24
const PAGE_W = 595
const BUBBLE_MAX = (PAGE_W - PAGE_H_PAD * 2) * 0.74

const s = StyleSheet.create({
  page: {
    backgroundColor: '#f8fafc',
    fontFamily: 'Roboto',
    paddingBottom: 32,
  },
  headerBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
    paddingHorizontal: PAGE_H_PAD,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 5,
  },
  topicBadge: {
    fontSize: 10,
    color: PURPLE,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  headerDate: {
    fontSize: 10,
    color: '#94a3b8',
  },

  feed: {
    paddingHorizontal: PAGE_H_PAD,
    paddingTop: 14,
    flexDirection: 'column',
    gap: 8,
  },

  // ── Mine (right) ──
  rowMine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  colMine: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    maxWidth: BUBBLE_MAX,
  },
  identityMine: {
    fontSize: 8,
    fontWeight: 700,
    color: '#94a3b8',
    marginBottom: 2,
    paddingHorizontal: 3,
  },
  bubbleMine: {
    backgroundColor: PURPLE,
    borderRadius: 12,
    borderBottomRightRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMineText: {
    fontSize: 11,
    color: '#ffffff',
    lineHeight: 1.6,
  },

  // ── Theirs (left) ──
  rowTheirs: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 6,
  },
  colTheirs: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    maxWidth: BUBBLE_MAX,
  },
  identityTheirs: {
    fontSize: 8,
    fontWeight: 700,
    color: '#94a3b8',
    marginBottom: 2,
    paddingHorizontal: 3,
  },
  bubbleTheirs: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderBottomLeftRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  bubbleTheirsText: {
    fontSize: 11,
    color: '#1e293b',
    lineHeight: 1.6,
  },

  footer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#cbd5e1',
  },
})

export function TranscriptPDFDoc({ entries, roomName, topic, createdAt }: Props) {
  const firstIdentity = entries[0]?.identity ?? ''

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.headerBar}>
          <Text style={s.headerTitle}>{roomName}</Text>
          {topic ? <Text style={s.topicBadge}>{topic}</Text> : null}
          <Text style={s.headerDate}>{fmtDate(createdAt)}</Text>
        </View>

        <View style={s.feed}>
          {entries.map((entry, i) => {
            const mine = entry.identity === firstIdentity
            return mine ? (
              <View key={i} style={s.rowMine}>
                <View style={s.colMine}>
                  <Text style={s.identityMine}>{entry.identity}</Text>
                  <View style={s.bubbleMine}>
                    <Text style={s.bubbleMineText}>{entry.text}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View key={i} style={s.rowTheirs}>
                <View style={s.colTheirs}>
                  <Text style={s.identityTheirs}>{entry.identity}</Text>
                  <View style={s.bubbleTheirs}>
                    <Text style={s.bubbleTheirsText}>{entry.text}</Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>GoodWorker — Экспортировано {fmtDate(new Date().toISOString())}</Text>
        </View>

      </Page>
    </Document>
  )
}
