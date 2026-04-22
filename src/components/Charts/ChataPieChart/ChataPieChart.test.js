import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import ChataPieChart from './ChataPieChart'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const datePivotSampleProps = sampleProps.datePivot
const defaultProps = ChataPieChart.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataPieChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup(datePivotSampleProps)
    const pieChartComponent = findByTestAttr(wrapper, 'react-autoql-pie-chart')
    expect(pieChartComponent.exists()).toBe(true)
  })
})

describe('onSliceClick', () => {
  test('passes date filter when string axis is DATE column', () => {
    const onChartClick = jest.fn()
    const dateColumn = { name: 'trade_date', type: 'DATE', precision: 'day' }
    const columns = [dateColumn, { name: 'amount', type: 'QUANTITY' }]
    const dataFormatting = {}

    const wrapper = setup({
      ...datePivotSampleProps,
      onChartClick,
      columns,
      stringColumnIndex: 0,
      numberColumnIndex: 1,
      dataFormatting,
    })

    const instance = wrapper.instance()
    const mockSliceData = {
      data: {
        key: 'slice-1',
        value: ['2024-01-15', 100],
      },
    }

    instance.onSliceClick(mockSliceData)

    expect(onChartClick).toHaveBeenCalledWith(
      expect.objectContaining({
        row: ['2024-01-15', 100],
        columnIndex: 1,
        columns,
        stringColumnIndex: 0,
        activeKey: 'slice-1',
        filter: expect.objectContaining({
          name: 'trade_date',
          operator: 'between',
          column_type: 'DATE',
        }),
      }),
    )
    const filter = onChartClick.mock.calls[0][0].filter
    expect(filter.value).toBeDefined()
    expect(filter.value).toContain(',')
  })
})
