import React from 'react'
import { shallow, mount } from 'enzyme'
import { transformQueryResponse } from 'autoql-fe-utils'
import { Dashboard } from '../Dashboard'

jest.mock('tabulator-tables', () => require('../../../../test/utils/tabulatorMockFactory')())
// The grid only places tiles; jsdom has no width for it to measure.
jest.mock('react-grid-layout', () => {
  const RGL = ({ children }) => <div>{children}</div>
  return { __esModule: true, default: RGL, WidthProvider: (C) => C }
})

const setup = (props = {}) => shallow(<Dashboard {...Dashboard.defaultProps} {...props} />).dive()

const captured = (rows) => ({ ok: true, capture: { displayType: 'table', data: { rows } } })
const fakeTile = (rows) => ({ captureForReport: jest.fn(() => captured(rows)) })

const TILES = [
  { key: 'b', i: 'b', x: 6, y: 0, w: 6, h: 5, query: 'sales by month', title: 'Sales', displayType: 'column' },
  { key: 'c', i: 'c', x: 0, y: 5, w: 12, h: 5, query: 'aum by household', title: '', displayType: 'table' },
  { key: 'a', i: 'a', x: 0, y: 0, w: 6, h: 5, query: 'top clients', title: 'Clients', displayType: 'table' },
]

describe('Dashboard.captureTilesForReport', () => {
  it('captures every tile, in reading order, when no keys are given', () => {
    const instance = setup({ tiles: TILES, dashboardId: 'dash-1' }).instance()
    instance.tileRefs = { a: fakeTile([[1]]), b: fakeTile([[2]]), c: fakeTile([[3]]) }

    const entries = instance.captureTilesForReport()

    expect(entries.map((entry) => entry.tileKey)).toStrictEqual(['a', 'b', 'c'])
    expect(entries[0]).toStrictEqual({
      tileKey: 'a',
      dashboardId: 'dash-1',
      title: 'Clients',
      query: 'top clients',
      displayType: 'table',
      result: captured([[1]]),
    })
    // An untitled tile is called by its question, as its header shows it.
    expect(entries[2].title).toBe('aum by household')
  })

  it('keeps the order of the keys asked for, and says which it has no tile for', () => {
    const instance = setup({ tiles: TILES, dashboardId: 'dash-1' }).instance()
    instance.tileRefs = { a: fakeTile([[1]]), b: fakeTile([[2]]), c: fakeTile([[3]]) }

    const entries = instance.captureTilesForReport({ tileKeys: ['c', 'gone', 'a'] })

    expect(entries.map((entry) => entry.tileKey)).toStrictEqual(['c', 'gone', 'a'])
    expect(entries[1]).toStrictEqual({
      tileKey: 'gone',
      dashboardId: 'dash-1',
      title: '',
      query: '',
      displayType: undefined,
      result: { ok: false, reason: 'not-found' },
    })
    expect(instance.tileRefs.b.captureForReport).not.toHaveBeenCalled()
  })

  it('reports loading for a tile that isn’t on screen yet', () => {
    const instance = setup({ tiles: TILES }).instance()
    instance.tileRefs = { a: fakeTile([[1]]) }

    const entries = instance.captureTilesForReport({ tileKeys: ['a', 'b'] })

    expect(entries[0].result.ok).toBe(true)
    expect(entries[1].result).toStrictEqual({ ok: false, reason: 'loading' })
  })

  it('passes the row limits to each tile', () => {
    const instance = setup({ tiles: TILES }).instance()
    instance.tileRefs = { a: fakeTile([[1]]) }

    instance.captureTilesForReport({ tileKeys: ['a'], maxTableRows: 10, maxChartRows: 50 })

    expect(instance.tileRefs.a.captureForReport).toHaveBeenCalledWith({ maxTableRows: 10, maxChartRows: 50 })
  })

  it('finds a tile by its id as well as its key', () => {
    const instance = setup({ tiles: [{ ...TILES[2], key: 'key-a', i: 'id-a' }] }).instance()
    instance.tileRefs = { 'key-a': fakeTile([[1]]) }

    const [entry] = instance.captureTilesForReport({ tileKeys: ['id-a'] })

    expect(entry.tileKey).toBe('key-a')
    expect(entry.result.ok).toBe(true)
  })
})

describe('Dashboard.captureTilesForReport with its tiles on screen', () => {
  // A grouped result, transformed the way runQuery hands it over (columns get `field` and `index`).
  const responseOf = (n, id) =>
    transformQueryResponse({
      data: {
        reference_id: '1.1.200',
        message: 'Success',
        data: {
          text: 'total aum by region',
          query_id: id,
          display_type: 'data',
          count_rows: n,
          columns: [
            { name: 'region', display_name: 'Region', type: 'STRING', groupable: true, is_visible: true },
            { name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT', groupable: false, is_visible: true },
          ],
          rows: Array.from({ length: n }, (_, i) => [`R-${i + 1}`, 1000 * (i + 1)]),
        },
      },
    })

  const withoutTime = (result) => (result?.ok ? { ...result, capture: { ...result.capture, capturedAt: 'x' } } : result)

  it('captures each tile exactly as the tile captures itself', () => {
    const tiles = [
      { ...TILES[0], displayType: 'column', queryResponse: responseOf(6, 'q_b') },
      { ...TILES[2], displayType: 'table', queryResponse: responseOf(4, 'q_a') },
      { ...TILES[1], queryResponse: undefined },
    ]
    const wrapper = mount(<Dashboard tiles={tiles} dashboardId='dash-1' onChange={() => {}} />)
    const dashboard = wrapper.find('DashboardWithoutTheme').instance()

    const entries = dashboard.captureTilesForReport()

    expect(entries.map((entry) => [entry.tileKey, entry.result.ok, entry.result.reason])).toStrictEqual([
      ['a', true, undefined],
      ['b', true, undefined],
      ['c', false, 'loading'],
    ])
    expect(entries[0].result.capture).toMatchObject({ displayType: 'table', data: { query_id: 'q_a' } })
    expect(entries[1].result.capture).toMatchObject({ displayType: 'column', data: { query_id: 'q_b' } })
    entries.slice(0, 2).forEach((entry) => {
      expect(withoutTime(entry.result)).toStrictEqual(withoutTime(dashboard.tileRefs[entry.tileKey].captureForReport()))
    })
    wrapper.unmount()
  })
})
