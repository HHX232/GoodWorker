import {Document, Page, StyleSheet, Text, View} from '@react-pdf/renderer'
import {ExportBlock, ExportModel, questionTitle} from './buildExportModel'

const PAD = 28

const s = StyleSheet.create({
  page: {backgroundColor: '#ffffff', fontFamily: 'Roboto', paddingBottom: 44, paddingHorizontal: PAD, paddingTop: 26},

  headerTitle: {fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4},
  headerDesc: {fontSize: 10, color: '#64748b', marginBottom: 6},
  headerBrand: {fontSize: 10, fontWeight: 700, color: '#534AB7', marginBottom: 14},

  block: {marginBottom: 12},
  questionLine: {flexDirection: 'row', marginBottom: 4},
  questionNum: {fontSize: 11, fontWeight: 700, color: '#0f172a', width: 20},
  questionText: {fontSize: 11, color: '#0f172a', flex: 1},

  line: {fontSize: 10, color: '#334155', marginLeft: 20, marginBottom: 2},
  lineCorrect: {fontSize: 10, color: '#16a34a', fontWeight: 700, marginLeft: 20, marginBottom: 2},

  infoHeading: {fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 4, marginTop: 6},
  infoText: {fontSize: 10, color: '#475569', marginBottom: 8},

  footer: {position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center'},
  footerText: {fontSize: 8, color: '#cbd5e1'}
})

function QuestionBody({block}: {block: Extract<ExportBlock, {kind: 'question'}>}) {
  switch (block.type) {
    case 'choose':
      return <>{block.options.map((o, i) => (
        <Text key={i} style={block.correctOptions.includes(o) ? s.lineCorrect : s.line}>{o}</Text>
      ))}</>
    case 'free':
      return block.referenceAnswer ? <Text style={s.lineCorrect}>Ответ: {block.referenceAnswer}</Text> : null
    case 'match':
      return <>{block.pairs.map((p, i) => (
        <Text key={i} style={s.line}>{p.left} — <Text style={s.lineCorrect}>{p.right}</Text></Text>
      ))}</>
    case 'fill':
      return <Text style={s.line}>{block.text}</Text>
    case 'sequence':
      return <>{block.items.map((item, i) => <Text key={i} style={s.line}>{i + 1}. {item}</Text>)}</>
    case 'highlight':
      return <>{[block.instruction, block.text].filter(Boolean).map((t, i) => <Text key={i} style={s.line}>{t}</Text>)}</>
    case 'scramble':
      return <>
        <Text style={s.lineCorrect}>Составьте из букв: {block.source}</Text>
        {block.hint ? <Text style={s.line}>Подсказка: {block.hint}</Text> : null}
      </>
    case 'dialogue':
      return <>{block.lines.map((l, i) => <Text key={i} style={s.line}>{l.speaker}: {l.text}</Text>)}</>
  }
}

export function TestPDFDoc({model}: {model: ExportModel}) {
  return (
    <Document>
      <Page size='A4' style={s.page}>
        <Text style={s.headerTitle}>{model.title}</Text>
        {model.description ? <Text style={s.headerDesc}>{model.description}</Text> : null}
        <Text style={s.headerBrand}>GoodWorker</Text>

        {model.blocks.map((block, i) => {
          if (block.kind === 'info') {
            if (block.type === 'text') return <Text key={i} style={s.infoText}>{block.text}</Text>
            if (block.type === 'media') return (
              <Text key={i} style={s.infoHeading}>
                {block.mediaKind === 'video' ? 'ВИДЕО' : 'ИЗОБРАЖЕНИЕ'}{block.caption ? `: ${block.caption}` : ''}
              </Text>
            )
            return <Text key={i} style={s.infoHeading}>АУДИО{block.filename ? `: ${block.filename}` : ''}</Text>
          }
          return (
            <View key={i} style={s.block} wrap={false}>
              <View style={s.questionLine}>
                <Text style={s.questionNum}>{block.num}.</Text>
                <Text style={s.questionText}>{questionTitle(block)}</Text>
              </View>
              <QuestionBody block={block} />
            </View>
          )
        })}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>GoodWorker</Text>
        </View>
      </Page>
    </Document>
  )
}
