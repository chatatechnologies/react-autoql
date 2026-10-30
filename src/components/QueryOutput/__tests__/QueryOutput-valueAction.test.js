import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput } from '../QueryOutput'
import { TOOLTIP_COPY_TEXTS } from '../../../js/Constants'

const LINK_ACTION = { type: 'link', link_url: 'https://crm.acme.com/accounts/{value}', link_target: '_blank' }
const CALLBACK_ACTION = { type: 'callback', callback_name: 'openCustomerDrawer' }

const makeColumns = ({ accountIdAction = LINK_ACTION } = {}) => [
  { name: 'account_id', display_name: 'Account ID', type: 'STRING', value_action: accountIdAction },
  { name: 'account_name', display_name: 'Account', type: 'STRING', value_action: CALLBACK_ACTION },
  { name: 'region', display_name: 'Region', type: 'STRING', value_action: null, groupable: true, drill_down: 'region' },
  { name: 'total', display_name: 'Total', type: 'QUANTITY' },
]

const ROW = ['1042', 'Acme', 'West', 5]

const makeResponse = (columns = makeColumns(), rows = [ROW]) => ({
  data: { data: { text: 'accounts by region', query_id: 'q1', rows, columns } },
})

const setup = (props = {}) =>
  mount(
    <QueryOutput
      authentication={{}}
      autoQLConfig={{ enableDrilldowns: true }}
      queryResponse={makeResponse()}
      initialDisplayType='table'
      {...props}
    />,
  )

const cellFor = (instance, columnName, row = ROW) => {
  const definition = instance.getColumns().find((col) => col.name === columnName)
  const element = document.createElement('div')
  return {
    getColumn: () => ({ getDefinition: () => definition }),
    getValue: () => row[Number(definition.field)],
    getData: () => row,
    getElement: () => element,
  }
}

// Renders the cell the way Tabulator does: the formatter's output inside the cell element, with
// clicks on the cell going to onTableCellClick (Tabulator's cellClick)
const renderCell = (instance, columnName, row, formatterName = 'formatter') => {
  const cell = cellFor(instance, columnName, row)
  const content = cell
    .getColumn()
    .getDefinition()
    [formatterName](cell, {}, (onRendered) => onRendered())
  cell.getElement().appendChild(content)
  cell.getElement().addEventListener('click', (e) => instance.onTableCellClick(cell, e))
  return { cell, content, button: content.querySelector('.react-autoql-cell-value-action-btn') }
}

describe('QueryOutput value actions', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('a link cell gets an open button that is a real link to the filled-in URL', () => {
    const wrapper = setup()
    const { button } = renderCell(wrapper.instance(), 'account_id')

    expect(button.tagName).toBe('A')
    expect(button.getAttribute('href')).toBe('https://crm.acme.com/accounts/1042')
    expect(button.getAttribute('target')).toBe('_blank')
    expect(button.getAttribute('rel')).toBe('noopener noreferrer')
    expect(button.getAttribute('aria-label')).toBe('Open in new tab')
    expect(button.querySelector('svg')).not.toBeNull()
    wrapper.unmount()
  })

  test('a callback button calls the host callback with the value and the row keyed by column name', () => {
    const openCustomerDrawer = jest.fn()
    const wrapper = setup({ valueActionCallbacks: { openCustomerDrawer } })
    const { button } = renderCell(wrapper.instance(), 'account_name')

    expect(button.tagName).toBe('BUTTON')
    button.click()

    expect(openCustomerDrawer).toHaveBeenCalledWith(
      'Acme',
      { account_id: '1042', account_name: 'Acme', region: 'West', total: 5 },
      {
        column: {
          name: 'account_name',
          display_name: 'Account',
          type: 'STRING',
          precision: undefined,
          dow_style: undefined,
        },
        formattedValue: 'Acme',
        queryId: 'q1',
        queryText: 'accounts by region',
        event: expect.any(MouseEvent),
      },
    )
    wrapper.unmount()
  })

  test('the callback context carries the date column precision, dow_style and the value as displayed', () => {
    const openMonth = jest.fn()
    const columns = [
      {
        name: 'order_month',
        display_name: 'Month',
        type: 'DATE',
        precision: 'MONTH',
        dow_style: 'NUM_1_MON',
        value_action: { type: 'callback', callback_name: 'openMonth' },
      },
      { name: 'total', display_name: 'Total', type: 'QUANTITY' },
    ]
    const row = [1709251200, 5] // 2024-03-01 UTC
    const wrapper = setup({ queryResponse: makeResponse(columns, [row]), valueActionCallbacks: { openMonth } })
    const { button } = renderCell(wrapper.instance(), 'order_month', row)

    button.click()

    const [value, , context] = openMonth.mock.calls[0]
    expect(value).toBe(1709251200)
    expect(context.column).toEqual({
      name: 'order_month',
      display_name: 'Month',
      type: 'DATE',
      precision: 'MONTH',
      dow_style: 'NUM_1_MON',
    })
    expect(context.formattedValue).toBe('March 2024')
    wrapper.unmount()
  })

  test('a callback given as { onClick, tooltip } uses that tooltip and calls onClick', () => {
    const onClick = jest.fn()
    const wrapper = setup({ valueActionCallbacks: { openCustomerDrawer: { onClick, tooltip: 'View customer' } } })
    const { cell, button } = renderCell(wrapper.instance(), 'account_name')

    expect(button.getAttribute('aria-label')).toBe('View customer')
    button.dispatchEvent(new MouseEvent('mouseenter'))
    expect(cell.getElement().getAttribute('data-tooltip-content')).toBe('View customer')

    button.click()
    expect(onClick).toHaveBeenCalledWith('Acme', expect.any(Object), expect.any(Object))
    wrapper.unmount()
  })

  test('a callback column gets no button when the host app has no matching callback', () => {
    const wrapper = setup({ valueActionCallbacks: { somethingElse: jest.fn() } })
    expect(renderCell(wrapper.instance(), 'account_name').button).toBeNull()
    wrapper.unmount()

    const withoutProp = setup()
    expect(renderCell(withoutProp.instance(), 'account_name').button).toBeNull()
    withoutProp.unmount()
  })

  test('clicking a callback button does not drill down', () => {
    const wrapper = setup({ valueActionCallbacks: { openCustomerDrawer: jest.fn() } })
    const instance = wrapper.instance()
    const drilldownSpy = jest.spyOn(instance, 'processDrilldown').mockImplementation(() => Promise.resolve())
    const { button } = renderCell(instance, 'account_name')

    button.querySelector('svg').dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(drilldownSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('clicking a link button leaves it to the browser and does not drill down', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    const drilldownSpy = jest.spyOn(instance, 'processDrilldown').mockImplementation(() => Promise.resolve())
    const { button } = renderCell(instance, 'account_id')

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    button.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(drilldownSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('right-clicking the button keeps the browser menu, while the rest of the cell still copies', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    const copySpy = jest.spyOn(instance, 'copyToClipboard').mockImplementation(() => {})
    const { content, button } = renderCell(instance, 'account_id')

    const onButton = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    button.dispatchEvent(onButton)
    expect(onButton.defaultPrevented).toBe(false)
    expect(copySpy).not.toHaveBeenCalled()

    const onValue = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    content.querySelector('.react-autoql-cell-value').dispatchEvent(onValue)
    expect(onValue.defaultPrevented).toBe(true)
    expect(copySpy).toHaveBeenCalled()
    wrapper.unmount()
  })

  test('copying, HTML export and printing leave the button out', () => {
    const wrapper = setup({ valueActionCallbacks: { openCustomerDrawer: jest.fn() } })
    const instance = wrapper.instance()

    ;['formatterClipboard', 'formatterHtmlOutput', 'formatterPrint'].forEach((formatterName) => {
      const link = renderCell(instance, 'account_id', ROW, formatterName)
      expect(link.button).toBeNull()
      expect(link.content.querySelector('a, svg')).toBeNull()
      expect(link.content.textContent).toBe('1042')

      expect(renderCell(instance, 'account_name', ROW, formatterName).button).toBeNull()
    })
    wrapper.unmount()
  })

  test('pivot table cells get no button', () => {
    const columns = [
      {
        name: 'region',
        display_name: 'Region',
        type: 'STRING',
        groupable: true,
        value_action: LINK_ACTION,
      },
      { name: 'product', display_name: 'Product', type: 'STRING', groupable: true },
      { name: 'total', display_name: 'Total', type: 'QUANTITY', value_action: CALLBACK_ACTION },
    ]
    const rows = [
      ['West', 'Widgets', 5],
      ['East', 'Widgets', 3],
      ['West', 'Gadgets', 2],
    ]
    const wrapper = setup({
      queryResponse: makeResponse(columns, rows),
      valueActionCallbacks: { openCustomerDrawer: jest.fn() },
    })
    const instance = wrapper.instance()
    instance.generatePivotTableData({ isFirstGeneration: true })

    expect(instance.pivotTableColumns.length).toBeGreaterThan(1)
    instance.pivotTableColumns.forEach((definition, i) => {
      expect(definition.value_action).toBeUndefined()

      const element = document.createElement('div')
      const pivotRow = instance.pivotTableData[0]
      const cell = {
        getColumn: () => ({ getDefinition: () => definition }),
        getValue: () => pivotRow[i],
        getData: () => pivotRow,
        getElement: () => element,
      }
      const content = definition.formatter(cell, {}, () => {})
      if (content instanceof Node) {
        expect(content.querySelector('.react-autoql-cell-value-action-btn')).toBeNull()
      }
    })
    wrapper.unmount()
  })

  test('a plain click on a value action cell still drills down', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    const drilldownSpy = jest.spyOn(instance, 'processDrilldown').mockImplementation(() => Promise.resolve())

    instance.onTableCellClick(cellFor(instance, 'account_id'))

    expect(drilldownSpy).toHaveBeenCalled()
    wrapper.unmount()
  })

  test('cells with value_action null or missing get no button', () => {
    const wrapper = setup()
    const instance = wrapper.instance()

    expect(renderCell(instance, 'region').button).toBeNull()
    expect(renderCell(instance, 'total').button).toBeNull()
    wrapper.unmount()
  })

  test('an empty cell gets no button', () => {
    const wrapper = setup()
    const row = [null, '', 'West', 5]

    expect(renderCell(wrapper.instance(), 'account_id', row).button).toBeNull()
    expect(renderCell(wrapper.instance(), 'account_name', row).button).toBeNull()
    wrapper.unmount()
  })

  test('a link that is not http or https gets no button', () => {
    const wrapper = setup({
      queryResponse: makeResponse(
        makeColumns({ accountIdAction: { type: 'link', link_url: 'javascript:alert({value})' } }),
      ),
    })

    expect(renderCell(wrapper.instance(), 'account_id').button).toBeNull()
    wrapper.unmount()
  })

  test('hovering the button swaps the cell tooltip and leaving puts it back', () => {
    const wrapper = setup()
    const { cell, button } = renderCell(wrapper.instance(), 'account_id')

    button.dispatchEvent(new MouseEvent('mouseenter'))
    expect(cell.getElement().getAttribute('data-tooltip-content')).toBe('Open in new tab')

    button.dispatchEvent(new MouseEvent('mouseleave'))
    expect(cell.getElement().getAttribute('data-tooltip-content')).toBe(TOOLTIP_COPY_TEXTS.DEFAULT)
    wrapper.unmount()
  })

  test('the tooltip is read when hovering, so a changed callback tooltip shows without re-rendering', () => {
    const onClick = jest.fn()
    const wrapper = setup({ valueActionCallbacks: { openCustomerDrawer: { onClick, tooltip: 'View customer' } } })
    const { cell, button } = renderCell(wrapper.instance(), 'account_name')

    wrapper.setProps({ valueActionCallbacks: { openCustomerDrawer: { onClick, tooltip: 'Open customer drawer' } } })
    button.dispatchEvent(new MouseEvent('mouseenter'))

    expect(cell.getElement().getAttribute('data-tooltip-content')).toBe('Open customer drawer')
    expect(button.getAttribute('aria-label')).toBe('Open customer drawer')
    wrapper.unmount()
  })

  // A new query mounts a new QueryOutput (a new chat message, or a dashboard tile keyed on its
  // response version), so the columns come straight from the new response
  test('a new query picks up a changed value_action', () => {
    const first = setup()
    first.unmount()

    const wrapper = setup({
      queryResponse: makeResponse(
        makeColumns({
          accountIdAction: { type: 'link', link_url: 'https://erp.acme.com/{value}', link_target: '_self' },
        }),
      ),
    })
    const { button } = renderCell(wrapper.instance(), 'account_id')

    expect(button.getAttribute('href')).toBe('https://erp.acme.com/1042')
    expect(button.getAttribute('target')).toBe('_self')
    expect(button.getAttribute('aria-label')).toBe('Open')
    wrapper.unmount()
  })
})
