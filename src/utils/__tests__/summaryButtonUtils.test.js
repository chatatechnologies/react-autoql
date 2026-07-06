import {
  getMagicWandDatasetRowCount,
  isMagicWandDatasetTooLarge,
  shouldShowQueryActionButton,
  shouldShowSummaryButton,
  getSummaryButtonDisabledState,
  getFollowOnQueryDisabledState,
} from '../summaryButtonUtils'

const MAX_DATA_PAGE_SIZE = 50000

// Helpers to build a minimal queryResponse with N rows
const makeResponse = (rowCount, extra = {}) => ({
  data: {
    data: {
      rows: Array(rowCount).fill([1, 2]),
      columns: [{ name: 'a' }, { name: 'b' }],
      ...extra,
    },
  },
})

const UNDER_LIMIT = makeResponse(MAX_DATA_PAGE_SIZE - 1)
const AT_LIMIT = makeResponse(MAX_DATA_PAGE_SIZE)
const OVER_LIMIT = makeResponse(MAX_DATA_PAGE_SIZE + 1)
const EMPTY = makeResponse(0)
const NULL_RESPONSE = null

// ---------------------------------------------------------------------------
// getMagicWandDatasetRowCount
// ---------------------------------------------------------------------------
describe('getMagicWandDatasetRowCount', () => {
  it('returns the row count from a response', () => {
    expect(getMagicWandDatasetRowCount(makeResponse(42))).toBe(42)
  })

  it('returns 0 for an empty rows array', () => {
    expect(getMagicWandDatasetRowCount(EMPTY)).toBe(0)
  })

  it('returns 0 for a null response', () => {
    expect(getMagicWandDatasetRowCount(NULL_RESPONSE)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// isMagicWandDatasetTooLarge  (threshold: >= MAX_DATA_PAGE_SIZE)
// ---------------------------------------------------------------------------
describe('isMagicWandDatasetTooLarge', () => {
  it('returns false when rows are under the limit', () => {
    expect(isMagicWandDatasetTooLarge(UNDER_LIMIT)).toBe(false)
  })

  it('returns true at exactly MAX_DATA_PAGE_SIZE rows', () => {
    expect(isMagicWandDatasetTooLarge(AT_LIMIT)).toBe(true)
  })

  it('returns true when rows exceed MAX_DATA_PAGE_SIZE', () => {
    expect(isMagicWandDatasetTooLarge(OVER_LIMIT)).toBe(true)
  })

  it('returns false for an empty response', () => {
    expect(isMagicWandDatasetTooLarge(EMPTY)).toBe(false)
  })

  it('returns false for a null response', () => {
    expect(isMagicWandDatasetTooLarge(NULL_RESPONSE)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getSummaryButtonDisabledState
// ---------------------------------------------------------------------------
describe('getSummaryButtonDisabledState', () => {
  it('is not disabled for a normal-sized dataset', () => {
    const { isDisabled, tooltip } = getSummaryButtonDisabledState({ queryResponse: UNDER_LIMIT })
    expect(isDisabled).toBe(false)
    expect(tooltip).toBeUndefined()
  })

  it('is disabled at exactly MAX_DATA_PAGE_SIZE rows with a tooltip', () => {
    const { isDisabled, tooltip } = getSummaryButtonDisabledState({ queryResponse: AT_LIMIT })
    expect(isDisabled).toBe(true)
    expect(typeof tooltip).toBe('string')
    expect(tooltip.length).toBeGreaterThan(0)
  })

  it('is disabled above MAX_DATA_PAGE_SIZE rows with a tooltip', () => {
    const { isDisabled, tooltip } = getSummaryButtonDisabledState({ queryResponse: OVER_LIMIT })
    expect(isDisabled).toBe(true)
    expect(typeof tooltip).toBe('string')
  })

  it('is disabled for empty data with a different tooltip', () => {
    const { isDisabled, tooltip } = getSummaryButtonDisabledState({ queryResponse: EMPTY })
    expect(isDisabled).toBe(true)
    expect(typeof tooltip).toBe('string')
    // Large-dataset tooltip should NOT be shown for empty data
    const { tooltip: largeTooltip } = getSummaryButtonDisabledState({ queryResponse: AT_LIMIT })
    expect(tooltip).not.toBe(largeTooltip)
  })

  it('is disabled while generating regardless of row count', () => {
    const { isDisabled } = getSummaryButtonDisabledState({
      queryResponse: UNDER_LIMIT,
      isGenerating: true,
    })
    expect(isDisabled).toBe(true)
  })

  it('is disabled while chata is thinking regardless of row count', () => {
    const { isDisabled } = getSummaryButtonDisabledState({
      queryResponse: UNDER_LIMIT,
      isChataThinking: true,
    })
    expect(isDisabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getFollowOnQueryDisabledState
// ---------------------------------------------------------------------------
describe('getFollowOnQueryDisabledState', () => {
  it('is not disabled under the limit', () => {
    const { isDisabled, tooltip } = getFollowOnQueryDisabledState({ queryResponse: UNDER_LIMIT })
    expect(isDisabled).toBe(false)
    expect(tooltip).toBeUndefined()
  })

  it('is disabled at exactly MAX_DATA_PAGE_SIZE rows', () => {
    const { isDisabled, tooltip } = getFollowOnQueryDisabledState({ queryResponse: AT_LIMIT })
    expect(isDisabled).toBe(true)
    expect(typeof tooltip).toBe('string')
    expect(tooltip.length).toBeGreaterThan(0)
  })

  it('is disabled above MAX_DATA_PAGE_SIZE rows', () => {
    const { isDisabled } = getFollowOnQueryDisabledState({ queryResponse: OVER_LIMIT })
    expect(isDisabled).toBe(true)
  })

  it('shares the same tooltip text as getSummaryButtonDisabledState for large datasets', () => {
    const followOn = getFollowOnQueryDisabledState({ queryResponse: AT_LIMIT })
    const summary = getSummaryButtonDisabledState({ queryResponse: AT_LIMIT })
    expect(followOn.tooltip).toBe(summary.tooltip)
  })
})

// ---------------------------------------------------------------------------
// shouldShowSummaryButton — OptionsToolbar path (isMarkdownOnly)
// hides the button entirely when dataset is too large
// ---------------------------------------------------------------------------
describe('shouldShowSummaryButton — OptionsToolbar path', () => {
  const base = { enableMagicWand: true, isMarkdownOnly: false }

  it('shows button for a normal-sized dataset', () => {
    expect(shouldShowSummaryButton({ ...base, queryResponse: UNDER_LIMIT })).toBe(true)
  })

  it('hides button at exactly MAX_DATA_PAGE_SIZE rows', () => {
    expect(shouldShowSummaryButton({ ...base, queryResponse: AT_LIMIT })).toBe(false)
  })

  it('hides button above MAX_DATA_PAGE_SIZE rows', () => {
    expect(shouldShowSummaryButton({ ...base, queryResponse: OVER_LIMIT })).toBe(false)
  })

  it('hides button when markdown only, regardless of row count', () => {
    expect(shouldShowSummaryButton({ ...base, isMarkdownOnly: true, queryResponse: UNDER_LIMIT })).toBe(false)
  })

  it('hides button when feature is disabled', () => {
    expect(shouldShowSummaryButton({ ...base, enableMagicWand: false, queryResponse: UNDER_LIMIT })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// shouldShowSummaryButton — ChatMessage path (isResponse)
// shows button even for large datasets (disabled state is handled separately)
// ---------------------------------------------------------------------------
describe('shouldShowSummaryButton — ChatMessage path', () => {
  const base = { enableMagicWand: true, isResponse: true, type: 'response' }

  it('shows button for a normal-sized dataset', () => {
    expect(shouldShowSummaryButton({ ...base, queryResponse: UNDER_LIMIT })).toBe(true)
  })

  it('still shows button at MAX_DATA_PAGE_SIZE (disabled, not hidden)', () => {
    expect(shouldShowSummaryButton({ ...base, queryResponse: AT_LIMIT })).toBe(true)
  })

  it('still shows button above MAX_DATA_PAGE_SIZE (disabled, not hidden)', () => {
    expect(shouldShowSummaryButton({ ...base, queryResponse: OVER_LIMIT })).toBe(true)
  })

  it('hides button when isResponse is false', () => {
    expect(shouldShowSummaryButton({ ...base, isResponse: false, queryResponse: UNDER_LIMIT })).toBe(false)
  })

  it('hides button for text type messages', () => {
    expect(shouldShowSummaryButton({ ...base, type: 'text', queryResponse: UNDER_LIMIT })).toBe(false)
  })

  it('hides button for CSV progress messages', () => {
    expect(shouldShowSummaryButton({ ...base, isCSVProgressMessage: true, queryResponse: UNDER_LIMIT })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// shouldShowQueryActionButton — shared gate used by follow-on query visibility
// ---------------------------------------------------------------------------
describe('shouldShowQueryActionButton', () => {
  it('returns false when feature is disabled', () => {
    expect(shouldShowQueryActionButton(false, UNDER_LIMIT)).toBe(false)
  })

  it('returns false for a data-preview response', () => {
    const preview = makeResponse(10, { isDataPreview: true })
    expect(shouldShowQueryActionButton(true, preview)).toBe(false)
  })

  it('returns false when there is only 1 row', () => {
    expect(shouldShowQueryActionButton(true, makeResponse(1))).toBe(false)
  })

  it('returns true for a normal multi-row response', () => {
    expect(shouldShowQueryActionButton(true, UNDER_LIMIT)).toBe(true)
  })

  it('returns true for a large dataset (visibility not gated here)', () => {
    expect(shouldShowQueryActionButton(true, AT_LIMIT)).toBe(true)
  })
})
