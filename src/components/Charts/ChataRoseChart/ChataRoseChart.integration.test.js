import React from 'react'
import { mount } from 'enzyme'
import { act } from 'react-dom/test-utils'
import { QueryOutput } from '../../QueryOutput/QueryOutput'
import ChataRoseChart from './ChataRoseChart'
import SankeyColumnSelector from '../ChataSankeyDiagram/SankeyColumnSelector'
import { featureToggles } from '../../../js/featureToggles'

// The rose is behind a feature toggle; these tests need it on whatever its default is
const originalRoseToggle = featureToggles.rose
beforeAll(() => {
  featureToggles.rose = true
})
afterAll(() => {
  featureToggles.rose = originalRoseToggle
})

// A list query (nothing groupable), like "transactions with their product and department details"
const departments = ['Pharmacy', 'Grocery', 'Bakery', 'Deli', 'Produce']
const response = {
  data: {
    data: {
      columns: [
        { name: 'transaction_id', display_name: 'Transaction', type: 'STRING', groupable: false, is_visible: true },
        { name: 'product', display_name: 'Product', type: 'STRING', groupable: false, is_visible: true },
        { name: 'department', display_name: 'Department', type: 'STRING', groupable: false, is_visible: true },
        { name: 'amount', display_name: 'Amount', type: 'DOLLAR_AMT', groupable: false, is_visible: true },
      ],
      display_type: 'data',
      interpretation: 'all transactions',
      query_id: 'q_rose_integration',
      rows: Array.from({ length: 40 }, (_, i) => [`t${i}`, `P${i % 7}`, departments[i % departments.length], 10 + i]),
    },
    message: 'Success',
    reference_id: '1.1.210',
  },
}

describe('ChataRoseChart inside QueryOutput', () => {
  test('shows one wedge per department after picking Department as the category', () => {
    const wrapper = mount(
      <QueryOutput queryResponse={response} initialDisplayType='rose' queryFn={() => {}} width={800} height={500} />,
    )
    wrapper.update()

    const rose = wrapper.find(ChataRoseChart)
    expect(rose.exists()).toBe(true)
    expect(rose.prop('data')).toHaveLength(40)

    const categorySelector = () =>
      wrapper
        .find(ChataRoseChart)
        .find(SankeyColumnSelector)
        .filterWhere((s) => s.prop('pathTitle') === 'Category')
    act(() => categorySelector().prop('onPathChange')([2]))
    wrapper.update()

    expect(categorySelector().prop('pathColumnIndices')).toEqual([2])
    expect(wrapper.find(ChataRoseChart).find('path.rose-wedge')).toHaveLength(departments.length)
    wrapper.unmount()
  })
})

describe('ChataRoseChart with a single-date list query', () => {
  test('keeps one wedge per value for every category column', () => {
    const today = 1767225600
    const columns = [
      { name: 'transaction_date', display_name: 'Date', type: 'DATE', groupable: false, is_visible: true },
      { name: 'customer', display_name: 'Customer', type: 'STRING', groupable: false, is_visible: true },
      { name: 'department', display_name: 'Department', type: 'STRING', groupable: false, is_visible: true },
      { name: 'quantity', display_name: 'Quantity', type: 'QUANTITY', groupable: false, is_visible: true },
      { name: 'amount', display_name: 'Amount', type: 'DOLLAR_AMT', groupable: false, is_visible: true },
    ]
    const rows = Array.from({ length: 60 }, (_, i) => [today, `Customer ${i}`, departments[i % 5], i % 3, 100 + i])
    const listResponse = {
      data: { ...response.data, data: { ...response.data.data, columns, rows, query_id: 'q_rose_list' } },
    }

    const wrapper = mount(
      <QueryOutput
        queryResponse={listResponse}
        initialDisplayType='rose'
        queryFn={() => {}}
        width={800}
        height={500}
      />,
    )
    wrapper.update()

    const categorySelector = () =>
      wrapper
        .find(ChataRoseChart)
        .find(SankeyColumnSelector)
        .filterWhere((s) => s.prop('pathTitle') === 'Category')
    const wedgeCount = () => wrapper.find(ChataRoseChart).find('path.rose-wedge').length

    expect(wrapper.find(ChataRoseChart).prop('data')).toHaveLength(60)
    act(() => categorySelector().prop('onPathChange')([2]))
    wrapper.update()
    expect(wedgeCount()).toBe(5)
    act(() => categorySelector().prop('onPathChange')([1]))
    wrapper.update()
    // 60 customers: as many as fit, plus "Other"
    expect(wedgeCount()).toBeGreaterThan(5)
    expect(wrapper.find(ChataRoseChart).find('path.rose-wedge').last().hasClass('rose-wedge-other')).toBe(true)
    wrapper.unmount()
  })
})

describe('ChataRoseChart resizing', () => {
  test('redraws at the new container size while the messenger is being resized', () => {
    const wrapper = mount(<QueryOutput queryResponse={response} initialDisplayType='rose' queryFn={() => {}} />)
    wrapper.update()
    const chart = wrapper.find('ChataChart').instance()
    const setContainerSize = (width, height) => {
      Object.defineProperty(chart.chartContainerRef, 'clientWidth', { value: width, configurable: true })
      Object.defineProperty(chart.chartContainerRef, 'clientHeight', { value: height, configurable: true })
    }

    let frames = []
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
    const flushFrames = () => {
      const pending = frames
      frames = []
      pending.forEach((cb) => cb())
    }
    try {
      setContainerSize(700, 400)
      act(() => {
        chart.adjustChartPosition()
        flushFrames()
      })
      wrapper.update()
      const firstWidth = wrapper.find(ChataRoseChart).prop('width')

      wrapper.setProps({ isResizing: true })
      setContainerSize(500, 400)
      act(() => {
        chart.adjustChartPosition()
        flushFrames()
      })
      wrapper.update()

      expect(wrapper.find(ChataRoseChart).prop('width')).toBe(firstWidth - 200)
    } finally {
      raf.mockRestore()
      wrapper.unmount()
    }
  })
})
