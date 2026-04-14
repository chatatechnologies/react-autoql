import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import Circles, { parseBubbleCellValue } from './Circles'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'

beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const defaultProps = Circles.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Circles {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('parseBubbleCellValue', () => {
  test('treats null, undefined, and empty string as missing (not zero)', () => {
    expect(parseBubbleCellValue(null)).toBeNull()
    expect(parseBubbleCellValue(undefined)).toBeNull()
    expect(parseBubbleCellValue('')).toBeNull()
    expect(parseBubbleCellValue(0)).toBe(0)
    expect(parseBubbleCellValue(0.4)).toBeCloseTo(0.4)
    expect(parseBubbleCellValue('0.35')).toBeCloseTo(0.35)
  })
})

describe('renders correctly', () => {
  test('renders regular pivot chart data correctly', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      xScale: pivotSampleProps.stringScale(),
      yScale: pivotSampleProps.stringScale(),
    })
    const circlesComponent = findByTestAttr(wrapper, 'circles')
    expect(circlesComponent.exists()).toBe(true)
  })
})

describe('onCircleClick', () => {
  test('passes date filter when string axis is DATE column', () => {
    const onChartClick = jest.fn()
    const dateColumn = { name: 'trade_date', type: 'DATE', precision: 'day' }
    const columns = [dateColumn, { name: 'amount', type: 'QUANTITY' }]
    const row = ['2024-01-15', 100]
    const dataFormatting = {}

    const wrapper = setup({
      onChartClick,
      columns,
      stringColumnIndex: 0,
      dataFormatting,
      numberColumnIndices: [1],
      legendLabels: [{ label: 'Amount', color: '#000' }],
      xScale: pivotSampleProps.stringScale(),
      yScale: pivotSampleProps.stringScale(),
      data: [row],
    })

    const instance = wrapper.instance()
    instance.onCircleClick(row, 1, '1-0')

    expect(onChartClick).toHaveBeenCalledWith(
      expect.objectContaining({
        row,
        columnIndex: 1,
        columns,
        stringColumnIndex: 0,
        activeKey: '1-0',
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
