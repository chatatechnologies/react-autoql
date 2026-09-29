import React from 'react'
import { render } from '@testing-library/react'
import { getAnalysisInput, getAnalysisTargets, getAnalysisView } from '../model/analysis'
import { getDataBlockView } from '../model/blockView'
import { runAnalysis } from '../run/analysis'
import { PaperBlock } from '../components/PaperBlock'
import { estimateMeasurements, isPrintable } from '../layout/paginate'
import { normalizeBlock, createBlock } from '../model/reportSchema'

const COLUMNS = [
  { index: 0, name: 'account', display_name: 'Account', type: 'STRING', field: '0', is_visible: true },
  { index: 1, name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT', field: '1', is_visible: true },
]
const rowsOf = (n) => Array.from({ length: n }, (_, i) => [`A-${i + 1}`, 1000 * (i + 1)])

const captureOf = ({ rows, countRows = rows.length, displayType = 'table', queryId = 'q_1' }) => ({
  version: 1,
  capturedAt: '2026-09-29T20:00:00.000Z',
  displayType,
  data: {
    columns: COLUMNS,
    rows,
    count_rows: countRows,
    text: 'aum by account',
    ...(queryId ? { query_id: queryId } : {}),
    interpretation: 'total assets under management by account',
  },
  ...(displayType === 'table' ? { table: { sort: [], filtered: false } } : {}),
  config: { displayType },
})

const dataBlock = (capture, extra = {}) => ({
  id: 'd',
  type: 'data',
  width: 'full',
  rows: 25,
  source: { type: 'query', query: 'aum by account' },
  capture,
  ...extra,
})

const viewOf = (block) => getDataBlockView({ block })

describe('what an analysis reads', () => {
  it('reads the rows a table prints, every column, and names the slice', () => {
    const target = dataBlock(captureOf({ rows: rowsOf(30), countRows: 88 }))
    const input = getAnalysisInput({ target, targetView: viewOf(target) })

    expect(input).toMatchObject({
      queryId: 'q_1',
      text: 'aum by account, first 25 of 88 rows',
      interpretation: 'total assets under management by account',
      asOf: '2026-09-29T20:00:00.000Z',
      title: 'aum by account',
    })
    expect(input.rows).toHaveLength(25)
    expect(input.columns).toBe(target.capture.data.columns)
  })

  it('reads every row a chart draws, with no slice when that’s all of it', () => {
    const target = dataBlock(captureOf({ rows: rowsOf(6), displayType: 'column' }))
    const input = getAnalysisInput({ target, targetView: viewOf(target) })
    expect(input.rows).toHaveLength(6)
    expect(input.text).toBe('aum by account')
  })

  it('reads nothing without a result on show, or without a query id', () => {
    const target = dataBlock(captureOf({ rows: rowsOf(3), queryId: null }))
    expect(getAnalysisInput({ target, targetView: viewOf(target) })).toBeNull()
    const empty = { id: 'e', type: 'data', source: null, rows: 25 }
    expect(getAnalysisInput({ target: empty, targetView: viewOf(empty) })).toBeNull()
  })

  it('lists the results in the report it can be about, as they’re titled', () => {
    const question = dataBlock(captureOf({ rows: rowsOf(3) }))
    const empty = { id: 'e', type: 'data', source: null, rows: 25 }
    const blocks = [{ id: 'h', type: 'heading', text: 'Q3', level: 2 }, question, empty]
    const views = { d: viewOf(question), e: viewOf(empty) }
    expect(getAnalysisTargets(blocks, views)).toStrictEqual([{ id: 'd', label: '“aum by account”' }])
  })
})

describe('what an analysis shows', () => {
  const target = dataBlock(captureOf({ rows: rowsOf(3) }))
  const targetView = viewOf(target)
  const analysis = (extra = {}) => normalizeBlock({ id: 'a', type: 'analysis', target: 'd', ...extra })

  it('is empty until written, and can be written while its result can be read', () => {
    expect(getAnalysisView({ block: analysis(), target, targetView })).toMatchObject({
      state: 'empty',
      canAnalyze: true,
      targetGone: false,
      targetChanged: false,
    })
  })

  it('says what it was written from', () => {
    const view = getAnalysisView({
      block: analysis({
        text: 'Up 18%.',
        targetTitle: 'aum by account',
        focusUsed: 'growth',
        targetAsOf: target.capture.capturedAt,
      }),
      target,
      targetView,
    })
    expect(view).toMatchObject({ state: 'written', text: 'Up 18%.', fromTitle: 'aum by account', focusUsed: 'growth' })
    expect(view.targetChanged).toBe(false)
  })

  it('knows when its result was removed, or captured again since', () => {
    expect(getAnalysisView({ block: analysis({ text: 'x' }), target: undefined }).targetGone).toBe(true)
    expect(
      getAnalysisView({ block: analysis({ text: 'x', targetAsOf: '2026-09-01T00:00:00.000Z' }), target, targetView })
        .targetChanged,
    ).toBe(true)
  })

  it('is kept as a block, and made empty', () => {
    expect(createBlock('analysis', { target: 'd' })).toMatchObject({
      type: 'analysis',
      target: 'd',
      focus: '',
      text: '',
    })
    expect(normalizeBlock({ id: 'a', type: 'analysis', text: 3, writtenAt: 'w' })).toStrictEqual({
      id: 'a',
      type: 'analysis',
      width: 'full',
      target: null,
      focus: '',
      text: '',
      writtenAt: 'w',
    })
  })
})

describe('runAnalysis', () => {
  const AUTH = { token: 't', apiKey: 'k', domain: 'https://example.test' }
  const target = dataBlock(captureOf({ rows: rowsOf(30), countRows: 88 }))
  const input = getAnalysisInput({ target, targetView: viewOf(target) })

  it('asks the way an answer’s own Auto Analyze does', async () => {
    const fetchSummary = jest.fn(() => Promise.resolve({ data: { data: { summary: '**A-30** leads.' } } }))
    const result = await runAnalysis({ input, focus: ' growth ', authentication: AUTH, fetchSummary })

    expect(result).toStrictEqual({ ok: true, text: '**A-30** leads.' })
    expect(fetchSummary).toHaveBeenCalledTimes(1)
    const [request] = fetchSummary.mock.calls[0]
    expect(request).toMatchObject({ queryID: 'q_1', apiKey: 'k', token: 't', domain: 'https://example.test' })
    expect(request.data.additional_context).toStrictEqual({
      text: 'aum by account, first 25 of 88 rows',
      interpretation: 'total assets under management by account',
      focus_prompt: 'growth',
    })
    expect(request.data.rows).toHaveLength(25)
    expect(request.data.columns).toHaveLength(2)
  })

  it('says why over quota, as the answer’s Auto Analyze does', async () => {
    const fetchSummary = () =>
      Promise.reject({
        reference_id: '1.1.402',
        message: 'Usage ceiling reached',
        data: { code: 'BILLING_USAGE_CEILING_REACHED', outcome: 'BLOCK_CEILING_EXCEEDED' },
      })
    const result = await runAnalysis({ input, authentication: AUTH, fetchSummary })
    expect(result.ok).toBe(false)
    expect(result.billing).toBe('over_quota')
    expect(result.message).toMatch(/at or over its monthly quota/)
  })

  it('says what went wrong otherwise', async () => {
    const result = await runAnalysis({
      input,
      authentication: AUTH,
      fetchSummary: () => Promise.reject({ message: 'Timed out.' }),
    })
    expect(result).toStrictEqual({ ok: false, message: 'Auto Analyze couldn’t write this. Timed out.' })
    expect(
      await runAnalysis({ input, authentication: AUTH, fetchSummary: () => Promise.resolve({ data: { data: {} } }) }),
    ).toStrictEqual({ ok: false, message: 'Auto Analyze couldn’t write this.' })
  })
})

describe('an analysis on paper', () => {
  const view = (extra = {}) => ({
    state: 'written',
    text: '**South** led, up 18%.\nNorth slipped.\n\n- one\n- two\n\n##### Small\n\nSee [the site](https://x.test) <b>raw</b>',
    fromTitle: 'aum by account',
    focusUsed: 'growth',
    targetGone: false,
    targetChanged: false,
    ...extra,
  })
  const paper = (props) =>
    render(<PaperBlock block={{ id: 'a', type: 'analysis', text: 'x' }} mode='page' view={view()} {...props} />)

  it('prints its Markdown as prose, lists and emphasis, with where it came from', () => {
    const { container } = paper()
    const text = container.querySelector('.react-autoql-report-builder-analysis-text')
    expect(text.querySelector('strong').textContent).toBe('South')
    expect(text.querySelector('br')).not.toBeNull()
    expect(text.querySelectorAll('ul li')).toHaveLength(2)
    expect(text.querySelector('h4').textContent).toBe('Small')
    expect(text.querySelector('a')).toBeNull()
    expect(text.textContent).toContain('the site')
    expect(text.querySelector('b')).toBeNull()
    expect(container.querySelector('.react-autoql-report-builder-analysis-meta').textContent).toBe(
      '✦ Auto Analyze · from “aum by account” · focus: growth',
    )
  })

  it('keeps editor notes off the page', () => {
    const { container, rerender } = paper({ view: view({ targetChanged: true }) })
    expect(container.querySelector('.react-autoql-report-builder-analysis-note')).toBeNull()
    rerender(
      <PaperBlock block={{ id: 'a', type: 'analysis', text: 'x' }} mode='edit' view={view({ targetChanged: true })} />,
    )
    expect(container.querySelector('.react-autoql-report-builder-analysis-note').textContent).toMatch(
      /has changed since this was written/,
    )
  })

  it('prints nothing until written', () => {
    const { container } = paper({ view: { state: 'empty' } })
    expect(container.innerHTML).toBe('')
    expect(isPrintable({ type: 'analysis', text: '  ' })).toBe(false)
    expect(isPrintable({ type: 'analysis', text: 'Up 18%.' })).toBe(true)
  })

  it('gets a height to lay out with when the page can’t be measured', () => {
    const block = { id: 'a', type: 'analysis', text: 'One line.\nTwo lines.', width: 'full' }
    const { blocks } = estimateMeasurements({ blocks: [block], views: {}, contentWidthPx: 700 })
    expect(blocks.a).toBeGreaterThan(40)
  })
})
