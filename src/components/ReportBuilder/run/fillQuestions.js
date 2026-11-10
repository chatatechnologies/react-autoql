import { captureQuestion } from './captureRun'
import { RERUN_ALL_CONCURRENCY } from '../constants'

// Filling in a report's data from the page, as AutoQL fills a report made from a template: for a report a service
// that doesn't fill reports (yet) leaves to the page, and for a template opened to be edited, whose answers are
// only there to be looked at.

// The blocks a fill asks: every Data block with a question.
export const questionBlocks = (report) =>
  (Array.isArray(report?.blocks) ? report.blocks : []).filter(
    (block) => block?.type === 'data' && block.source?.type === 'query' && block.source.query,
  )

// Why a question asked from here didn't fill its block, as the report service says it of its own fills.
export const fillErrorOf = (blockId, result) => {
  const referenceId = result.error?.referenceId
  let reason = 'query_failed'
  if (result.reason === 'no-data') {
    reason = 'no_data'
  } else if (result.reason === 'unsupported') {
    // It answered, with something a report can't keep (yet): asking again comes back the same.
    reason = 'unsupported'
  } else if (referenceId === '1.1.430' || referenceId === '1.1.431') {
    reason = 'not_confident'
  } else if (referenceId === '1.1.522') {
    reason = 'access_denied'
  }
  return {
    blockId,
    reason,
    ...(reason === 'query_failed' && result.error?.message ? { message: result.error.message } : {}),
  }
}

// Asks a report's questions a few at a time, each answer kept the way its block is set up (`rerun`) and as of
// `capturedAt`, and every question asked with the report's filter lock. `onAnswer(block, capture)` gets each answer as
// it comes; what's done with it (saved, or just shown) is the caller's. `isCurrent()` says whether the fill is still
// wanted: once it isn't, nothing more is asked or handed on.
//
// Returns { total, done, stop }: `done` resolves with { total, errors } once every question has been answered or has
// failed, `errors` as the report service gives its own ([{ blockId, reason, message? }]); `stop()` cancels what's
// being asked, and `done` then never resolves. A report with no questions is done at once.
export const fillQuestions = ({
  report,
  authentication,
  autoQLConfig,
  capturedAt,
  concurrency = RERUN_ALL_CONCURRENCY,
  isCurrent = () => true,
  onAnswer,
  ask = captureQuestion,
} = {}) => {
  const blocks = questionBlocks(report)
  const filters = report?.sessionFilterLocks
  const errors = []
  const controllers = new Set()
  let next = 0
  let asking = 0
  let stopped = false
  let finish
  const done = new Promise((resolve) => {
    finish = () => resolve({ total: blocks.length, errors })
  })
  const wanted = () => !stopped && isCurrent()

  const askNext = () => {
    if (!wanted()) {
      return
    }
    if (next >= blocks.length) {
      if (!asking) {
        finish()
      }
      return
    }
    const block = blocks[next]
    next += 1
    asking += 1
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    controllers.add(controller)
    const settle = (result) => {
      controllers.delete(controller)
      asking -= 1
      if (!wanted()) {
        return
      }
      if (result?.ok) {
        try {
          onAnswer?.(block, result.capture)
        } catch (error) {
          errors.push(fillErrorOf(block.id, { reason: 'error', error: { message: error?.message } }))
        }
      } else if (result?.reason !== 'cancelled') {
        errors.push(fillErrorOf(block.id, result || {}))
      }
      askNext()
    }
    // Whatever goes wrong with one question (a request that can't be built, an answer that can't be kept) is that
    // block's error, and the fill goes on to the next: it always ends.
    let asked
    try {
      asked = Promise.resolve(
        ask({
          query: block.source.query,
          authentication,
          autoQLConfig,
          filters,
          signal: controller?.signal,
          rerun: { kept: block.capture, displayType: block.displayType },
          capturedAt,
        }),
      )
    } catch (error) {
      asked = Promise.reject(error)
    }
    asked.then(settle, (error) => settle({ ok: false, reason: 'error', error: { message: error?.message } }))
  }

  if (!blocks.length) {
    finish()
  }
  for (let i = 0; i < Math.min(concurrency, blocks.length); i += 1) {
    askNext()
  }

  return {
    total: blocks.length,
    done,
    stop: () => {
      stopped = true
      controllers.forEach((controller) => controller?.abort())
      controllers.clear()
    },
  }
}
