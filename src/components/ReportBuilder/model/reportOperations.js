import { v4 as uuid } from 'uuid'
import { normalizeStyle, snapTableRows } from './reportSchema'

// Pure, immutable edits to a normalized report. Each returns a new report; inputs are never mutated.

const indexOf = (report, id) => report.blocks.findIndex((block) => block.id === id)

const withBlocks = (report, blocks) => ({ ...report, blocks })

// After the given block, or at the end when there's no (known) anchor.
export const insertBlock = (report, block, afterId) => {
  const blocks = report.blocks.slice()
  const at = afterId ? indexOf(report, afterId) : -1
  blocks.splice(at > -1 ? at + 1 : blocks.length, 0, block)
  return withBlocks(report, blocks)
}

export const updateBlock = (report, id, patch) =>
  withBlocks(
    report,
    report.blocks.map((block) => {
      if (block.id !== id) {
        return block
      }
      const next = { ...block, ...patch }
      if (next.type === 'data' && 'rows' in patch) {
        next.rows = snapTableRows(patch.rows)
      }
      return next
    }),
  )

// Merges a style change; a value of '' or undefined removes that key ("follow the theme").
export const updateBlockStyle = (report, id, stylePatch) =>
  withBlocks(
    report,
    report.blocks.map((block) => {
      if (block.id !== id) {
        return block
      }
      const style = normalizeStyle({ ...(block.style || {}), ...stylePatch })
      const { style: previous, ...rest } = block
      return style ? { ...rest, style } : rest
    }),
  )

export const resetBlockStyle = (report, id) =>
  withBlocks(
    report,
    report.blocks.map((block) => {
      if (block.id !== id) {
        return block
      }
      const { style, ...rest } = block
      return rest
    }),
  )

export const removeBlock = (report, id) =>
  withBlocks(
    report,
    report.blocks.filter((block) => block.id !== id),
  )

export const moveBlock = (report, id, delta) => {
  const from = indexOf(report, id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= report.blocks.length) {
    return report
  }
  const blocks = report.blocks.slice()
  const [block] = blocks.splice(from, 1)
  blocks.splice(to, 0, block)
  return withBlocks(report, blocks)
}

export const duplicateBlock = (report, id) => {
  const block = report.blocks.find((b) => b.id === id)
  if (!block) {
    return { report, id: null }
  }
  const copy = { ...JSON.parse(JSON.stringify(block)), id: uuid() }
  return { report: insertBlock(report, copy, id), id: copy.id }
}

export const updatePageSetup = (report, patch) => ({ ...report, page: { ...report.page, ...patch } })

export const setTitle = (report, title) => ({ ...report, title })

// Pointing a data block at a new source clears nothing else: rows stay what the author chose.
export const setDataSource = (report, id, source) => updateBlock(report, id, { source })
