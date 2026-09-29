// An Analysis block: Auto Analyze's wording about one Data block in the report (its target), kept as it was
// written and edited. What it shows, and what it would be written from, are worked out here from the block,
// its target and the target's view.

const count = (n) => Number(n).toLocaleString()

// What Auto Analyze reads from a Data block: the rows the block prints (a table's slice, every row a chart
// draws), all of the answer's columns, its question and how it was read. A slice is named with the question
// ("…, first 25 of 88 rows") so its figures aren't read as the whole result's. null when there's nothing to
// read: no result on show, or a capture kept without the query id Auto Analyze needs.
export const getAnalysisInput = ({ target, targetView }) => {
  const capture = target?.capture
  const data = capture?.data
  if (!data?.query_id || targetView?.state !== 'ready') {
    return null
  }
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
    input,
  }
}

// The results an analysis can be about: Data blocks showing one, in report order, named as they're titled.
export const getAnalysisTargets = (blocks, views) =>
  blocks
    .filter((block) => block.type === 'data' && views[block.id]?.state === 'ready')
    .map((block) => {
      const view = views[block.id]
      return { id: block.id, label: view.sourceType === 'query' ? `“${view.title}”` : view.title }
    })
