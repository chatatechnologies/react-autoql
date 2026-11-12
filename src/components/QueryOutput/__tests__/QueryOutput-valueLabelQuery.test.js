import React from 'react'
import { mount, shallow } from 'enzyme'
import { QueryOutput } from '../QueryOutput'
import ChataTable from '../../ChataTable/ChataTable'

const COLUMNS = [
  { name: 'category', display_name: 'Category', type: 'STRING', groupable: true, drill_down: 'category' },
  { name: 'total', display_name: 'Total', type: 'QUANTITY' },
]

const ROW = ['Bakery', 5]

const setup = (props = {}) =>
  mount(
    <QueryOutput
      authentication={{}}
      autoQLConfig={{ enableDrilldowns: true }}
      queryResponse={{ data: { data: { text: 'sales by category', query_id: 'q1', rows: [ROW], columns: COLUMNS } } }}
      initialDisplayType='table'
      {...props}
    />,
  )

// Renders the cell the way Tabulator does: the formatter's output inside the cell element, with
// clicks on the cell going to onTableCellClick (Tabulator's cellClick)
const renderCell = (instance, columnName, formatterName = 'formatter') => {
  const { field } = instance.getColumns().find((col) => col.name === columnName)
  const table = shallow(<ChataTable columns={instance.getColumns()} response={instance.queryResponse} />)
  const definition = table
    .instance()
    .getFilteredTabulatorColumnDefinitions()
    .find((def) => def.field === field)

  const element = document.createElement('div')
  const cell = {
    getColumn: () => ({ getDefinition: () => definition }),
    getField: () => definition.field,
    getValue: () => ROW[Number(definition.field)],
    getData: () => ROW,
    getElement: () => element,
  }

  element.appendChild(definition[formatterName](cell, {}, (onRendered) => onRendered()))
  element.addEventListener('click', (e) => instance.onTableCellClick(cell, e))
  return { cell, button: element.querySelector('.react-autoql-cell-vl-query-btn') }
}

describe('QueryOutput value label query', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('string cells get the button when the host can run the query', () => {
    const wrapper = setup({ onValueLabelQuery: jest.fn() })
    const instance = wrapper.instance()

    expect(renderCell(instance, 'category').button).not.toBeNull()
    expect(renderCell(instance, 'total').button).toBeNull()
    wrapper.unmount()
  })

  test('no button without onValueLabelQuery', () => {
    const wrapper = setup()
    expect(renderCell(wrapper.instance(), 'category').button).toBeNull()
    wrapper.unmount()
  })

  test('copying, HTML export and printing leave the button out', () => {
    const wrapper = setup({ onValueLabelQuery: jest.fn() })
    const instance = wrapper.instance()

    ;['formatterClipboard', 'formatterHtmlOutput', 'formatterPrint'].forEach((formatterName) => {
      expect(renderCell(instance, 'category', formatterName).button).toBeNull()
    })
    wrapper.unmount()
  })

  test('clicking the button opens the popover for that value instead of drilling down', () => {
    const wrapper = setup({ onValueLabelQuery: jest.fn() })
    const instance = wrapper.instance()
    const drilldownSpy = jest.spyOn(instance, 'processDrilldown').mockImplementation(() => Promise.resolve())
    const { button } = renderCell(instance, 'category')

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(drilldownSpy).not.toHaveBeenCalled()
    expect(instance.state.valueLabelQueryCell).toEqual(
      expect.objectContaining({ value: 'Bakery', column: expect.objectContaining({ name: 'category' }) }),
    )
    wrapper.unmount()
  })

  test('submitting runs the query with the lock and closes the popover', () => {
    const onValueLabelQuery = jest.fn()
    const wrapper = setup({ onValueLabelQuery })
    const instance = wrapper.instance()
    const lock = { key: 'category_canonical', value: 'bakery', isSession: true }
    instance.setState({ valueLabelQueryCell: { column: COLUMNS[0], value: 'Bakery', anchor: {} } })

    instance.onValueLabelQuerySubmit({ query: 'sales by month', lock })

    expect(onValueLabelQuery).toHaveBeenCalledWith({ query: 'sales by month', filters: [lock] })
    expect(instance.state.valueLabelQueryCell).toBeUndefined()
    wrapper.unmount()
  })
})
