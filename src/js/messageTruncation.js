import { isDataLimited } from 'autoql-fe-utils'

import { getResponseRowCount, withPreviewRows } from './responseUtils'

/**
 * How many data-bearing answers stay fully in memory.
 *
 * Three rather than five because the two ways of getting this wrong do not cost the
 * same. Truncating too eagerly costs a backend round trip the user sees, but only in
 * the tab they are actually scrolling. Truncating too lazily costs memory in every open
 * tab at once - this budget is per session tab, so eight tabs means eight times this
 * number of answers held at full size, and that is the figure that decides whether the
 * browser struggles.
 *
 * Three also covers what people actually scroll back for: comparing an answer against
 * the one or two before it. And `TRUNCATE_MIN_ROWS` already exempts the small answers,
 * where a round trip would feel most gratuitous for the least memory saved.
 *
 * Both are `ChatContent` props, so an integrator who knows their data is small can
 * raise them.
 */
export const KEEP_HYDRATED_MESSAGES = 3
export const TRUNCATE_MIN_ROWS = 200

/**
 * Drop the rows of answers that have been pushed far enough back in the history.
 *
 * History is cheap to keep; the data hanging off it is not - a few thousand rows sit in
 * the message, in QueryOutput's copy and in Tabulator's, times however many session tabs
 * are open. Past `keepHydratedMessages` answers back, the rows go and a preview stays,
 * which is what lets the history limit be raised at all.
 *
 * Two things are deliberately left alone:
 *
 *   Small answers. The round trip to fetch them again costs more than holding them ever
 *   did, and it would turn a scroll through recent history into a wait.
 *
 *   Answers the user has explicitly restored. Having asked for the data once, they
 *   should not have to ask again every time they run another query. The cost of that is
 *   that someone who restores everything ends up holding everything - which is a fair
 *   trade for it being their own explicit choice, and visible to them.
 *
 * Returns the original array when nothing changed, so callers can apply it
 * unconditionally without forcing a re-render.
 */
export const truncateOldMessageData = (messages, options = {}) => {
  const { keepHydratedMessages = KEEP_HYDRATED_MESSAGES, truncateMinRows = TRUNCATE_MIN_ROWS } = options

  if (!keepHydratedMessages || !Array.isArray(messages)) {
    return messages
  }

  let hydratedSeen = 0
  let changed = false

  // Newest first: position in the history is what decides, so count backwards.
  const next = [...messages].reverse().map((message) => {
    const rowCount = getResponseRowCount(message?.response)

    // Requests, errors and already-truncated answers hold nothing worth taking, and a
    // restored answer is being kept on purpose. None of them count towards the budget
    // either - it is a budget of answers still holding their data.
    if (!rowCount || message.dataTruncated || message.isDataRestored) {
      return message
    }

    hydratedSeen += 1

    if (hydratedSeen <= keepHydratedMessages || rowCount <= truncateMinRows) {
      return message
    }

    changed = true

    return {
      ...message,
      response: withPreviewRows(message.response),
      dataTruncated: {
        // How many rows we dropped - deliberately not called a total, because the
        // response never carries one. `count_rows` stops at one past the row limit to
        // mean "more than this", so it counts nothing. This is used to keep display
        // type decisions stable (see QueryOutput.getDataLength), not to tell the user
        // how big the result is, because we do not know.
        droppedRowCount: rowCount,
        // Whether the answer was already limited before we touched it. Once the rows
        // are a preview, `rows.length < count_rows` is true of every answer, so the
        // usual test would start reporting answers as limited that never were.
        wasDataLimited: isDataLimited(message.response),
        truncatedAt: Date.now(),
      },
      // Remounts the output so it lets go of its own copies of the rows.
      dataVersion: (message.dataVersion ?? 0) + 1,
    }
  })

  return changed ? next.reverse() : messages
}
