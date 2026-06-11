import { isSingleValueResponse } from 'autoql-fe-utils'

/**
 * Row count from the query payload (same source as ChataTable / getSummaryButtonDisabledState).
 */
export function getMagicWandDatasetRowCount(queryResponse) {
  return queryResponse?.data?.data?.rows?.length ?? 0
}

/**
 * True when there are too many rows to run analyze / LLM summary (matches Data Messenger disabled rule).
 */
export function isMagicWandDatasetTooLarge(queryResponse) {
  return getMagicWandDatasetRowCount(queryResponse) > MAX_DATA_PAGE_SIZE
}

/**
 * Shared visibility rules for query action buttons (magic wand, follow-on queries, etc.)
 * Returns false for single-value responses, empty data, previews, and disabled features.
 */
export function shouldShowQueryActionButton(enableFeature, queryResponse) {
  if (!enableFeature) {
    return false
  }

  if (queryResponse?.data?.data?.isDataPreview) {
    return false
  }

  if (!queryResponse?.data?.data?.rows || !queryResponse?.data?.data?.columns) {
    return false
  }

  const rows = queryResponse?.data?.data?.rows || []
  if (rows.length <= 1) {
    return false
  }

  if (isSingleValueResponse(queryResponse)) {
    return false
  }

  return true
}
