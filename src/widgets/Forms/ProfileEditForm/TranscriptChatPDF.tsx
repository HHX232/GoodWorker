import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export interface NoteEntry {
  identity: string
  text: string
}

interface Props {
  entries: NoteEntry[]
  roomName: string
  topic?: string | null
  date: string
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f8fafc',
    padding: 0,
    fontFamily: 'Helvetica',
  },
  headerBar: {
    backgroundColor: '#ffffff',
    borderBottom: '1pt solid #e2e8f0',
    padding: '20pt 28pt 16pt',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  headerTopic: {
    fontSize: 11,
    color: '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.07)',
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 2,
    paddingBottom: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 10,
    color: '#94a3b8',
  },
  chatArea: {
    padding: '16pt 20pt',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  bubbleWrapMine: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  bubbleWrapTheirs: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  identity: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
    paddingHorizontal: 4,
  },
  bubbleMine: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    borderBottomRightRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '72%',
  },
  bubbleMineText: {
    fontSize: 11,
    color: '#ffffff',
    lineHeight: 1.55,
  },
  bubbleTheirs: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderBottomLeftRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '72%',
    border: '1pt solid #e2e8f0',
  },
  bubbleTheirsText: {
    fontSize: 11,
    color: '#1e293b',
    lineHeight: 1.55,
  },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#cbd5e1',
  },
})

export function TranscriptPDFDoc({ entries, roomName, topic, date }: Props) {
  const firstIdentity = entries[0]?.identity ?? ''

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>{roomName}</Text>
          {topic ? <Text style={styles.headerTopic}>{topic}</Text> : null}
          <Text style={styles.headerDate}>{date}</Text>
        </View>

        {/* Chat messages */}
        <View style={styles.chatArea}>
          {entries.map((entry, i) => {
            const isMine = entry.identity === firstIdentity
            return (
              <View key={i} style={isMine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs}>
                <Text style={styles.identity}>{entry.identity}</Text>
                <View style={isMine ? styles.bubbleMine : styles.bubbleTheirs}>
                  <Text style={isMine ? styles.bubbleMineText : styles.bubbleTheirsText}>
                    {entry.text}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Экспортировано {new Date().toLocaleDateString('ru-RU')}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
