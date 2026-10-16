import React from 'react'
import { mount } from 'enzyme'
import { transformQueryResponse } from 'autoql-fe-utils'
import { QueryOutput } from '../QueryOutput'

// A grouped result, transformed the way runQuery hands it over (columns get `field` and `index`).
const responseOf = (n, countRows = n) =>
  transformQueryResponse({
    data: {
      reference_id: '1.1.200',
      message: 'Success',
      data: {
        text: 'total aum by region',
        query_id: 'q_1',
        interpretation: 'total assets under management by region',
        display_type: 'data',
        count_rows: countRows,
        columns: [
          { name: 'region', display_name: 'Region', type: 'STRING', groupable: true, is_visible: true },
          { name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT', groupable: false, is_visible: true },
        ],
        rows: Array.from({ length: n }, (_, i) => [`R-${i + 1}`, 1000 * (i + 1)]),
        fe_req: { text: 'total aum by region', orders: [{ name: 'aum', sort: 'DESC' }] },
      },
    },
  })

const mountOutput = (props) => mount(<QueryOutput queryFn={() => {}} {...props} />)

describe('QueryOutput.captureForReport', () => {
  it('captures a chart as its data and the settings that shape it, as plain JSON', () => {
    const wrapper = mountOutput({ queryResponse: responseOf(6), initialDisplayType: 'column' })
    const result = wrapper.instance().captureForReport()

    expect(result.ok).toBe(true)
    const { capture } = result
    expect(capture).toMatchObject({
      version: 1,
      displayType: 'column',
      data: { rows: expect.any(Array), count_rows: 6, text: 'total aum by region', query_id: 'q_1' },
      config: { displayType: 'column', orders: [{ name: 'aum', sort: 'DESC' }] },
    })
    expect(capture.data.rows).toHaveLength(6)
    expect(capture.data.columns.map((col) => col.name)).toStrictEqual(['region', 'aum'])
    expect(capture.config.dataConfig.tableConfig).toBeDefined()
    expect(capture.config.columnVisibility).toStrictEqual({ region: true, aum: true })
    expect(typeof capture.capturedAt).toBe('string')
    expect(JSON.parse(JSON.stringify(capture))).toStrictEqual(capture)
    wrapper.unmount()
  })

  it('refuses a chart with more rows than a report keeps', () => {
    const wrapper = mountOutput({ queryResponse: responseOf(6), initialDisplayType: 'column' })
    expect(wrapper.instance().captureForReport({ maxChartRows: 5 })).toStrictEqual({
      ok: false,
      reason: 'too-large',
      rowCount: 6,
    })
    wrapper.unmount()
  })

  it('keeps a table’s first rows only, with the count of the whole result', () => {
    const wrapper = mountOutput({ queryResponse: responseOf(120, 30044), initialDisplayType: 'table' })
    const { ok, capture } = wrapper.instance().captureForReport({ maxTableRows: 100 })
    expect(ok).toBe(true)
    expect(capture.displayType).toBe('table')
    expect(capture.data.rows).toHaveLength(100)
    expect(capture.data.count_rows).toBe(30044)
    expect(capture.table).toBeDefined()
    wrapper.unmount()
  })

  it('takes a table’s rows as the table shows them, when the table can say', () => {
    const wrapper = mountOutput({ queryResponse: responseOf(10), initialDisplayType: 'table' })
    const instance = wrapper.instance()
    instance.tableRef = {
      getReportView: (maxRows) => ({
        rows: [
          ['R-10', 10000],
          ['R-9', 9000],
        ].slice(0, maxRows),
        columnFields: ['1', '0'],
        sort: [{ field: '1', dir: 'desc' }],
        filters: [
          { field: '0', value: 'R-1' },
          { field: '1', value: '' },
        ],
        total: 10,
        filtered: true,
      }),
    }
    const { capture } = instance.captureForReport()
    expect(capture.data.rows).toStrictEqual([
      ['R-10', 10000],
      ['R-9', 9000],
    ])
    expect(capture.table).toStrictEqual({
      columnIndices: [1, 0],
      sort: [{ name: 'aum', sort: 'DESC' }],
      filters: [{ name: 'region', value: 'R-1' }],
      filtered: true,
    })
    wrapper.unmount()
  })

  it('has nothing to capture for a pivot table or an answer with no data', () => {
    // A report can't print a pivot table yet (v1), whatever the data supports.
    const pivot = mountOutput({ queryResponse: responseOf(6), initialDisplayType: 'table' })
    pivot.instance().setState({ displayType: 'pivot_table' })
    expect(pivot.instance().captureForReport()).toStrictEqual({ ok: false, reason: 'unsupported' })
    pivot.unmount()

    const empty = mountOutput({ queryResponse: { data: { reference_id: '1.1.200', data: {} } } })
    expect(empty.instance().captureForReport()).toStrictEqual({ ok: false, reason: 'no-data' })
    empty.unmount()
  })
})
