import React from 'react'
import { mount } from 'enzyme'
import { transformQueryResponse } from 'autoql-fe-utils'
import { DashboardTile } from '../DashboardTile'
import { QueryOutput } from '../../../QueryOutput/QueryOutput'

jest.mock('tabulator-tables', () => require('../../../../../test/utils/tabulatorMockFactory')())

// A grouped result, transformed the way runQuery hands it over (columns get `field` and `index`).
const responseOf = (n) =>
  transformQueryResponse({
    data: {
      reference_id: '1.1.200',
      message: 'Success',
      data: {
        text: 'total aum by region',
        query_id: `q_${n}`,
        interpretation: 'total assets under management by region',
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

const makeTile = (overrides = {}) => ({
  i: 'tile-1',
  key: 'tile-1',
  x: 0,
  y: 0,
  w: 6,
  h: 5,
  query: 'total aum by region',
  title: 'AUM by region',
  displayType: 'column',
  queryResponse: responseOf(6),
  ...overrides,
})

const mountTile = (tile = makeTile(), props = {}) =>
  mount(<DashboardTile tile={tile} setParamsForTile={() => {}} dashboardId='dash-1' tileKey={tile.key} {...props} />)

// Two captures of the same answer differ only in when they were taken.
const withoutTime = (result) => (result?.ok ? { ...result, capture: { ...result.capture, capturedAt: 'x' } } : result)

describe('DashboardTile.captureForReport', () => {
  it('captures what its answer shows, exactly as the answer captures itself', () => {
    const wrapper = mountTile()
    const instance = wrapper.instance()

    const result = instance.captureForReport()
    expect(result.ok).toBe(true)
    expect(result.capture).toMatchObject({
      displayType: 'column',
      data: { count_rows: 6, text: 'total aum by region', query_id: 'q_6' },
    })
    expect(result.capture.data.rows).toHaveLength(6)
    const answer = wrapper.find(QueryOutput).instance()
    expect(withoutTime(result)).toStrictEqual(withoutTime(answer.captureForReport()))
    wrapper.unmount()
  })

  it('passes the row limits on', () => {
    const wrapper = mountTile()
    expect(wrapper.instance().captureForReport({ maxChartRows: 5 })).toStrictEqual({
      ok: false,
      reason: 'too-large',
      rowCount: 6,
    })
    wrapper.unmount()
  })

  it('reports loading while the tile runs, not the answer it showed before', () => {
    const wrapper = mountTile()
    const instance = wrapper.instance()
    expect(instance.captureForReport().ok).toBe(true)

    wrapper.setState({ isTopExecuting: true })
    expect(instance.captureForReport()).toStrictEqual({ ok: false, reason: 'loading' })
    wrapper.unmount()
  })

  it('reports loading for a tile whose question has no answer yet', () => {
    const wrapper = mountTile(makeTile({ queryResponse: undefined }))
    expect(wrapper.instance().captureForReport()).toStrictEqual({ ok: false, reason: 'loading' })
    wrapper.unmount()
  })

  it('reports no data for a tile without a question', () => {
    const wrapper = mountTile(makeTile({ query: '', queryResponse: undefined }))
    expect(wrapper.instance().captureForReport()).toStrictEqual({ ok: false, reason: 'no-data' })
    wrapper.unmount()
  })

  it('captures the new answer once the tile’s answer is replaced', () => {
    const tile = makeTile()
    const wrapper = mountTile(tile)
    const instance = wrapper.instance()
    const first = wrapper.find(QueryOutput).instance()

    wrapper.setProps({ tile: { ...tile, queryResponse: responseOf(3) } })
    wrapper.update()

    expect(wrapper.find(QueryOutput).instance()).not.toBe(first)
    const result = instance.captureForReport()
    expect(result.ok).toBe(true)
    expect(result.capture.data.rows).toHaveLength(3)
    expect(result.capture.data.query_id).toBe('q_3')
    wrapper.unmount()
  })
})
