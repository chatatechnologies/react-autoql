import { getAuthentication, getAutoQLConfig, isChartType, runQuery, REQUEST_CANCELLED_ERROR } from 'autoql-fe-utils'
import {
  getTileQueryText,
  getTileRequestParams,
  getTileScopedAuthentication,
  getTileScopedAutoQLConfig,
} from '../../Dashboard/tileQueryConfig'
import { isDatalessResponse } from '../../../js/responseUtils'
import { MAX_TABLE_ROWS, QUERY_CONCURRENCY, QUESTION_SOURCE, TILE_SOURCE } from '../constants'
import { getTileSupport, resolveTile } from '../model/tiles'

// Running a report: every data block is executed as one run with one timestamp. There is no
// per-block re-run, so the data in a report never mixes ages.

// A tile block runs its tile's saved config exactly as the dashboard does, except a table asks for
// at most MAX_TABLE_ROWS rows: paper can't scroll. The rows the author picks are cut in the browser,
// so changing them never needs a re-run.
export const buildTileRequest = ({ tile, dashboard, authentication, autoQLConfig, getAuthenticationForProject }) => {
  const dashboardSlicers = (Array.isArray(dashboard?.slicers) ? dashboard.slicers : [])
    .map((slicer) => slicer?.data)
    .filter(Boolean)
  const params = getTileRequestParams({ tile, dashboardSlicers })

  return {
    ...getAuthentication(getTileScopedAuthentication({ authentication, tile, getAuthenticationForProject })),
    ...getTileScopedAutoQLConfig(autoQLConfig, tile),
    enableQueryValidation: false,
    skipQueryValidation: true,
    allowSuggestions: false,
    force: false,
    ...params,
    pageSize: isChartType(tile.displayType) ? params.pageSize : MAX_TABLE_ROWS,
    query: getTileQueryText(tile),
    userSelection: tile.queryValidationSelections,
    source: TILE_SOURCE,
    scope: 'dashboards',
  }
}

// A question has no tile to inherit from: it runs as asked, with AutoQL's defaults.
export const buildQuestionRequest = ({ query, authentication, autoQLConfig }) => ({
  ...getAuthentication(authentication),
  ...getAutoQLConfig(autoQLConfig),
  enableQueryValidation: false,
  skipQueryValidation: true,
  allowSuggestions: false,
  query,
  source: QUESTION_SOURCE,
})

const KEY_FIELDS = [
  'query',
  'userSelection',
  'newColumns',
  'displayOverrides',
  'filters',
  'orders',
  'tableFilters',
  'pageSize',
  'projectId',
  'domain',
  'source',
]

// Identifies what a request would fetch, ignoring the token (re-minted hourly) and cancel token.
// Two blocks with the same key share one query; a result whose key no longer matches is stale.
export const getRequestKey = (request) =>
  JSON.stringify(KEY_FIELDS.map((field) => (request?.[field] === undefined ? null : request[field])))

export const planReportRun = ({ report, tileIndex, authentication, autoQLConfig, getAuthenticationForProject }) => {
  const jobs = []
  const skipped = []

  ;(report?.blocks || []).forEach((block) => {
    if (block?.type !== 'data') {
      return
    }
    const { source } = block
    if (!source) {
      skipped.push({ blockId: block.id, reason: 'no-source' })
      return
    }
    if (source.type === 'query') {
      const request = buildQuestionRequest({ query: source.query, authentication, autoQLConfig })
      jobs.push({ blockId: block.id, request, key: getRequestKey(request) })
      return
    }
    const found = resolveTile(tileIndex, source)
    if (!found) {
      skipped.push({ blockId: block.id, reason: 'missing-tile' })
      return
    }
    const support = getTileSupport(found.tile)
    if (!support.supported) {
      skipped.push({ blockId: block.id, reason: support.reason })
      return
    }
    const request = buildTileRequest({
      tile: found.tile,
      dashboard: found.dashboard,
      authentication,
      autoQLConfig,
      getAuthenticationForProject,
    })
    jobs.push({ blockId: block.id, request, key: getRequestKey(request) })
  })

  return { jobs, skipped }
}

const errorOf = (response) => ({
  message: response?.data?.message || response?.message || 'Something went wrong running this query.',
  referenceId: response?.data?.reference_id,
})

export const classifyResponse = (response) => {
  const data = response?.data?.data
  if (isDatalessResponse(response) || data?.replacements) {
    return { status: 'error', error: errorOf(response) }
  }
  const rows = Array.isArray(data?.rows) ? data.rows : []
  return {
    status: 'success',
    response,
    rowCount: rows.length,
    // The server's count of the full result, read from our own copy of the response.
    countRows: typeof data?.count_rows === 'number' ? data.count_rows : null,
  }
}

// runQuery rejects a cancelled request as { data: { message: REQUEST_CANCELLED_ERROR } }.
const isCancellation = (error) =>
  error === REQUEST_CANCELLED_ERROR ||
  error?.message === REQUEST_CANCELLED_ERROR ||
  error?.data?.message === REQUEST_CANCELLED_ERROR

export const classifyError = (error) => {
  if (isCancellation(error)) {
    return { status: 'cancelled' }
  }
  return { status: 'error', error: errorOf(error?.data ? error : { data: error?.response?.data || error }) }
}

// Runs each distinct request once, at most `concurrency` at a time, reporting every block as its
// request settles. Resolves with every block's result.
export const executeReport = ({
  jobs,
  runQueryFn = runQuery,
  concurrency = QUERY_CONCURRENCY,
  cancelToken,
  onSettled = () => {},
}) => {
  const byKey = {}
  const keys = []
  ;(jobs || []).forEach((job) => {
    if (!byKey[job.key]) {
      byKey[job.key] = []
      keys.push(job.key)
    }
    byKey[job.key].push(job)
  })

  const results = {}
  let next = 0

  const runOne = (key) =>
    Promise.resolve()
      .then(() => runQueryFn({ ...byKey[key][0].request, cancelToken }))
      .then(classifyResponse, classifyError)
      .then((outcome) => {
        const { pageSize } = byKey[key][0].request || {}
        byKey[key].forEach((job) => {
          const result = { ...outcome, requestKey: key, pageSize }
          results[job.blockId] = result
          onSettled(job.blockId, result)
        })
      })

  const worker = () => {
    if (next >= keys.length) {
      return Promise.resolve()
    }
    const key = keys[next]
    next += 1
    return runOne(key).then(worker)
  }

  const workers = []
  for (let i = 0; i < Math.min(concurrency, keys.length); i++) {
    workers.push(worker())
  }
  return Promise.all(workers).then(() => results)
}

export const summarizeRun = (results, skipped = []) => {
  const ran = Object.keys(results || {}).map((blockId) => {
    const { status, rowCount, countRows, error } = results[blockId]
    return { blockId, status, rowCount, countRows, error }
  })
  const blocks = [...ran, ...skipped.map(({ blockId }) => ({ blockId, status: 'skipped' }))]
  const statuses = ran.map((block) => block.status)
  let status = 'success'
  if (statuses.includes('cancelled')) status = 'cancelled'
  else if (statuses.length && statuses.every((s) => s === 'error')) status = 'error'
  else if (statuses.includes('error')) status = 'partial'
  return { status, blocks }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const formatRunTime = (iso) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`)
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// On paper the year matters: a printed report is read long after it was made. "23 Sep 2026, 14:05"
export const formatPrintedDate = (iso, { time = false } = {}) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  if (!time) {
    return day
  }
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`)
  return `${day}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// The one line that tells the author how old the report's data is.
export const getRunLabel = ({ run, dataBlockCount, isStale }) => {
  if (!dataBlockCount) return 'Nothing to run'
  if (!run) return 'Never run'
  if (run.status === 'running') return `Running ${run.done} of ${run.total}…`
  const age = `All data as of ${formatRunTime(run.runAt)}`
  return isStale ? `${age} · template edited since` : age
}
