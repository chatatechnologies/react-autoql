// An Analysis block: Auto Analyze's wording about one Data block in the report (its target), kept as it was
// written and edited. What it shows, and what it would be written from, are worked out here from the block,
// its target and the target's view.

import { shouldShowQueryActionButton } from '../../../utils/magicWandHelpers'

const count = (n) => Number(n).toLocaleString()

// The wording as Markdown. Some answers come back with the characters "\n" rather than line breaks; the
// page prints them as breaks, so the wording is kept, and edited, with real ones.
export const toAnalysisMarkdown = (text) => String(text ?? '').replace(/\\n/g, '\n')

// Why Auto Analyze can't write about a Data block's result, or null when it can. The result has to be on
// show, kept with the answer's query id, and one the magic wand is offered on in the Query view and on
// dashboards (shouldShowQueryActionButton: rows and columns, more than one row, not a single value).
export const getAnalysisBlocker = ({ target, targetView }) => {
  const data = target?.capture?.data
  if (!data || targetView?.state !== 'ready') return 'not-ready'
  if (!data.query_id) return 'no-query-id'
  if (!shouldShowQueryActionButton(true, { data: { data } })) return 'too-little'
  return null
}

// What Auto Analyze reads from a Data block: the rows the block prints (a table's slice, every row a chart
// draws), all of the answer's columns, its question and how it was read. A slice is named with the question
// ("…, first 25 of 88 rows") so its figures aren't read as the whole result's. null when there's nothing it
// can write about (getAnalysisBlocker).
export const getAnalysisInput = ({ target, targetView }) => {
  if (getAnalysisBlocker({ target, targetView })) {
    return null
  }
  const capture = target.capture
  const data = capture.data
  const kept = Array.isArray(data.rows) ? data.rows : []
  const rows = targetView.kind === 'table' ? targetView.rows : kept
  const total = typeof data.count_rows === 'number' ? data.count_rows : kept.length
  const slice = rows.length < total ? `first ${count(rows.length)} of ${count(total)} rows` : null
  const title = targetView.title || data.text || ''
  const question = data.text || title
  return {
    queryId: data.query_id,
    text: slice ? `${question}, ${slice}` : question,
    interpretation: typeof data.interpretation === 'string' ? data.interpretation : '',
    rows,
    columns: data.columns,
    asOf: capture.capturedAt,
    title,
  }
}

export const getAnalysisView = ({ block, target, targetView }) => {
  const input = target ? getAnalysisInput({ target, targetView }) : null
  const written = !!(block.text || '').trim()
  return {
    state: written ? 'written' : 'empty',
    text: block.text || '',
    // As written: the result it's about and the focus it was asked for.
    fromTitle: block.targetTitle || input?.title || null,
    focusUsed: block.focusUsed || '',
    writtenAt: block.writtenAt || null,
    targetGone: !!block.target && !target,
    // The result was captured again since, so the wording may no longer match it.
    targetChanged: written && !!target && !!block.targetAsOf && target.capture?.capturedAt !== block.targetAsOf,
    canAnalyze: !!input,
    // Why not, when there is a result to be about.
    blocker: target ? getAnalysisBlocker({ target, targetView }) : null,
    input,
  }
}

// The results an analysis can be about: Data blocks showing one, in report order, named as they're titled.
// Those Auto Analyze can't write about are listed with why (`blocker`), to be shown but not chosen.
export const getAnalysisTargets = (blocks, views) =>
  blocks
    .filter((block) => block.type === 'data' && views[block.id]?.state === 'ready')
    .map((block) => {
      const view = views[block.id]
      return {
        id: block.id,
        label: view.sourceType === 'query' ? `“${view.title}”` : view.title,
        blocker: getAnalysisBlocker({ target: block, targetView: view }),
      }
    })
