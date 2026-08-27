import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput as QueryOutputWithoutTheme } from '../QueryOutput'

const buildColumn = (name, displayName, isVisible = true, type = 'DOLLAR_AMT') => ({
  display_name: displayName,
  name,
  type,
  is_visible: isVisible,
  groupable: false,
  active: false,
  multi_series: false,
})

const buildResponse = (rows, columns = [buildColumn('sale__line_item___sum', 'Total Sales')], feReqFilters) => ({
  data: {
    message: 'Success',
    reference_id: '1.1.210',
    data: {
      display_type: 'data',
      query_id: 'q_test',
      fe_req: feReqFilters ? { filters: feReqFilters } : undefined,
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

  // A real zero is data. Only the genuinely empty row shapes mean "nothing came back", and the
  // distinction has to hold for every numerical column type — each formats zero differently, and
  // a null slipping through any of them would surface as that type's formatted zero.
  describe.each(['DOLLAR_AMT', 'QUANTITY', 'PERCENT', 'RATIO'])('%s column', (type) => {
    const columns = [buildColumn('sale__line_item___sum', 'Total Sales', true, type)]

    test.each(emptyRowCases)('renders "No data found" for %s', (_label, rows) => {
      const wrapper = mount(
        <QueryOutputWithoutTheme queryResponse={buildResponse(rows, columns)} queryFn={() => {}} />,
      )

      expect(wrapper.text()).toContain('No data found')

      wrapper.unmount()
    })

    test('renders a real zero rather than "No data found"', () => {
      const wrapper = mount(
        <QueryOutputWithoutTheme queryResponse={buildResponse([[0]], columns)} queryFn={() => {}} />,
      )

      expect(wrapper.text()).not.toContain('No data found')
      expect(wrapper.text()).toMatch(/0/)

      wrapper.unmount()
    })
  })

  test.each(emptyRowCases)('renders "No data found" for %s after new data arrives', (_label, rows) => {
    // The empty response usually replaces a populated one rather than being the initial render.
    const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse([[1000]])} queryFn={() => {}} />)

    wrapper.instance().onNewData(buildResponse(rows))
    wrapper.update()

    expect(wrapper.text()).toContain('No data found')

    wrapper.unmount()
  })

  test('still renders a real zero after new data arrives', () => {
    const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse([[1000]])} queryFn={() => {}} />)

    wrapper.instance().onNewData(buildResponse([[0]]))
    wrapper.update()

    expect(wrapper.text()).not.toContain('No data found')
    expect(wrapper.text()).toContain('$0.00')

    wrapper.unmount()
  })

  emptyRowCases.forEach(([label, rows]) => {
    test(`renders "No data found" for ${label}`, () => {
      const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse(rows)} queryFn={() => {}} />)

      expect(wrapper.instance().state.displayType).toBe('single-value')
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

  test('keeps rows: [] as a table when a second column is merely hidden', () => {
    // One *visible* column is not the same as a single value query — the response still has two
    // columns and the user can unhide the second one, so collapsing it would strip the table UI.
    // (rows: [[]] and [[null]] are one-row responses, which isSingleValueResponse already treats
    // as single value upstream; only the truly empty rows: [] case is decided here.)
    const columns = [
      buildColumn('sale__line_item___sum', 'Total Sales'),
      buildColumn('sale__customer', 'Customer', false),
    ]
    const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse([], columns)} queryFn={() => {}} />)

    expect(wrapper.instance().state.displayType).not.toBe('single-value')

    wrapper.unmount()
  })

  test('keeps an empty one column list query as a table', () => {
    // A list query is not a single value query, so an empty one must keep its column header and
    // filter UI rather than collapsing to "No data found".
    const columns = [buildColumn('sale__customer', 'Customer', true, 'STRING')]
    const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse([], columns)} queryFn={() => {}} />)

    expect(wrapper.instance().state.displayType).not.toBe('single-value')
    expect(wrapper.text()).not.toContain('No data found')

    wrapper.unmount()
  })

  test('does not collapse to a single value when the user filtered the data down to nothing', () => {
    // The filter UI lives in the table. Replacing it with "No data found" would strand the user
    // with no way to clear the filter they applied.
    const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse([[1000]])} queryFn={() => {}} />)
    const inst = wrapper.instance()

    inst.tableParams = { ...inst.tableParams, filter: [{ field: 'sale__line_item___sum', value: '999' }] }
    inst.queryResponse = buildResponse([])

    expect(inst.isSingleValueOrEmptyResponse(inst.queryResponse)).toBe(false)

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

describe('display type never degrades into a debug message', () => {
  // 'single-value' is neither a table nor a chart type, so any path that leaves it in state while
  // the response no longer qualifies used to fall through to renderMessage and print
  // "display type not recognized: single-value" — a developer string — into the UI.
  const QUERY_FILTERS = [{ name: 'sale__customer', value: 'Acme', operator: '=' }]

  const expectNoDebugMessage = (wrapper) => {
    expect(wrapper.text()).not.toContain('display type not recognized')
  }

  test('empty single value query carrying its own fe_req filters', () => {
    // fe_req filters come from the query itself (a drilldown, a locked filter, a filter in the
    // question). They are not the user narrowing a table down, so they must not block the
    // collapse to a single value.
    const wrapper = mount(
      <QueryOutputWithoutTheme queryResponse={buildResponse([], undefined, QUERY_FILTERS)} queryFn={() => {}} />,
    )

    expectNoDebugMessage(wrapper)
    expect(wrapper.text()).toContain('No data found')
    expect(wrapper.instance().hasUserAppliedFilters()).toBe(false)

    wrapper.unmount()
  })

  test('single value tile whose data goes empty while fe_req filters are present', () => {
    const wrapper = mount(
      <QueryOutputWithoutTheme queryResponse={buildResponse([[1000]], undefined, QUERY_FILTERS)} queryFn={() => {}} />,
    )

    wrapper.instance().onNewData(buildResponse([], undefined, QUERY_FILTERS))
    wrapper.update()

    expectNoDebugMessage(wrapper)
    expect(wrapper.text()).toContain('No data found')

    wrapper.unmount()
  })

  test('falls back to the table when the data becomes multi-row', () => {
    // The display type can lag behind the data: onNewData replaces the rows without recalculating
    // it. Rendering the table is right; rendering a debug string is not.
    const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse([[1000]])} queryFn={() => {}} />)

    wrapper.instance().onNewData(buildResponse([[1], [2], [3]]))
    wrapper.update()

    expectNoDebugMessage(wrapper)

    wrapper.unmount()
  })

  test('a user-applied filter that empties the data keeps the table and its filter UI', () => {
    const wrapper = mount(<QueryOutputWithoutTheme queryResponse={buildResponse([[1000]])} queryFn={() => {}} />)
    const inst = wrapper.instance()

    expect(inst.hasUserAppliedFilters()).toBe(false)
    inst.tableParams = { ...inst.tableParams, filter: [{ field: 'sale__line_item___sum', value: '999' }] }
    expect(inst.hasUserAppliedFilters()).toBe(true)

    inst.onNewData(buildResponse([]))
    wrapper.update()

    expectNoDebugMessage(wrapper)
    expect(wrapper.text()).not.toContain('No data found')

    wrapper.unmount()
  })
})
