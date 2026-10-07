// A chart is drawn by ChataChart after it has measured its box, so a page can be in the DOM before its
// charts are. Printing waits until every chart in the report has either drawn or failed.

export const CHART_BOX_ATTRIBUTE = 'data-report-chart'
export const CHART_BOX_SELECTOR = `[${CHART_BOX_ATTRIBUTE}]`

export const DEFAULT_CHART_TIMEOUT = 15000

// ChataChart puts react-autoql-chart-loading on its container (and header) while it draws, and a failed
// output renders QueryOutput's error message instead of a chart.
export const getChartStatus = (box) => {
  if (!box) {
    return 'pending'
  }
  if (box.querySelector('.query-output-error-message')) {
    return 'failed'
  }
  const drawn = box.querySelector('.react-autoql-chart-container svg')
  if (drawn && !box.querySelector('.react-autoql-chart-loading')) {
    return 'ready'
  }
  return 'pending'
}

export const getChartsStatus = (root) => {
  const boxes = root ? Array.from(root.querySelectorAll(CHART_BOX_SELECTOR)) : []
  const counts = { total: boxes.length, ready: 0, failed: 0, pending: 0 }
  boxes.forEach((box) => {
    counts[getChartStatus(box)] += 1
  })
  return counts
}

// Resolves once no chart under `root` is still drawing, or when `timeout` runs out (timedOut: true).
// Never rejects: a chart that never finishes shouldn't stop the rest of the report from printing.
export const waitForCharts = (root, { timeout = DEFAULT_CHART_TIMEOUT, interval = 100, signal } = {}) =>
  new Promise((resolve) => {
    const startedAt = Date.now()
    let timer

    const check = () => {
      const counts = getChartsStatus(root)
      const aborted = !!signal?.aborted
      const timedOut = !aborted && counts.pending > 0 && Date.now() - startedAt >= timeout
      if (counts.pending === 0 || timedOut || aborted) {
        resolve({ ...counts, timedOut, aborted })
        return
      }
      timer = setTimeout(check, interval)
    }

    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer)
      check()
    })
    check()
  })
