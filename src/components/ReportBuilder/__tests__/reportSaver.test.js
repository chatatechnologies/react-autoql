import { ReportsApiError } from '../run/reportsApi'
import { REPORTS_STRINGS } from '../workspace/strings'
import { CONFLICT_MESSAGE, ReportSaver } from '../workspace/ReportSaver'

const ID = '33333333-3333-4333-8333-333333333333'
const T0 = '2026-09-28T20:00:00.000Z'
const AUTH = { apiKey: 'key', domain: 'https://example.test', token: 'token' }

const doc = (title, blocks = [{ id: 'b1', type: 'text', text: 'One' }]) => ({
  schemaVersion: 1,
  title,
  page: {},
  blocks,
})

const saved = (version) => ({ id: ID, version, updatedAt: `2026-09-28T20:0${version}:00.000Z` })

// A report as the service's client returns it, read or created.
const detail = (version, report, updatedAt = T0) => ({
  id: ID,
  title: report.title,
  sizeBytes: 100,
  version,
  folderId: null,
  tagIds: [],
  createdAt: T0,
  updatedAt,
  projectId: 'CT_1',
  report,
  created: true,
})

const conflict = () =>
  new ReportsApiError({ status: 409, code: 'REPORT_VERSION_CONFLICT', details: { version: 2 }, message: 'Stale.' })

const api = { createReport: jest.fn(), saveReport: jest.fn(), fetchReport: jest.fn() }
const getAuthentication = jest.fn()

// What was sent on each call to one of the service's functions.
const requests = (fn) => fn.mock.calls.map(([request]) => request)

const saverFor = (overrides = {}) => {
  const states = []
  const onMerged = jest.fn()
  const onUnauthorized = jest.fn()
  const saver = new ReportSaver({
    id: ID,
    stored: { report: doc('Start'), version: 1, updatedAt: T0 },
    report: doc('Start'),
    delayMs: 2000,
    getAuthentication,
    onState: (state) => states.push(state),
    onMerged,
    onUnauthorized,
    api,
    ...overrides,
  })
  return { saver, states, onMerged, onUnauthorized, last: () => states[states.length - 1] }
}

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  jest.useFakeTimers()
  Object.values(api).forEach((fn) => fn.mockReset())
  getAuthentication.mockReset()
  getAuthentication.mockReturnValue(AUTH)
})
afterEach(() => jest.useRealTimers())

describe('ReportSaver', () => {
  it('saves once after a pause in editing: the whole report, with the version it was read at', async () => {
    api.saveReport.mockResolvedValue(saved(2))
    const { saver, last } = saverFor()
    saver.edit(doc('A'))
    saver.edit(doc('AB'))
    expect(last().status).toBe('saving')
    expect(saver.hasUnsaved).toBe(true)

    await jest.advanceTimersByTimeAsync(1999)
    expect(api.saveReport).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)

    expect(api.saveReport).toHaveBeenCalledTimes(1)
    expect(api.saveReport).toHaveBeenCalledWith({ authentication: AUTH, id: ID, report: doc('AB'), version: 1 })
    expect(last()).toEqual({ status: 'saved', error: null, savedAt: saved(2).updatedAt })
    expect(saver.current).toBe(last())
    expect(saver.hasUnsaved).toBe(false)
  })

  it('sends one write at a time, then saves what was typed meanwhile against the new version', async () => {
    const first = deferred()
    api.saveReport.mockReturnValueOnce(first.promise).mockResolvedValueOnce(saved(3))
    const { saver, last } = saverFor()
    saver.edit(doc('A'))
    await jest.advanceTimersByTimeAsync(2000)
    saver.edit(doc('AB'))
    await jest.advanceTimersByTimeAsync(2000)
    expect(api.saveReport).toHaveBeenCalledTimes(1)

    first.resolve(saved(2))
    await jest.advanceTimersByTimeAsync(0)
    expect(last().status).toBe('saving')
    await jest.advanceTimersByTimeAsync(2000)

    expect(requests(api.saveReport)[1]).toEqual({ authentication: AUTH, id: ID, report: doc('AB'), version: 2 })
    expect(last().status).toBe('saved')
  })

  it('saves at once on flush, and resolves when everything is stored', async () => {
    api.saveReport.mockResolvedValue(saved(2))
    const { saver } = saverFor()
    await expect(saver.flush()).resolves.toBe(true)
    expect(api.saveReport).not.toHaveBeenCalled()

    saver.edit(doc('A'))
    await expect(saver.flush()).resolves.toBe(true)
    await jest.advanceTimersByTimeAsync(10_000)
    expect(api.saveReport).toHaveBeenCalledTimes(1)
  })

  it('sends as keepalive when flushed on the way out (reload, close, sign-out), creates included', async () => {
    api.createReport.mockImplementation(async ({ report }) => detail(1, report))
    api.saveReport.mockResolvedValue(saved(2))
    const fresh = saverFor({ stored: null, report: doc('') })
    await fresh.saver.flush({ keepalive: true })
    expect(api.createReport).toHaveBeenCalledWith({ authentication: AUTH, id: ID, report: doc(''), keepalive: true })

    const { saver } = saverFor()
    saver.edit(doc('A'))
    await saver.flush({ keepalive: true })
    expect(api.saveReport).toHaveBeenCalledWith({
      authentication: AUTH,
      id: ID,
      report: doc('A'),
      version: 1,
      keepalive: true,
    })
  })

  it('sends keepalive only when a flush asks for it', async () => {
    api.createReport.mockImplementation(async ({ report }) => detail(1, report))
    api.saveReport.mockResolvedValue(saved(2))
    const { saver } = saverFor({ stored: null, report: doc('') })
    await saver.flush()
    saver.edit(doc('A'))
    await jest.advanceTimersByTimeAsync(2000)
    saver.edit(doc('AB'))
    await saver.flush()
    saver.edit(doc('ABC'))
    await saver.flush({ keepalive: false })

    const sent = [...requests(api.createReport), ...requests(api.saveReport)]
    expect(sent).toHaveLength(4)
    sent.forEach((request) => expect(request).not.toHaveProperty('keepalive'))

    // A save flushed on the way out that failed is tried again later as an ordinary one: the page is still here.
    api.saveReport.mockRejectedValueOnce(new ReportsApiError({ status: 503 }))
    saver.edit(doc('ABCD'))
    await expect(saver.flush({ keepalive: true })).resolves.toBe(false)
    await jest.advanceTimersByTimeAsync(5000)
    const [onTheWayOut, later] = requests(api.saveReport).slice(-2)
    expect(onTheWayOut.keepalive).toBe(true)
    expect(later).not.toHaveProperty('keepalive')
  })

  it('creates a new report first, then saves edits against its version', async () => {
    api.createReport.mockImplementation(async ({ report }) => detail(1, report))
    api.saveReport.mockResolvedValue(saved(2))
    const { saver, last } = saverFor({ stored: null, report: doc('') })
    expect(saver.hasUnsaved).toBe(true)
    expect(saver.created).toBe(false)
    expect(saver.current).toEqual({ status: 'saving', error: null, savedAt: null })

    await expect(saver.flush()).resolves.toBe(true)
    expect(api.createReport).toHaveBeenCalledWith({ authentication: AUTH, id: ID, report: doc('') })
    expect(saver.created).toBe(true)
    expect(last().status).toBe('saved')

    saver.edit(doc('Named'))
    await saver.flush()
    expect(api.saveReport).toHaveBeenCalledWith({ authentication: AUTH, id: ID, report: doc('Named'), version: 1 })
  })

  it('creates a new report in the folder it was given, and names no folder otherwise', async () => {
    api.createReport.mockImplementation(async ({ report }) => detail(1, report))
    const { saver } = saverFor({ stored: null, report: doc(''), folderId: 'f1' })
    await saver.flush()
    expect(api.createReport).toHaveBeenCalledWith({ authentication: AUTH, id: ID, report: doc(''), folderId: 'f1' })
    expect(requests(api.createReport)[0]).toHaveProperty('folderId', 'f1')
  })

  it('saves again when a retried create returns the first, older copy', async () => {
    api.createReport.mockResolvedValue(detail(1, doc('')))
    api.saveReport.mockResolvedValue(saved(2))
    const { saver } = saverFor({ stored: null, report: doc('Typed before it landed') })
    await expect(saver.flush()).resolves.toBe(true)
    expect(api.saveReport).toHaveBeenCalledWith({
      authentication: AUTH,
      id: ID,
      report: doc('Typed before it landed'),
      version: 1,
    })
  })

  it('on a version conflict, adds the blocks appended elsewhere and saves again, keeping both sides', async () => {
    const appended = { id: 'b9', type: 'data', rows: 10 }
    const start = doc('Start')
    api.saveReport.mockRejectedValueOnce(conflict()).mockResolvedValueOnce(saved(3))
    // As the service returns it: the same document, keys reordered, with the block at the end.
    api.fetchReport.mockResolvedValue(
      detail(2, { blocks: [...start.blocks, appended], page: {}, title: 'Start', schemaVersion: 1 }),
    )
    const { saver, onMerged, last } = saverFor()
    saver.edit(doc('Renamed here'))

    await expect(saver.flush()).resolves.toBe(true)

    const merged = doc('Renamed here', [...start.blocks, appended])
    expect(api.saveReport).toHaveBeenLastCalledWith({ authentication: AUTH, id: ID, report: merged, version: 2 })
    expect(api.fetchReport).toHaveBeenCalledWith({ authentication: AUTH, id: ID })
    expect(onMerged).toHaveBeenCalledWith(merged)
    expect(saver.report).toEqual(merged)
    expect(last().status).toBe('saved')
    // The save, the refetch and the save after it each asked for credentials.
    expect(getAuthentication).toHaveBeenCalledTimes(3)
  })

  it('merges appends at most three times in a row, then waits for the next edit', async () => {
    let landed = 0
    api.saveReport.mockRejectedValue(conflict())
    // Each refetch finds one more block appended since the last.
    api.fetchReport.mockImplementation(async () => {
      landed += 1
      const added = Array.from({ length: landed }, (_, i) => ({ id: `b${i + 2}`, type: 'data', rows: i }))
      return detail(1 + landed, doc('Start', [...doc('Start').blocks, ...added]))
    })
    const { saver, onMerged, last } = saverFor()
    saver.edit(doc('Renamed here'))

    await expect(saver.flush()).resolves.toBe(false)
    expect(api.saveReport).toHaveBeenCalledTimes(4)
    expect(api.fetchReport).toHaveBeenCalledTimes(3)
    expect(onMerged).toHaveBeenCalledTimes(3)
    expect(saver.report.blocks.map((block) => block.id)).toEqual(['b1', 'b2', 'b3', 'b4'])
    expect(last()).toMatchObject({
      status: 'failed',
      error: 'This change isn’t saved yet: the server didn’t accept it.',
    })
    await jest.advanceTimersByTimeAsync(120_000)
    expect(api.saveReport).toHaveBeenCalledTimes(4)
  })

  it('stops saving and offers a reload when the report was edited elsewhere as well', async () => {
    api.saveReport.mockRejectedValue(conflict())
    api.fetchReport.mockResolvedValue(detail(2, doc('Renamed in the other tab')))
    const { saver, last } = saverFor()
    saver.edit(doc('Renamed here'))

    await expect(saver.flush()).resolves.toBe(false)
    expect(last()).toMatchObject({ status: 'conflict', error: CONFLICT_MESSAGE })
    expect(CONFLICT_MESSAGE).toBe(REPORTS_STRINGS.save.conflict)

    saver.edit(doc('More'))
    await jest.advanceTimersByTimeAsync(120_000)
    expect(api.saveReport).toHaveBeenCalledTimes(1)
    expect(saver.hasUnsaved).toBe(true)
    await expect(saver.flush()).resolves.toBe(false)
    await expect(saver.retry()).resolves.toBe(false)
    expect(api.saveReport).toHaveBeenCalledTimes(1)
  })

  it('recognises its own write when the answer was lost, rather than calling it a conflict', async () => {
    api.saveReport
      .mockRejectedValueOnce(new ReportsApiError({ status: 0, message: 'Could not reach the server.' }))
      .mockRejectedValueOnce(conflict())
    api.fetchReport.mockResolvedValue(detail(2, doc('A'), '2026-09-28T20:02:00.000Z'))
    const { saver, last } = saverFor()
    saver.edit(doc('A'))

    await expect(saver.flush()).resolves.toBe(false)
    expect(last()).toMatchObject({
      status: 'failed',
      error: 'This change isn’t saved yet: couldn’t reach the server. Trying again shortly.',
    })

    await jest.advanceTimersByTimeAsync(5000)
    expect(api.saveReport).toHaveBeenCalledTimes(2)
    expect(last()).toEqual({ status: 'saved', error: null, savedAt: '2026-09-28T20:02:00.000Z' })
  })

  it('retries a save the server failed, after a growing pause', async () => {
    api.saveReport
      .mockRejectedValueOnce(new ReportsApiError({ status: 502, message: 'Bad gateway.' }))
      .mockRejectedValueOnce(new ReportsApiError({ status: 503, message: 'Unavailable.' }))
      .mockResolvedValueOnce(saved(2))
    const { saver, last } = saverFor()
    saver.edit(doc('A'))
    await jest.advanceTimersByTimeAsync(2000)
    expect(api.saveReport).toHaveBeenCalledTimes(1)

    await jest.advanceTimersByTimeAsync(5000)
    expect(api.saveReport).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(14_999)
    expect(api.saveReport).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(1)
    expect(api.saveReport).toHaveBeenCalledTimes(3)
    expect(last().status).toBe('saved')
  })

  it('waits for the next edit after the server turns a save down', async () => {
    api.saveReport
      .mockRejectedValueOnce(new ReportsApiError({ status: 413, code: 'REPORT_TOO_LARGE', message: 'Too large.' }))
      .mockResolvedValueOnce(saved(2))
    const { saver, last } = saverFor()
    saver.edit(doc('Huge'))
    await jest.advanceTimersByTimeAsync(2000)
    expect(last()).toMatchObject({
      status: 'failed',
      error: 'This change isn’t saved yet: the report is too large (over 5 MB) — remove a block, or show fewer rows.',
    })
    await jest.advanceTimersByTimeAsync(120_000)
    expect(api.saveReport).toHaveBeenCalledTimes(1)

    saver.edit(doc('Smaller'))
    await jest.advanceTimersByTimeAsync(2000)
    expect(api.saveReport).toHaveBeenLastCalledWith({
      authentication: AUTH,
      id: ID,
      report: doc('Smaller'),
      version: 1,
    })
    expect(last().status).toBe('saved')
  })

  it('doesn’t send a title over the limit', async () => {
    const { saver, last } = saverFor()
    saver.edit(doc('x'.repeat(201)))
    await expect(saver.flush()).resolves.toBe(false)
    expect(api.saveReport).not.toHaveBeenCalled()
    expect(last()).toMatchObject({
      status: 'failed',
      error: 'This change isn’t saved yet: report titles can be up to 200 characters.',
    })
  })

  it('never sends a live query response, while the page keeps it', async () => {
    api.saveReport.mockResolvedValue(saved(2))
    const { saver } = saverFor()
    saver.edit(doc('A', [{ id: 'b1', type: 'data', queryResponse: { run: () => 1 } }]))
    await saver.flush()
    expect(requests(api.saveReport)[0].report.blocks[0]).toEqual({ id: 'b1', type: 'data' })
    expect(saver.report.blocks[0]).toHaveProperty('queryResponse')
  })

  it('asks the host for credentials on every request, so a token re-minted between saves is the one sent', async () => {
    let token = 'first'
    getAuthentication.mockImplementation(() => ({ ...AUTH, token }))
    api.saveReport.mockResolvedValueOnce(saved(2)).mockResolvedValueOnce(saved(3))
    const { saver } = saverFor()
    expect(getAuthentication).not.toHaveBeenCalled()

    saver.edit(doc('A'))
    await saver.flush()
    token = 'second'
    saver.edit(doc('AB'))
    await saver.flush()

    expect(requests(api.saveReport).map((request) => request.authentication.token)).toEqual(['first', 'second'])
    expect(getAuthentication).toHaveBeenCalledTimes(2)
  })

  it('tells the host when the token is turned away, once the failure shows, and doesn’t retry on its own', async () => {
    api.saveReport
      .mockRejectedValueOnce(new ReportsApiError({ status: 502 }))
      .mockRejectedValueOnce(new ReportsApiError({ status: 401 }))
    const { saver, states, onUnauthorized } = saverFor()
    const stateWhenTold = []
    onUnauthorized.mockImplementation(() => stateWhenTold.push(states[states.length - 1]))
    saver.edit(doc('A'))

    // A failed server isn't about the token.
    await expect(saver.flush()).resolves.toBe(false)
    expect(onUnauthorized).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(5000)
    expect(api.saveReport).toHaveBeenCalledTimes(2)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(stateWhenTold).toEqual([
      { status: 'failed', error: 'This change isn’t saved yet: you’re signed out.', savedAt: T0 },
    ])

    await jest.advanceTimersByTimeAsync(120_000)
    expect(api.saveReport).toHaveBeenCalledTimes(2)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('saves a failed change at once on retry(), with the new credentials, and leaves anything else alone', async () => {
    let token = 'expired'
    getAuthentication.mockImplementation(() => ({ ...AUTH, token }))
    api.saveReport.mockRejectedValueOnce(new ReportsApiError({ status: 401 })).mockResolvedValueOnce(saved(2))
    const { saver, last } = saverFor()
    await expect(saver.retry()).resolves.toBe(true)

    // Waiting for its pause isn't a failure: retry() leaves it to that.
    saver.edit(doc('A'))
    await expect(saver.retry()).resolves.toBe(false)
    expect(api.saveReport).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(2000)
    expect(last().status).toBe('failed')

    token = 'fresh'
    await expect(saver.retry()).resolves.toBe(true)
    expect(requests(api.saveReport).map((request) => request.authentication.token)).toEqual(['expired', 'fresh'])
    expect(last()).toEqual({ status: 'saved', error: null, savedAt: saved(2).updatedAt })
  })

  it('settles before a delete: lets the write on its way finish and holds the rest', async () => {
    const first = deferred()
    api.saveReport.mockReturnValueOnce(first.promise)
    const { saver } = saverFor()
    saver.edit(doc('A'))
    await jest.advanceTimersByTimeAsync(2000)
    saver.edit(doc('AB'))

    const settled = saver.settle()
    first.resolve(saved(2))
    await settled
    await jest.advanceTimersByTimeAsync(120_000)
    expect(api.saveReport).toHaveBeenCalledTimes(1)
  })

  it('sends and reports nothing once disposed', async () => {
    const { saver, states } = saverFor()
    saver.edit(doc('A'))
    const seen = states.length
    saver.dispose()
    await jest.advanceTimersByTimeAsync(120_000)
    expect(api.saveReport).not.toHaveBeenCalled()
    expect(states).toHaveLength(seen)
  })

  it('reports nothing about a write that lands after it was disposed, a turned-away token included', async () => {
    const first = deferred()
    api.saveReport.mockReturnValueOnce(first.promise)
    const { saver, states, onUnauthorized } = saverFor()
    saver.edit(doc('A'))
    await jest.advanceTimersByTimeAsync(2000)
    const seen = states.length

    saver.dispose()
    first.reject(new ReportsApiError({ status: 401 }))
    await jest.advanceTimersByTimeAsync(120_000)
    expect(states).toHaveLength(seen)
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(api.saveReport).toHaveBeenCalledTimes(1)
  })
})
