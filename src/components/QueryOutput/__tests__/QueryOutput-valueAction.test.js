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

// Renders the cell the way Tabulator does: the formatter's output inside the cell element
const renderCell = (instance, columnName, row) => {
  const cell = cellFor(instance, columnName, row)
  const content = cell
    .getColumn()
    .getDefinition()
    .formatter(cell, {}, () => {})
  cell.getElement().appendChild(content)
  return { cell, button: content.querySelector('.react-autoql-cell-value-action-btn') }
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

  test('a callback button with no matching callback does nothing', () => {
    const somethingElse = jest.fn()
    const wrapper = setup({ valueActionCallbacks: { somethingElse } })
    const { button } = renderCell(wrapper.instance(), 'account_name')

    expect(() => button.click()).not.toThrow()
    expect(somethingElse).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('clicking the button does not reach the cell, so it does not drill down', () => {
    const wrapper = setup({ valueActionCallbacks: { openCustomerDrawer: jest.fn() } })
    const { cell, button } = renderCell(wrapper.instance(), 'account_name')
    const cellClick = jest.fn()
    cell.getElement().addEventListener('click', cellClick)

    button.click()

    expect(cellClick).not.toHaveBeenCalled()
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
