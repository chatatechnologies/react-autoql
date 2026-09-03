import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput } from '../QueryOutput'
import ChataChart from '../../Charts/ChataChart/ChataChart'
import testCases from '../../../../test/responseTestCases'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'

beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

// Customer Name (STRING), Customer Region (STRING), Total Online Sales (DOLLAR_AMT)
const setup = () =>
  mount(<QueryOutput authentication={{}} onTableConfigChange={jest.fn()} queryResponse={testCases[11]} />)

const hideColumns = (inst, names) => {
  const columns = inst.getColumns().map((col) => ({
    ...col,
    visible: !names.includes(col.name),
    is_visible: !names.includes(col.name),
  }))
  inst.updateColumns(columns)
}

const hideTheNumberColumn = (inst) => {
  const numberColumn = inst.getColumns().find((col) => col.name.includes('sales_dollar_amount'))
  hideColumns(inst, [numberColumn.name])
}

describe('charting after the only number column is hidden', () => {
  test('the number axis falls back to a visible column and counts it', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    hideTheNumberColumn(inst)
    wrapper.update()
    inst.changeDisplayType('column')
    wrapper.update()

    const { numberColumnIndex, numberColumnIndices } = inst.tableConfig
    const numberColumn = inst.state.columns[numberColumnIndex]

    // The fallback used to land on `undefined`, which the chart helpers resolve to
    // `columns[undefined]` and throw on mid-render, leaving the chart blank
    expect(numberColumnIndices).not.toContain(undefined)
    expect(numberColumn?.is_visible).toBe(true)
    expect(numberColumn.aggType).toBe('COUNT')

    // Summing labels gave every group 0 - the chart drew, but with nothing in it
    const chartData = wrapper.find(ChataChart).instance()?.state?.data
    expect(chartData.some((row) => row[numberColumnIndex] > 0)).toBe(true)

    wrapper.unmount()
  })

  test('hiding the number column while viewing a chart does not throw', () => {
    const errors = []
    const originalError = console.error
    console.error = (...args) => errors.push(args.map((arg) => arg?.message ?? String(arg)).join(' '))

    try {
      const wrapper = setup()
      const inst = wrapper.instance()

      inst.changeDisplayType('column')
      wrapper.update()
      hideTheNumberColumn(inst)
      wrapper.update()

      expect(errors.filter((error) => /Cannot read propert/.test(error))).toEqual([])
      wrapper.unmount()
    } finally {
      console.error = originalError
    }
  })
})
