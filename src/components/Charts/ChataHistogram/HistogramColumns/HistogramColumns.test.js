import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../../test/testUtils'
import { getKey } from 'autoql-fe-utils'
import HistogramColumns from './HistogramColumns'
import sampleProps from '../../chartTestData'
import histogramTestProps from '../testData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const scales = {
  xScale: sampleProps.list.stringScale(),
  yScale: sampleProps.list.numberScale(),
  ...histogramTestProps,
}

const listSampleProps = {
  ...sampleProps.list,
  ...scales,
}

const defaultProps = HistogramColumns.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<HistogramColumns {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps)
    const histogramColumnsComponent = findByTestAttr(wrapper, 'columns')
    expect(histogramColumnsComponent.exists()).toBe(true)
  })

  test('calls onChartClick with drilldown context payload', () => {
    const onChartClick = jest.fn()
    const columns = [{ name: 'RangeCol', type: 'number' }]

    const wrapper = setup({
      onChartClick,
      columns,
      numberColumnIndex: 0,
      stringColumnIndex: undefined,
      legendColumn: undefined,
      // Provide minimal required chart element props used by propTypes/tests.
      xScale: listSampleProps.xScale,
      yScale: listSampleProps.yScale,
    })

    const instance = wrapper.instance()
    instance.onColumnClick(1, 2, 0)

    expect(onChartClick).toHaveBeenCalledWith(
      expect.objectContaining({
        activeKey: getKey(0),
        columnIndex: 0,
        columns,
        stringColumnIndex: undefined,
        legendColumn: undefined,
        filter: {
          name: 'RangeCol',
          value: '1,2',
          operator: 'between',
          column_type: 'number',
        },
      }),
    )
  })
})
