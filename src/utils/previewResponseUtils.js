// Normalizes various shapes of a query response so a Tabulator preview can mount and format correctly.
export function normalizePreviewResponse(originalResponse = {}, visibleColumns = []) {
  const previewColumns = originalResponse?.data?.data?.columns || visibleColumns || []
  const previewQueryId = originalResponse?.data?.data?.query_id || `preview-${Date.now()}`

  const rows = originalResponse?.data?.data?.rows
  const colCount = (visibleColumns && visibleColumns.length) || 0
  const emptyRow = Array.from({ length: colCount }).map(() => undefined)

  let normalizedRows

  if (Array.isArray(rows)) {
    if (rows.length === 0) {
      normalizedRows = [emptyRow]
    } else if (!Array.isArray(rows[0])) {
      // 1D array: wrap into a single row; if it's a single scalar and only one column expected, prefer [[value]] so formatters apply to the single cell.
      const singleColCount = (originalResponse?.data?.data?.columns || []).length === 1 || colCount === 1
      normalizedRows = rows.length === 1 && singleColCount ? [[rows[0]]] : [rows]
    } else {
      normalizedRows = rows
    }
  } else if (rows === null || rows === undefined) {
    normalizedRows = [emptyRow]
  } else {
    normalizedRows = [[rows]]
  }

  return {
    ...originalResponse,
    data: {
      ...originalResponse.data,
      data: {
        ...originalResponse.data?.data,
        rows: normalizedRows,
        columns: originalResponse?.data?.data?.columns || previewColumns,
        query_id: originalResponse?.data?.data?.query_id || previewQueryId,
      },
    },
  }
}

export default normalizePreviewResponse
