import { isCapture } from '../model/blockView'
import { questionBlocks } from '../run/fillQuestions'
import { REPORTS_STRINGS } from './reportsStrings'

const S = REPORTS_STRINGS

// A fill that's over, as the builder shows it on its blocks (its dataFill): why each block it couldn't fill wasn't,
// from the errors as the report service gives them ([{ blockId, reason, message? }]).
export const filledDataFill = (dataErrors) => {
  const errors = {}
  ;(Array.isArray(dataErrors) ? dataErrors : []).forEach(({ blockId, reason, message }) => {
    errors[blockId] = { reason, message }
  })
  return { state: 'filled', errors }
}

// How far filling in a report's data has got: its questions with an answer (`done`), of all of them (`total`). A
// Data block with no question isn't counted: a fill has nothing to ask it.
export const fillProgress = (report) => {
  const blocks = questionBlocks(report)
  return { done: blocks.filter((block) => isCapture(block.capture)).length, total: blocks.length }
}

// What's said over a report whose data is being filled in: how far it's got, and how it went once it's done (or
// stopped). Said once a fill followed here ends, not each time the report is opened after. How it went is counted on
// the report as it is now, so blocks rerun (or removed) since count too. `words` are a report's (S.workspace), or
// a template's being edited, with the same keys.
export const fillNoticeOf = (fill, filling, report, words = S.workspace) => {
  const { done, total } = fillProgress(report)
  if (filling) {
    return { tone: 'info', text: words.filling(done, total) }
  }
  if (fill.stalled) {
    return { tone: 'warning', text: words.fillStalled }
  }
  if (!fill.ended) {
    return null
  }
  if (done >= total) {
    return { tone: 'info', text: words.filled(total) }
  }
  if (!done) {
    return { tone: 'warning', text: words.notFilled(total) }
  }
  return { tone: 'warning', text: words.partlyFilled(done, total) }
}
