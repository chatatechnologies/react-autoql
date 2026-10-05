import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput } from '../QueryOutput'
import StringAxisSelector from '../../Charts/Axes/StringAxisSelector'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'

beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

// Participants with very different totals, so "sorted by total" differs from column order
const totals = { aegis: 1, alphadna: 5, aqvero: 2, kora: 900, cantor: 400, tabiri: 200 }
const rows = []
for (let r = 1; r <= 8; r++) {
  Object.keys(totals).forEach((p) => rows.push([113000 + r, p, totals[p]]))
}

const queryResponse = {
  data: {
    data: {
      query_id: 'q1',
      rows,
      row_limit: 5000,
      count_rows: rows.length,
      columns: [
        { id: 'c0', name: 'round', display_name: 'Round', index: 0, is_visible: true, groupable: true, type: 'QUANTITY' },
        { id: 'c1', name: 'participant', display_name: 'Participant', index: 1, is_visible: true, groupable: true, type: 'STRING' },
        { id: 'c2', name: 'transfers', display_name: 'Transfers', index: 2, is_visible: true, groupable: false, type: 'QUANTITY' },
      ],
      display_type: 'data',
      interpretation: 'transfers by participant by round',
    },
    message: 'Success',
    reference_id: '1.1.210',
  },
}

const setup = () => {
  const wrapper = mount(
    <QueryOutput queryResponse={queryResponse} initialDisplayType='stacked_column' queryFn={() => {}} height={500} width={800} />,
  )
  wrapper.update()
  return wrapper
}

const seriesOrder = (wrapper) => {
  const instance = wrapper.find('QueryOutput').last().instance()
  const chart = wrapper.find('ChataChart').last().instance()
  const order = chart.sortedNumberColumnIndicesForStacked ?? chart.props.numberColumnIndices
  return order.map((i) => instance.pivotTableColumns[i]?.display_name)
}

describe('stacked series order survives a pivot axis change made from the table', () => {
  it('orders series biggest-first when the axis is changed from the chart', () => {
    const wrapper = setup()
    wrapper.find(StringAxisSelector).at(0).instance().props.changeStringColumnIndex(0)
    wrapper.update()
    expect(seriesOrder(wrapper)).toEqual(['kora', 'cantor', 'tabiri', 'alphadna', 'aqvero', 'aegis'])
  })

  it('orders series the same way when the axis is changed from the pivot table', () => {
    // The chart is hidden behind the pivot table here, so its updates are skipped and getData last
    // ran with type 'pivot_table' — it must re-derive when it becomes visible again, otherwise the
    // series stack and colour in raw column order.
    const wrapper = setup()
    const instance = wrapper.find('QueryOutput').last().instance()

    instance.changeDisplayType('pivot_table')
    wrapper.update()
    wrapper.find('ChataTable').last().props().onPivotAxisChange(0)
    wrapper.update()
    instance.changeDisplayType('stacked_column')
    wrapper.update()

    expect(seriesOrder(wrapper)).toEqual(['kora', 'cantor', 'tabiri', 'alphadna', 'aqvero', 'aegis'])
  })
})
