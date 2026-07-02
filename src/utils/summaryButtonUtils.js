import { getMagicWandDatasetRowCount, isMagicWandDatasetTooLarge, shouldShowQueryActionButton } from './magicWandHelpers'

export { shouldShowQueryActionButton, isMagicWandDatasetTooLarge, getMagicWandDatasetRowCount } from './magicWandHelpers'

/**
 * Determines whether the magic wand (summary) button should be shown.
 * Data Messenger and dashboard both use this; toolbar-specific rules only add what chat needs for parity.
 *
 * @param {Object} params - Parameters object
 * @param {boolean} params.enableMagicWand - Whether magic wand feature is enabled
 * @param {Object} params.queryResponse - The query response object (from responseRef?.queryResponse or props.response)
 * @param {boolean} params.isResponse - Whether this is a response message (ChatMessage / Data Messenger)
 * @param {string} params.type - Message type (ChatMessage, e.g. 'text', 'markdown')
 * @param {boolean} params.isCSVProgressMessage - CSV export progress message (ChatMessage)
 * @param {boolean} params.isMarkdownOnly - Markdown-only bubble with no table (OptionsToolbar)
 */
export function shouldShowSummaryButton({
  enableMagicWand,
  queryResponse,
  isResponse,
  type,
  isCSVProgressMessage,
  isMarkdownOnly,
}) {
  if (!shouldShowQueryActionButton(enableMagicWand, queryResponse)) {
    return false
  }

  // Data Messenger — response bubbles with QueryOutput (show but disabled when too large)
  if (isResponse !== undefined) {
    if (!isResponse) {
      return false
    }
    if (type === 'text') {
      return false
    }
    if (isCSVProgressMessage) {
      return false
    }
    return true
  }

  // OptionsToolbar — dashboard tiles (hide entirely when too large)
  if (isMarkdownOnly !== undefined) {
    if (isMarkdownOnly) {
      return false
    }
    if (isMagicWandDatasetTooLarge(queryResponse)) {
      return false
    }
    return true
  }

  return true
}

/**
 * Determines whether the summary button should be disabled (when it is shown).
 *
 * @param {Object} params - Parameters object
 * @param {Object} params.queryResponse - The query response object
 * @param {boolean} params.isGenerating - Whether a summary is currently being generated
 * @param {boolean} params.isChataThinking - Whether Chata is thinking (query/drilldown running)
 * @returns {Object} Object with `isDisabled` boolean and optional `tooltip` string
 */
const LARGE_DATASET_TOOLTIP = 'This dataset is too large for this feature.'

export function getSummaryButtonDisabledState({ queryResponse, isGenerating, isChataThinking }) {
  const rowCount = getMagicWandDatasetRowCount(queryResponse)

  const hasNoData = rowCount === 0
  const isTooLarge = isMagicWandDatasetTooLarge(queryResponse)

  const isDisabled = hasNoData || isTooLarge || isGenerating || Boolean(isChataThinking)

  const tooltip = hasNoData
    ? 'No data available to generate a summary.'
    : isTooLarge
      ? LARGE_DATASET_TOOLTIP
      : undefined

  return { isDisabled, tooltip }
}

export function getFollowOnQueryDisabledState({ queryResponse }) {
  const isTooLarge = isMagicWandDatasetTooLarge(queryResponse)
  return {
    isDisabled: isTooLarge,
    tooltip: isTooLarge ? LARGE_DATASET_TOOLTIP : undefined,
  }
}
