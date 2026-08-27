import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput as QueryOutputWithoutTheme } from '../QueryOutput'

const buildColumn = (name, displayName, isVisible = true) => ({
  display_name: displayName,
  name,
  type: 'DOLLAR_AMT',
  is_visible: isVisible,
  groupable: false,
  active: false,
  multi_series: false,
})

const buildResponse = (rows, columns = [buildColumn('sale__line_item___sum', 'Total Sales')]) => ({
  data: {
    message: 'Success',
    reference_id: '1.1.210',
    data: {
      display_type: 'data',
      query_id: 'q_test',
      text: 'total sales',
      interpretation: 'total sales',
      sql: [''],
      count_rows: rows.length,
      columns,
      rows,
    },
  },
})

describe('single value response with no data', () => {
  const emptyRowCases = [
    ['rows: []', []],
    ['rows: [[]]', [[]]],
    ['rows: [[null]]', [[null]]],
  ]

  emptyRowCases.forEach(([label, rows]) => {
    test(`renders "No data found" for ${label}`, () => {
      const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse(rows)} queryFn={() => {}} />)

      expect(wrapper.instance().state.displayType).toBe('single-value')
      expect(wrapper.text()).toContain('No data found')

      wrapper.unmount()
    })

    test(`renders "No data found" for ${label} when only one column is visible`, () => {
      const columns = [
        buildColumn('sale__line_item___sum', 'Total Sales'),
        buildColumn('sale__customer', 'Customer', false),
      ]
      const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse(rows, columns)} queryFn={() => {}} />)

      expect(wrapper.text()).toContain('No data found')

      wrapper.unmount()
    })
  })

  test('renders the value when there is data', () => {
    const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse([[1000]])} queryFn={() => {}} />)

    expect(wrapper.instance().state.displayType).toBe('single-value')
    expect(wrapper.text()).toContain('$1,000.00')
    expect(wrapper.text()).not.toContain('No data found')

    wrapper.unmount()
  })

  test('does not render as a single value when there is more than one visible column', () => {
    const columns = [buildColumn('sale__line_item___sum', 'Total Sales'), buildColumn('sale__customer', 'Customer')]
    const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse([], columns)} queryFn={() => {}} />)

    expect(wrapper.instance().state.displayType).not.toBe('single-value')
    expect(wrapper.text()).not.toContain('No data found')

    wrapper.unmount()
  })
})
