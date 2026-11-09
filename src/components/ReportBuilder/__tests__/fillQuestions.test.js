import { fillErrorOf, fillQuestions, questionBlocks } from '../run/fillQuestions'

// Filling in a report's data from the page: which blocks are asked, how, how many at a time, and what's handed back.

const AUTH = { apiKey: 'key', domain: 'https://example.test', token: 'token' }
const LOCK = { key: 'household', value: 'Smith Family', filter_type: 'include', show_message: 'Household' }

const question = (id, query, rest = {}) => ({ id, type: 'data', source: { type: 'query', query }, ...rest })
const REPORT = {
  schemaVersion: 1,
  title: 'Q3 review',
  sessionFilterLocks: [LOCK],
  blocks: [
    { id: 'h1', type: 'heading', text: 'Q3' },
    question('d1', 'aum by household', { displayType: 'column', capture: { version: 1, config: { orders: [] } } }),
    { id: 'd2', type: 'data', source: { type: 'tile', dashboardId: 'db1', tileId: 't1' } },
    question('d3', ''),
    question('d4', 'top holdings'),
    question('d5', 'cash by account'),
    question('d6', 'drift by asset'),
  ],
}

// A stand-in for captureQuestion whose answers are given out by hand, in any order.
const manualAsk = () => {
  const calls = []
  const ask = jest.fn((options) => {
    let answer
    const result = new Promise((resolve) => {
      answer = resolve
    })
    calls.push({ options, answer })
    return result
  })
  return { ask, calls }
}

const flush = () => new Promise((resolve) => setTimeout(resolve))

describe('questionBlocks', () => {
  test('is every Data block with a question, and nothing else', () => {
    expect(questionBlocks(REPORT).map((block) => block.id)).toStrictEqual(['d1', 'd4', 'd5', 'd6'])
    expect(questionBlocks(null)).toStrictEqual([])
  })
})

describe('fillErrorOf', () => {
  test('names the reason as the report service does', () => {
    expect(fillErrorOf('d1', { ok: false, reason: 'no-data' })).toStrictEqual({ blockId: 'd1', reason: 'no_data' })
    expect(fillErrorOf('d1', { ok: false, reason: 'error', error: { referenceId: '1.1.430' } }).reason).toBe(
      'not_confident',
    )
    expect(fillErrorOf('d1', { ok: false, reason: 'error', error: { referenceId: '1.1.522' } }).reason).toBe(
      'access_denied',
    )
    expect(fillErrorOf('d1', { ok: false, reason: 'error', error: { message: 'It broke.' } })).toStrictEqual({
      blockId: 'd1',
      reason: 'query_failed',
      message: 'It broke.',
    })
  })
})

describe('fillQuestions', () => {
  test('asks each question with the report’s lock, its block’s settings and one time, three at a time', async () => {
    const { ask, calls } = manualAsk()
    fillQuestions({ report: REPORT, authentication: AUTH, capturedAt: '2026-11-05T10:00:00.000Z', ask })

    expect(calls.map((call) => call.options.query)).toStrictEqual([
      'aum by household',
      'top holdings',
      'cash by account',
    ])
    expect(calls[0].options).toStrictEqual(
      expect.objectContaining({
        authentication: AUTH,
        filters: [LOCK],
        capturedAt: '2026-11-05T10:00:00.000Z',
        rerun: { kept: REPORT.blocks[1].capture, displayType: 'column' },
      }),
    )

    calls[1].answer({ ok: true, capture: { version: 1 } })
    await flush()
    expect(calls.map((call) => call.options.query)).toStrictEqual([
      'aum by household',
      'top holdings',
      'cash by account',
      'drift by asset',
    ])
  })

  test('hands on each answer and ends with what didn’t fill', async () => {
    const { ask, calls } = manualAsk()
    const onAnswer = jest.fn()
    const fill = fillQuestions({ report: REPORT, authentication: AUTH, ask, onAnswer })
    expect(fill.total).toBe(4)

    calls[0].answer({ ok: true, capture: { version: 1, displayType: 'column' } })
    calls[1].answer({ ok: false, reason: 'no-data' })
    calls[2].answer({ ok: false, reason: 'cancelled' })
    await flush()
    calls[3].answer({ ok: false, reason: 'error', error: { referenceId: '1.1.431' } })

    await expect(fill.done).resolves.toStrictEqual({
      total: 4,
      errors: [
        { blockId: 'd4', reason: 'no_data' },
        { blockId: 'd6', reason: 'not_confident' },
      ],
    })
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith(REPORT.blocks[1], { version: 1, displayType: 'column' })
  })

  test('is done at once for a report with no questions', async () => {
    const ask = jest.fn()
    const fill = fillQuestions({ report: { ...REPORT, blocks: [REPORT.blocks[0]] }, ask })
    await expect(fill.done).resolves.toStrictEqual({ total: 0, errors: [] })
    expect(ask).not.toHaveBeenCalled()
  })

  test('stops: what’s being asked is cancelled, and nothing more is asked or handed on', async () => {
    const { ask, calls } = manualAsk()
    const onAnswer = jest.fn()
    const fill = fillQuestions({ report: REPORT, ask, onAnswer })
    const signals = calls.map((call) => call.options.signal)

    fill.stop()
    expect(signals.every((signal) => signal.aborted)).toBe(true)

    calls[0].answer({ ok: true, capture: { version: 1 } })
    await flush()
    expect(onAnswer).not.toHaveBeenCalled()
    expect(ask).toHaveBeenCalledTimes(3)
  })

  test('asks nothing more once it isn’t wanted', async () => {
    const { ask, calls } = manualAsk()
    let wanted = true
    const onAnswer = jest.fn()
    fillQuestions({ report: REPORT, ask, onAnswer, isCurrent: () => wanted })

    wanted = false
    calls[0].answer({ ok: true, capture: { version: 1 } })
    await flush()
    expect(onAnswer).not.toHaveBeenCalled()
    expect(ask).toHaveBeenCalledTimes(3)
  })
})
