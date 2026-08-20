/**
 * A Data Alert QUERY term can carry an optional `query_id` alongside its natural language
 * `term_value`. When present, the Logic Engine runs the SQL that query already resolved to
 * instead of re-running the text, which keeps the alert evaluating exactly what the user saw.
 *
 * Only an id from a full sized query run may be pinned. The SQL stored against a query id
 * carries the page limit of the run it came from, and the alert builder validates queries at
 * a page size of 2, so pinning one of those ids would cap the alert's data. When no id can be
 * safely pinned we omit the field and the Logic Engine falls back to the natural language
 * query, which is the pre-existing behaviour.
 */

// The page size the Logic Engine evaluates alerts with.
export const MIN_PINNABLE_PAGE_SIZE = 10000

export function getPinnableQueryId(queryResponse) {
  const responseData = queryResponse?.data?.data
  const queryId = responseData?.query_id
  const pageSize = responseData?.fe_req?.page_size

  if (!queryId || !(pageSize >= MIN_PINNABLE_PAGE_SIZE)) {
    return undefined
  }

  return queryId
}

export default getPinnableQueryId
