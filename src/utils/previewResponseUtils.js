/**
 * Normalizes query response data structure for table preview rendering.
 * Ensures `rows` is always a 2D array and required fields exist.
 */
export function normalizePreviewResponse(originalResponse = {}, visibleColumns = []) {
  const responseData = originalResponse?.data?.data
  const rows = responseData?.rows
  const columns = responseData?.columns || visibleColumns || []

  // Normalize rows to a 2D array
  let normalizedRows
  if (!rows || (Array.isArray(rows) && rows.length === 0)) {
    // Empty or missing data: create a single empty row matching column count
    normalizedRows = [Array(columns.length).fill(undefined)]
  } else if (Array.isArray(rows)) {
    // Already an array: ensure it's 2D
    normalizedRows = Array.isArray(rows[0]) ? rows : [rows]
  } else {
    // Scalar value: wrap into 2D array
    normalizedRows = [[rows]]
  }

  return {
    ...originalResponse,
    data: {
      ...originalResponse.data,
      data: {
        ...responseData,
        rows: normalizedRows,
        columns,
        query_id: responseData?.query_id || `preview-${Date.now()}`,
      },
    },
  }
}

export default normalizePreviewResponse
