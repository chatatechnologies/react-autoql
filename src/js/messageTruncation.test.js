import { KEEP_HYDRATED_MESSAGES, TRUNCATE_MIN_ROWS, truncateOldMessageData } from './messageTruncation'

// The rule is positional and size-aware: an answer is truncated once it has been pushed
// past `keepHydratedMessages` *answers* back, and only if it is big enough that holding
// it costs more than fetching it again would.
describe('truncateOldMessageData', () => {
  let nextId = 0

  const answer = (rowCount, extra = {}) => ({
    id: `m${(nextId += 1)}`,
    isResponse: true,
    response: {
      data: {
        data: {
          query_id: `q${nextId}`,
          columns: [{ name: 'region' }, { name: 'revenue' }],
          fe_req: { text: 'total revenue' },
          rows: Array.from({ length: rowCount }, (_, i) => [`r${i}`, i]),
        },
      },
    },
    ...extra,
  })

  const request = () => ({ id: `m${(nextId += 1)}`, isResponse: false, content: 'total revenue' })

  const options = { keepHydratedMessages: 2, truncateMinRows: 100 }

  const rowsOf = (message) => message.response.data.data.rows.length

  test('keeps the most recent answers whole and truncates what is behind them', () => {
    const messages = [answer(500), answer(500), answer(500), answer(500)]

    const result = truncateOldMessageData(messages, options)

    // Oldest two truncated, newest two untouched.
    expect(rowsOf(result[0])).toBe(10)
    expect(rowsOf(result[1])).toBe(10)
    expect(rowsOf(result[2])).toBe(500)
    expect(rowsOf(result[3])).toBe(500)
  })

  test('preserves order', () => {
    const messages = [answer(500), answer(500), answer(500)]
    const ids = messages.map((m) => m.id)

    expect(truncateOldMessageData(messages, options).map((m) => m.id)).toEqual(ids)
  })

  test('records how many rows it dropped and bumps dataVersion so the output remounts', () => {
    const messages = [answer(500), answer(500), answer(500)]

    const [oldest] = truncateOldMessageData(messages, options)

    expect(oldest.dataTruncated.droppedRowCount).toBe(500)
    expect(oldest.dataVersion).toBe(1)
  })

  // count_rows counts nothing: for a data-limited answer the backend stops at one past
  // the limit to mean "more than this". Nothing in the response is a true row total, so
  // this records only what we dropped - and the UI no longer quotes a total at all.
  test('records the rows it actually dropped, not count_rows', () => {
    const limited = answer(500)
    limited.response.data.data.count_rows = 25000
    const messages = [limited, answer(500), answer(500)]

    expect(truncateOldMessageData(messages, options)[0].dataTruncated.droppedRowCount).toBe(500)
  })

  // Once the rows are a preview, `rows.length < count_rows` is true of every answer, so
  // the reading has to be taken before they go.
  test('records whether the answer was already data-limited', () => {
    const limited = answer(500)
    limited.response.data.data.count_rows = 25000
    const unlimited = answer(500)
    unlimited.response.data.data.count_rows = 500

    const result = truncateOldMessageData([limited, unlimited, answer(500), answer(500)], options)

    expect(result[0].dataTruncated.wasDataLimited).toBe(true)
    expect(result[1].dataTruncated.wasDataLimited).toBe(false)
  })

  test('leaves small answers alone however far back they are', () => {
    const messages = [answer(20), answer(500), answer(500), answer(500)]

    const result = truncateOldMessageData(messages, options)

    expect(rowsOf(result[0])).toBe(20)
    expect(result[0].dataTruncated).toBeUndefined()
  })

  // Requests and errors hold no data, so they must not push answers out of the budget.
  test('only answers carrying data count towards the budget', () => {
    const messages = [answer(500), request(), request(), answer(500), request(), answer(500)]

    const result = truncateOldMessageData(messages, options)

    expect(rowsOf(result[0])).toBe(10)
    expect(rowsOf(result[3])).toBe(500)
    expect(rowsOf(result[5])).toBe(500)
  })

  test('does not re-truncate an answer that is already a preview', () => {
    const messages = [answer(500), answer(500), answer(500)]
    const once = truncateOldMessageData(messages, options)
    const twice = truncateOldMessageData(once, options)

    expect(twice).toBe(once)
    expect(twice[0].dataVersion).toBe(1)
  })

  // Having asked for the data back once, the user should not have to ask again on every
  // subsequent query.
  test('leaves a restored answer alone, and does not count it against the budget', () => {
    const restored = answer(500, { isDataRestored: true })
    const messages = [restored, answer(500), answer(500), answer(500)]

    const result = truncateOldMessageData(messages, options)

    expect(rowsOf(result[0])).toBe(500)
    expect(result[0].dataTruncated).toBeUndefined()
    // The restored one is not holding a budget slot, so the next oldest is truncated.
    expect(rowsOf(result[1])).toBe(10)
  })

  test('returns the same array when nothing needed truncating, so no re-render is forced', () => {
    const messages = [answer(500), answer(500)]

    expect(truncateOldMessageData(messages, options)).toBe(messages)
  })

  test('does not mutate the messages it was given', () => {
    const messages = [answer(500), answer(500), answer(500)]

    truncateOldMessageData(messages, options)

    expect(rowsOf(messages[0])).toBe(500)
    expect(messages[0].dataTruncated).toBeUndefined()
  })

  test('keeping zero hydrated is treated as the feature being off', () => {
    const messages = [answer(500), answer(500), answer(500)]

    expect(truncateOldMessageData(messages, { ...options, keepHydratedMessages: 0 })).toBe(messages)
  })

  test('tolerates messages with no response at all', () => {
    expect(() => truncateOldMessageData([{ id: 'a' }, request()], options)).not.toThrow()
    expect(truncateOldMessageData(undefined, options)).toBeUndefined()
  })
})

// The defaults are the behaviour every integrator gets without configuring anything, so
// they are worth pinning: a change to either is a change to how much memory the chat
// holds, and should be deliberate.
describe('defaults', () => {
  const answer = (rowCount, id) => ({
    id,
    response: { data: { data: { rows: Array.from({ length: rowCount }, (_, i) => [i]) } } },
  })

  test('keeps the three most recent data-bearing answers', () => {
    expect(KEEP_HYDRATED_MESSAGES).toBe(3)

    const messages = [answer(500, 'a'), answer(500, 'b'), answer(500, 'c'), answer(500, 'd')]
    const result = truncateOldMessageData(messages)

    expect(result[0].dataTruncated).toBeDefined()
    expect(result[1].dataTruncated).toBeUndefined()
    expect(result[3].dataTruncated).toBeUndefined()
  })

  // Below this, fetching an answer back costs more than holding it ever did.
  test('never truncates an answer of 200 rows or fewer', () => {
    expect(TRUNCATE_MIN_ROWS).toBe(200)

    const messages = [answer(200, 'a'), answer(500, 'b'), answer(500, 'c'), answer(500, 'd')]

    expect(truncateOldMessageData(messages)[0].dataTruncated).toBeUndefined()
  })
})
