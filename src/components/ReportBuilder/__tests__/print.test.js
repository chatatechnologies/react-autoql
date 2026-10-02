import { CHART_BOX_ATTRIBUTE, getChartStatus, getChartsStatus, waitForCharts } from '../print/waitForCharts'
import { buildPrintDocument, collectStyleMarkup, getPrintCss, PAGE_CLASS, printFrame } from '../print/printFrame'
import { waitForFonts } from '../print/fonts'

const chartBox = (inner) => {
  const box = document.createElement('div')
  box.setAttribute(CHART_BOX_ATTRIBUTE, '')
  box.innerHTML = inner
  return box
}
const DRAWING = '<div class="react-autoql-chart-container react-autoql-chart-loading"><svg></svg></div>'
const DRAWN = '<div class="react-autoql-chart-container"><svg></svg></div>'
const FAILED = '<div class="query-output-error-message">Something went wrong</div>'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('class')
})

describe('getChartStatus', () => {
  it('is ready only once the chart has drawn an svg and dropped its loading class', () => {
    expect(getChartStatus(chartBox(DRAWING))).toBe('pending')
    expect(getChartStatus(chartBox(DRAWN))).toBe('ready')
    expect(getChartStatus(chartBox('<div class="react-autoql-chart-container"></div>'))).toBe('pending')
    expect(getChartStatus(chartBox(''))).toBe('pending')
  })

  it('treats a loading chart header as still drawing', () => {
    const box = chartBox(`<div class="react-autoql-chart-header-container react-autoql-chart-loading"></div>${DRAWN}`)
    expect(getChartStatus(box)).toBe('pending')
  })

  it('is failed when QueryOutput rendered its error message', () => {
    expect(getChartStatus(chartBox(FAILED))).toBe('failed')
  })

  it('counts every chart under a root', () => {
    const root = document.createElement('div')
    root.append(chartBox(DRAWN), chartBox(DRAWING), chartBox(FAILED))
    expect(getChartsStatus(root)).toStrictEqual({ total: 3, ready: 1, failed: 1, pending: 1 })
  })
})

describe('waitForCharts', () => {
  it('resolves straight away when there is nothing to wait for', async () => {
    const root = document.createElement('div')
    await expect(waitForCharts(root)).resolves.toMatchObject({ total: 0, pending: 0, timedOut: false })
  })

  it('waits for a chart to finish drawing', async () => {
    const root = document.createElement('div')
    const box = chartBox(DRAWING)
    root.append(box)
    setTimeout(() => box.firstChild.classList.remove('react-autoql-chart-loading'), 30)

    const result = await waitForCharts(root, { interval: 5, timeout: 2000 })
    expect(result).toMatchObject({ total: 1, ready: 1, pending: 0, timedOut: false })
  })

  it('gives up after the timeout instead of hanging, and says so', async () => {
    const root = document.createElement('div')
    root.append(chartBox(DRAWING), chartBox(DRAWN))
    const result = await waitForCharts(root, { interval: 5, timeout: 40 })
    expect(result).toMatchObject({ total: 2, ready: 1, pending: 1, timedOut: true })
  })

  it('stops when aborted', async () => {
    const root = document.createElement('div')
    root.append(chartBox(DRAWING))
    const controller = new AbortController()
    const waiting = waitForCharts(root, { interval: 5, timeout: 5000, signal: controller.signal })
    controller.abort()
    await expect(waiting).resolves.toMatchObject({ aborted: true, timedOut: false, pending: 1 })
  })
})

describe('collectStyleMarkup', () => {
  it('copies linked and inline stylesheets in document order', () => {
    document.head.innerHTML = `
      <link rel="stylesheet" href="/app.css" media="all">
      <style>.a { color: red; }</style>
      <link rel="icon" href="/favicon.ico">`
    document.body.innerHTML = '<style>.b { color: blue; }</style>'

    const markup = collectStyleMarkup(document)
    const link = markup.indexOf('href="http://localhost/app.css"')
    const a = markup.indexOf('.a')
    const b = markup.indexOf('.b')

    expect(link).toBeGreaterThan(-1)
    expect(markup).toContain('media="all"')
    expect(a).toBeGreaterThan(link)
    expect(b).toBeGreaterThan(a)
    expect(markup).not.toContain('favicon')
  })

  it('copies rules inserted through the CSSOM, which leave the element empty', () => {
    const style = document.createElement('style')
    document.head.appendChild(style)
    style.sheet.insertRule('.injected { color: green; }', 0)
    expect(style.textContent).toBe('')
    expect(collectStyleMarkup(document)).toContain('.injected')
  })

  it('cannot be ended early by CSS text', () => {
    // Only reachable through the CSSOM: an HTML parser ends the element at the first "</style".
    const style = document.createElement('style')
    document.head.appendChild(style)
    style.sheet.insertRule('.x::after { content: "</style><script>alert(1)</script>"; }', 0)

    const markup = collectStyleMarkup(document)
    expect(markup).toContain('.x::after')
    expect(markup).not.toContain('</style><script>')
    expect(markup.match(/<\/style>/g)).toHaveLength(1)
  })
})

describe('buildPrintDocument', () => {
  const parse = (html) => new DOMParser().parseFromString(html, 'text/html')

  it('carries the host’s theme variables and stylesheets, and puts the print CSS last', () => {
    document.documentElement.style.setProperty('--react-autoql-accent-color', '#123456')
    document.documentElement.className = 'dark'
    document.head.innerHTML = '<style>.host { color: red; }</style>'

    const doc = parse(
      buildPrintDocument({
        pagesHtml: `<div class="${PAGE_CLASS}">One</div>`,
        title: 'Q3 <Board>',
        orientation: 'landscape',
      }),
    )

    expect(doc.documentElement.getAttribute('style')).toContain('--react-autoql-accent-color: #123456')
    expect(doc.documentElement.className).toBe('dark')
    expect(doc.title).toBe('Q3 <Board>')
    expect(doc.querySelector('base').getAttribute('href')).toBe(document.baseURI)

    const styles = Array.from(doc.querySelectorAll('style'))
    expect(styles[0].textContent).toContain('.host')
    expect(styles[styles.length - 1].hasAttribute('data-report-print')).toBe(true)
    expect(styles[styles.length - 1].textContent).toContain('size: letter landscape')

    expect(doc.querySelectorAll(`.${PAGE_CLASS}`)).toHaveLength(1)
  })

  it('sizes pages to Letter, one per sheet, with no browser margins', () => {
    const portrait = getPrintCss('portrait')
    expect(portrait).toContain('size: letter portrait; margin: 0;')
    expect(portrait).toContain('height: calc(11in - 1px)')
    expect(portrait).toContain('break-after: page')
    expect(getPrintCss('landscape')).toContain('height: calc(8.5in - 1px)')
  })
})

describe('printFrame', () => {
  const page = (text) => {
    const el = document.createElement('div')
    el.className = PAGE_CLASS
    el.textContent = text
    return el
  }

  it('prints the pages from an off-screen frame, then cleans up after the dialog closes', async () => {
    document.title = 'Host app'
    const print = jest.fn()
    const { frame, printed } = printFrame({ pages: [page('One'), page('Two')], title: 'Board pack', print })

    expect(frame.parentNode).toBe(document.body)
    expect(frame.style.left).toBe('-10000px')
    expect(frame.srcdoc).toContain('>One</div>')
    expect(frame.srcdoc).toContain('>Two</div>')

    await expect(printed).resolves.toBe(true)
    expect(print).toHaveBeenCalledWith(frame.contentWindow)
    expect(document.title).toBe('Board pack')

    frame.contentWindow.dispatchEvent(new Event('afterprint'))
    expect(frame.parentNode).toBeNull()
    expect(document.title).toBe('Host app')
  })

  it('says it printed when the dialog closes before print() returns, as in Chrome', async () => {
    document.title = 'Host app'
    const print = (win) => win.dispatchEvent(new Event('afterprint')) // a blocking dialog, already closed
    const { frame, printed } = printFrame({ pages: [page('One')], title: 'Board pack', print })
    await expect(printed).resolves.toBe(true)
    expect(frame.parentNode).toBeNull()
    expect(document.title).toBe('Host app')
  })

  it('does not print if removed before the frame loads, and says it did not', async () => {
    const print = jest.fn()
    const { frame, remove, printed } = printFrame({ pages: [page('One')], print })
    remove()
    await expect(printed).resolves.toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(print).not.toHaveBeenCalled()
    expect(frame.parentNode).toBeNull()
  })

  it('removes the frame and rejects when printing throws', async () => {
    const error = new Error('blocked')
    const { frame, printed } = printFrame({
      pages: [page('One')],
      print: () => {
        throw error
      },
    })
    await expect(printed).rejects.toBe(error)
    expect(frame.parentNode).toBeNull()
  })
})

describe('waitForFonts', () => {
  it('resolves without the Font Loading API', async () => {
    await expect(waitForFonts({})).resolves.toBe(false)
  })

  it('resolves when fonts are ready, or when the timeout runs out', async () => {
    await expect(waitForFonts({ fonts: { ready: Promise.resolve() } })).resolves.toBe(true)
    await expect(waitForFonts({ fonts: { ready: new Promise(() => {}) } }, 20)).resolves.toBe(false)
  })
})
