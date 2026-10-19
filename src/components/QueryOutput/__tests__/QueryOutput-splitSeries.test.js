import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput } from '../QueryOutput'
import ChataChart from '../../Charts/ChataChart/ChataChart'
import { SplitSeriesButton } from '../../Charts/SplitSeriesButton'
import { SPLIT_SERIES_COUNT } from '../splitSeriesUtils'
import testCases from '../../../../test/responseTestCases'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'

beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

// List query (nothing groupable): Customer, Region, Product, Sales
const columns = [
  { name: 'customer', display_name: 'Customer', type: 'STRING', is_visible: true, index: 0 },
  { name: 'region', display_name: 'Region', type: 'STRING', is_visible: true, index: 1 },
  { name: 'product', display_name: 'Product', type: 'STRING', is_visible: true, index: 2 },
  { name: 'sales', display_name: 'Sales', type: 'DOLLAR_AMT', is_visible: true, index: 3 },
  { name: 'quantity', display_name: 'Quantity', type: 'QUANTITY', is_visible: true, index: 4 },
]
const rows = [
  ['Acme', 'East', 'Bolts', 10, 1],
  ['Acme', 'West', 'Nuts', 20, 2],
  ['Birch', 'East', 'Nuts', 30, 3],
  ['Birch', 'North', 'Bolts', 5, 1],
  ['Cobalt', 'West', 'Bolts', 15, 2],
]
const response = {
  data: {
    reference_id: '1.1.200',
    data: { text: 'all sales', display_type: 'data', query_id: 'q1', row_limit: 500, count_rows: 5, rows, columns },
  },
}
const columnNames = columns.map((col) => col.name)
const nameIndex = 0
const regionIndex = 1
const productIndex = 2
const salesIndex = 3

const setup = (props = {}) => {
  const wrapper = mount(
    <QueryOutput
      authentication={{}}
      onTableConfigChange={jest.fn()}
      queryResponse={response}
      initialDisplayType='column'
      {...props}
    />,
  )
  const inst = wrapper.instance()
  inst.tableConfig.stringColumnIndex = nameIndex
  inst.tableConfig.numberColumnIndices = [salesIndex]
  inst.tableConfig.numberColumnIndex = salesIndex
  inst.forceUpdate()
  wrapper.update()
  return { wrapper, inst }
}

const getChartProps = (wrapper) => {
  wrapper.update()
  return wrapper.find(ChataChart).props()
}

const splitByRegion = { columnIndex: regionIndex, valueColumnIndex: salesIndex }

describe('split series on a list query chart', () => {
  test('offers the split button when no split is saved', () => {
    const { wrapper } = setup()
    const { splitBy } = getChartProps(wrapper)

    expect(splitBy.isActive).toBe(false)
    expect(splitBy.eligibleColumnIndices).toEqual([regionIndex, productIndex])
    expect(wrapper.find(SplitSeriesButton).exists()).toBe(true)
    wrapper.unmount()
  })

  test('picking a column from the button popover splits the chart', () => {
    const onChartControlsChange = jest.fn()
    const { wrapper } = setup({ onChartControlsChange })

    wrapper.find('rect.sankey-path-button-rect').simulate('click')
    const options = wrapper.find('[data-test="split-series-selector"] li')
    expect(options.map((option) => option.text())).toEqual(['Region', 'Product'])

    options.first().simulate('click')
    expect(onChartControlsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        splitBy: { columnIndex: regionIndex, valueColumnIndex: salesIndex },
      }),
    )
    expect(getChartProps(wrapper).splitBy.isActive).toBe(true)
    wrapper.unmount()
  })

  test('a saved split adds one series per region and replaces the button with the legend', () => {
    const { wrapper } = setup({ initialChartControls: { splitBy: splitByRegion } })
    const props = getChartProps(wrapper)

    const regions = new Set(response.data.data.rows.map((row) => `${row[regionIndex]}`))
    const originalColumnCount = columnNames.length

    expect(props.splitBy.isActive).toBe(true)
    expect(props.legendColumn.name).toBe(columnNames[regionIndex])
    expect(props.columns).toHaveLength(originalColumnCount + regions.size)
    expect(props.numberColumnIndices[0]).toBe(originalColumnCount)
    expect(props.splitBy.valueTitle).toMatch(/Sales/)
    expect(wrapper.find(SplitSeriesButton).exists()).toBe(false)
    wrapper.unmount()
  })

  test('Count and Remove split are saved to chart controls', () => {
    const onChartControlsChange = jest.fn()
    const { wrapper, inst } = setup({ initialChartControls: { splitBy: splitByRegion }, onChartControlsChange })

    inst.onSplitValueChange(SPLIT_SERIES_COUNT)
    expect(onChartControlsChange).toHaveBeenLastCalledWith({
      splitBy: { columnIndex: regionIndex, valueColumnIndex: SPLIT_SERIES_COUNT },
    })
    expect(getChartProps(wrapper).splitBy.valueTitle).toBe('Count')

    inst.onSplitColumnChange(null)
    expect(onChartControlsChange).toHaveBeenLastCalledWith({})
    expect(getChartProps(wrapper).splitBy.isActive).toBe(false)
    wrapper.unmount()
  })

  test('picking the x-axis column from the legend swaps it with the split column', () => {
    const { wrapper, inst } = setup({ initialChartControls: { splitBy: splitByRegion } })

    inst.onSplitColumnChange(nameIndex)
    const props = getChartProps(wrapper)

    expect(inst.tableConfig.stringColumnIndex).toBe(regionIndex)
    expect(props.splitBy.columnIndex).toBe(nameIndex)
    wrapper.unmount()
  })

  test('hiding a series from the legend hides only that series', () => {
    const { wrapper, inst } = setup({ initialChartControls: { splitBy: splitByRegion } })
    const { columns, numberColumnIndices } = getChartProps(wrapper)
    const firstSeries = columns[numberColumnIndices[0]]

    inst.onLegendClick({ label: firstSeries.display_name, columnIndex: numberColumnIndices[0], column: firstSeries })
    const after = getChartProps(wrapper)

    expect(after.columns[numberColumnIndices[0]].isSeriesHidden).toBe(true)
    expect(after.columns[numberColumnIndices[1]].isSeriesHidden).toBe(false)
    wrapper.unmount()
  })

  test('hidden series are shown again when a different query comes in', () => {
    const { wrapper, inst } = setup({ initialChartControls: { splitBy: splitByRegion } })
    const { columns, numberColumnIndices } = getChartProps(wrapper)
    const firstSeries = columns[numberColumnIndices[0]]

    inst.onLegendClick({ label: firstSeries.display_name, columnIndex: numberColumnIndices[0], column: firstSeries })
    expect(inst.state.hiddenSplitSeriesKeys).toHaveLength(1)

    const nextResponse = { ...response, data: { ...response.data, data: { ...response.data.data, query_id: 'next' } } }
    inst.onNewData(nextResponse)
    expect(inst.state.hiddenSplitSeriesKeys).toEqual([])
    wrapper.unmount()
  })

  test('clicking a split bar drills down on the x value and the split value', () => {
    const { wrapper, inst } = setup({ initialChartControls: { splitBy: splitByRegion } })
    const { columns, numberColumnIndices } = getChartProps(wrapper)
    const seriesIndex = numberColumnIndices[0]
    const row = response.data.data.rows[0]
    const processDrilldown = jest.spyOn(inst, 'processDrilldown').mockImplementation(() => {})

    inst.onChartClick({ row, columnIndex: seriesIndex, columns, stringColumnIndex: nameIndex })

    const { filter, supportedByAPI } = processDrilldown.mock.calls[0][0]
    expect(supportedByAPI).toBe(false)
    expect(filter.map((f) => f.name)).toEqual([columnNames[nameIndex], columnNames[regionIndex]])
    expect(filter[1].value).toBe(columns[seriesIndex].splitSeriesValue)
    wrapper.unmount()
  })

  test('clicking a rendered bar drills down on its series', async () => {
    const { wrapper, inst } = setup({
      initialChartControls: { splitBy: splitByRegion },
      autoQLConfig: { enableDrilldowns: true },
    })
    const processDrilldown = jest.spyOn(inst, 'processDrilldown').mockImplementation(() => {})

    // The bars draw after the chart's first layout pass
    await new Promise((resolve) => setTimeout(resolve, 300))
    wrapper.update()
    wrapper.find('Columns rect').first().simulate('click')

    const { filter } = processDrilldown.mock.calls[0][0]
    expect(filter.map((f) => f.name)).toEqual(['customer', 'region'])
    wrapper.unmount()
  })

  test('is not offered while several series are on the y-axis, unless a split is saved', () => {
    const { wrapper, inst } = setup()
    inst.tableConfig.numberColumnIndices = [salesIndex, 4]
    inst.forceUpdate()
    expect(getChartProps(wrapper).splitBy).toBeUndefined()
    expect(wrapper.find(SplitSeriesButton).exists()).toBe(false)
    wrapper.unmount()

    const saved = setup({ initialChartControls: { splitBy: splitByRegion } })
    saved.inst.tableConfig.numberColumnIndices = [salesIndex, 4]
    saved.inst.forceUpdate()
    expect(getChartProps(saved.wrapper).splitBy.isActive).toBe(true)
    saved.wrapper.unmount()
  })

  test('the × next to the legend title removes the split', () => {
    const onChartControlsChange = jest.fn()
    const { wrapper } = setup({ initialChartControls: { splitBy: splitByRegion }, onChartControlsChange })

    const button = wrapper.getDOMNode().querySelector('[data-test="legend-remove-split-button"]')
    expect(button).not.toBeNull()
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(onChartControlsChange).toHaveBeenLastCalledWith({})
    expect(getChartProps(wrapper).splitBy.isActive).toBe(false)
    wrapper.unmount()
  })

  test('is not offered for aggregated data or non-axis charts', () => {
    const grouped = mount(
      <QueryOutput authentication={{}} queryResponse={testCases[11]} initialDisplayType='column' />,
    )
    grouped.update()
    expect(grouped.find(ChataChart).props().splitBy).toBeUndefined()
    grouped.unmount()

    const { wrapper } = setup({ initialDisplayType: 'pie' })
    expect(getChartProps(wrapper).splitBy).toBeUndefined()
    wrapper.unmount()
  })
})
