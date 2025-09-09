import React from 'react'
import { mount } from 'enzyme'
import ChataTable from './ChataTable'

describe('ChataTable core functionality', () => {
  afterEach(() => {
    jest.clearAllMocks()
    if (global.document.querySelector && global.document.querySelector.mockRestore) {
      global.document.querySelector.mockRestore()
    }
  })
  test('storeOriginalFilters does nothing if tabulator is missing', () => {
    instance.ref = {}
    expect(() => instance.storeOriginalFilters()).not.toThrow()
    expect(instance.originalFilters).toEqual([])
    expect(instance.originalSorters).toEqual([])
  })

  test('setHeaderFiltersToOriginal does nothing if filters array is empty', () => {
    instance.ref.tabulator.setHeaderFilterValue = jest.fn()
    instance.ref.tabulator.setFilter = jest.fn()
    instance.setHeaderFiltersToOriginal([])
    expect(instance.ref.tabulator.setHeaderFilterValue).not.toHaveBeenCalled()
    expect(instance.ref.tabulator.setFilter).not.toHaveBeenCalled()
  })

  test('hideAllHeaderFilters sets isFiltering to false only if _isMounted is true', () => {
    instance._isMounted = true
    instance.setState = jest.fn()
    instance.hideAllHeaderFilters()
    expect(instance.setState).toHaveBeenCalledWith({ isFiltering: false })

    instance._isMounted = false
    instance.setState.mockClear()
    instance.hideAllHeaderFilters()
    expect(instance.setState).not.toHaveBeenCalled()
  })
  let wrapper, instance
  const columns = [
    { field: 'col1', title: 'Column 1', headerFilter: true },
    { field: 'col2', title: 'Column 2', headerFilter: true },
  ]
  const data = [{ col1: 'A', col2: 'B' }]
  const response = {
    data: {
      data: {
        rows: data,
        count_rows: 1,
      },
    },
  }

  beforeEach(() => {
    wrapper = mount(<ChataTable columns={columns} data={data} response={response} autoHeight={true} hidden={false} />)
    instance = wrapper.find('ChataTable').instance()
    // Mock tabulator API for header filters and sorters
    instance.ref = {
      tabulator: {
        getHeaderFilters: jest.fn(() => [
          { field: 'col1', value: 'A', type: '=' },
          { field: 'col2', value: 'B', type: '=' },
        ]),
        getSorters: jest.fn(() => [{ field: 'col1', dir: 'asc' }]),
        setHeaderFilterValue: jest.fn(),
        setFilter: jest.fn(),
        setSort: jest.fn(),
        getColumns: jest.fn(() => columns.map((col) => ({ getField: () => col.field, getDefinition: () => col }))),
      },
    }
    instance.useInfiniteScroll = false
  })

  test('storeOriginalFilters stores header filters and sorters', () => {
    instance.storeOriginalFilters()
    expect(instance.originalFilters).toEqual([
      { field: 'col1', value: 'A', type: '=' },
      { field: 'col2', value: 'B', type: '=' },
    ])
    expect(instance.originalSorters).toEqual([{ field: 'col1', dir: 'asc' }])
  })

  test('restoreOriginalFilters sets filters and sorters and hides header filters', () => {
    instance.setFilters = jest.fn()
    instance.setSorters = jest.fn()
    instance.hideAllHeaderFilters = jest.fn()
    instance.originalFilters = [{ field: 'col1', value: 'A', type: '=' }]
    instance.originalSorters = [{ field: 'col1', dir: 'asc' }]
    instance.restoreOriginalFilters()
    expect(instance.setFilters).toHaveBeenCalledWith(instance.originalFilters)
    expect(instance.setSorters).toHaveBeenCalledWith(instance.originalSorters)
    expect(instance.hideAllHeaderFilters).toHaveBeenCalled()
  })

  test('setHeaderFiltersToOriginal sets header filter values and filter UI', () => {
    // Mock document.querySelector for input element
    const inputMock = { value: '', title: '' }
    global.document.querySelector = jest.fn(() => inputMock)
    instance.ref.tabulator.setHeaderFilterValue = jest.fn()
    instance.ref.tabulator.setFilter = jest.fn()
    const filters = [
      { field: 'col1', value: 'A', type: '=' },
      { field: 'col2', value: 'B', type: '=' },
    ]
    instance.setHeaderFiltersToOriginal(filters)
    expect(instance.ref.tabulator.setHeaderFilterValue).toHaveBeenCalledWith('col1', 'A')
    expect(instance.ref.tabulator.setHeaderFilterValue).toHaveBeenCalledWith('col2', 'B')
    expect(instance.ref.tabulator.setFilter).toHaveBeenCalledWith('col1', '=', 'A')
    expect(instance.ref.tabulator.setFilter).toHaveBeenCalledWith('col2', '=', 'B')
    expect(inputMock.value).toBe('B')
    expect(inputMock.title).toBe('B')
  })

  test('debouncedFilterCallback calls onFilterCallback after delay', async () => {
    jest.useFakeTimers()
    const onFilterCallback = jest.fn()
    wrapper = mount(
      <ChataTable
        columns={columns}
        data={data}
        response={response}
        autoHeight={true}
        hidden={false}
        onFilterCallback={onFilterCallback}
      />,
    )
    instance = wrapper.find('ChataTable').instance()
    instance.debouncedFilterCallback([{ field: 'col1', value: 'A' }], data)
    expect(onFilterCallback).not.toHaveBeenCalled()
    jest.advanceTimersByTime(500)
    expect(onFilterCallback).toHaveBeenCalledWith([{ field: 'col1', value: 'A' }], data)
    jest.useRealTimers()
  })
})
