import { isSingleValueResponse, MAX_DATA_PAGE_SIZE } from 'autoql-fe-utils'

/**
 * Determines whether the magic wand (summary) button should be shown.
 * This function centralizes the logic used across ChatMessage and OptionsToolbar.
 * 
 * @param {Object} params - Parameters object
 * @param {boolean} params.enableMagicWand - Whether magic wand feature is enabled
 * @param {Object} params.queryResponse - The query response object (from responseRef?.queryResponse or props.response)
 * @param {boolean} params.isResponse - Whether this is a response message (for ChatMessage)
 * @param {string} params.type - Message type (for ChatMessage, e.g., 'text', 'markdown')
 * @param {boolean} params.isCSVProgressMessage - Whether this is a CSV progress message (for ChatMessage)
 * @param {boolean} params.isMarkdownOnly - Whether this is a markdown-only message (for OptionsToolbar)
 * @param {boolean} params.isDataResponse - Whether this is a data response (for OptionsToolbar)
 * @param {boolean} params.hasData - Whether there is data (for OptionsToolbar)
 * @param {Function} params.isDrilldownResponse - Function to check if this is a drilldown response (for OptionsToolbar)
 * @returns {boolean} Whether the summary button should be shown
 */
export function shouldShowSummaryButton({
  enableMagicWand,
  queryResponse,
  isResponse,
  type,
  isCSVProgressMessage,
  isMarkdownOnly,
  isDataResponse,
  hasData,
  isDrilldownResponse,
}) {
  // Magic wand must be enabled
  if (!enableMagicWand) {
    return false
  }

  // Must have query response with data
  if (!queryResponse?.data?.data?.rows || !queryResponse?.data?.data?.columns) {
    return false
  }

  // Check row count - allow if there's at least 1 row (including exactly 1 row)
  const rows = queryResponse?.data?.data?.rows || []
  const rowCount = rows.length
  if (rowCount <= 1) {
    return false
  }

  // For ChatMessage context
  if (isResponse !== undefined) {
    // Must be a response message
    if (!isResponse) {
      return false
    }

    // Don't show for text messages
    if (type === 'text') {
      return false
    }

    // Don't show for CSV progress messages
    if (isCSVProgressMessage) {
      return false
    }

    // Don't show for single value responses
    if (isSingleValueResponse(queryResponse)) {
      return false
    }
  }

  // For OptionsToolbar context
  if (isMarkdownOnly !== undefined || isDataResponse !== undefined) {
    // Don't show for markdown-only messages
    if (isMarkdownOnly) {
      return false
    }

    // Must be a data response
    if (!isDataResponse) {
      return false
    }

    // Must have data
    if (!hasData) {
      return false
    }

    // Don't show for drilldown responses
    if (isDrilldownResponse && isDrilldownResponse()) {
      return false
    }

    // Don't show for single value responses
    if (isSingleValueResponse(queryResponse)) {
      return false
    }
  }

  return true
}

/**
 * Determines whether the summary button should be disabled.
 * 
 * @param {Object} params - Parameters object
 * @param {Object} params.queryResponse - The query response object
 * @param {boolean} params.isGenerating - Whether a summary is currently being generated
 * @param {boolean} params.isChataThinking - Whether Chata is thinking (query/drilldown running)
 * @returns {Object} Object with `isDisabled` boolean and optional `tooltip` string
 */
export function getSummaryButtonDisabledState({ queryResponse, isGenerating, isChataThinking }) {
  const rows = queryResponse?.data?.data?.rows || []
  const rowCount = rows.length

  const isDatasetTooLarge = rowCount > MAX_DATA_PAGE_SIZE
  const hasNoData = rowCount === 0

  const isDisabled = isDatasetTooLarge || hasNoData || isGenerating || Boolean(isChataThinking)

  const tooltip = isDatasetTooLarge
    ? `The dataset is too large to generate a summary. Please refine your dataset to generate a summary.`
    : hasNoData
    ? `No data available to generate a summary.`
    : undefined

  return { isDisabled, tooltip }
}
