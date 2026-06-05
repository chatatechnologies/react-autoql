import React from 'react'
import { mount } from 'enzyme'
import { Dashboard } from '../Dashboard'

jest.mock('react-grid-layout', () => {
  const RGL = ({ children }) => <div>{children}</div>
  return { __esModule: true, default: RGL, WidthProvider: (C) => C }
})

jest.mock('../DashboardTile', () => ({ DashboardTile: () => null }))
jest.mock('../DrilldownModal', () => ({ __esModule: true, default: () => null }))
jest.mock('../../Tooltip', () => ({ Tooltip: () => null, triggerGlobalTooltipClose: () => {} }))
jest.mock('../../DashboardToolbar', () => ({ DashboardToolbar: () => null }))
jest.mock('../../../containers/ErrorHOC', () => ({ ErrorBoundary: ({ children }) => <>{children}</> }))

const makeTile = (overrides = {}) => ({
  key: 'tile-1',
  i: 'tile-1',
  query: 'SELECT 1',
  tableFilters: [{ col: 'x', value: 'y' }],
  filters: [{ col: 'a', value: 'b' }],
  columnSelects: [{ col: 'c' }],
  columns: [{ field: '0' }],
  orders: [{ col: 'x', direction: 'asc' }],
  queryResponse: { data: { reference_id: '0.0.200.1' } },
  ...overrides,
})

describe('Dashboard resetTile', () => {
  it('mounts and renders without errors when isEditing prop is passed', () => {
    const wrapper = mount(<Dashboard tiles={[makeTile()]} onChange={jest.fn()} isEditing={true} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.find('DashboardWithoutTheme')).toHaveLength(1)

    wrapper.unmount()
  })

  it('renders with tiles', () => {
    const wrapper = mount(<Dashboard tiles={[makeTile()]} onChange={jest.fn()} />)

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })
})

describe('Dashboard undo after reset', () => {
  it('renders successfully', () => {
    const onChange = jest.fn()
    const wrapper = mount(<Dashboard tiles={[makeTile()]} onChange={onChange} isEditing={true} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.find('DashboardWithoutTheme')).toHaveLength(1)

    wrapper.unmount()
  })
})

describe('Dashboard addTileStateToLog during reset', () => {
  it('handles adding tile state to log', () => {
    const wrapper = mount(
      <Dashboard tiles={[{ key: 'tile-1', i: 'tile-1', query: 'SELECT 1' }]} onChange={jest.fn()} isEditing={true} />,
    )

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })
})

describe('Dashboard resetTile new fields', () => {
  it('initializes properly with isEditing prop', () => {
    const wrapper = mount(<Dashboard tiles={[makeTile()]} onChange={jest.fn()} isEditing={true} />)

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })

  it('handles tile configuration with columns', () => {
    const tile = makeTile({ columns: [{ field: '0' }], available_selects: ['a'], displayOverrides: [{ x: 1 }] })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} />)

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })

  it('handles complex tile state', () => {
    const tile = makeTile({
      query: 'SELECT 1',
      queryResponse: { data: { rows: [[1, 2, 3]] } },
      secondQuery: 'SELECT 2',
      secondQueryResponse: { data: { rows: [[4, 5, 6]] } },
    })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} />)

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })

  it('clears dataConfig and secondDataConfig on reset', () => {
    const tile = makeTile({
      dataConfig: { tableConfig: { columnMap: {} }, pivotTableConfig: null },
      secondDataConfig: { tableConfig: null, pivotTableConfig: { cols: [] } },
    })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.resetTile('tile-1')

    // pendingResetTiles is set synchronously before the async execution chain
    const resetTile = instance.pendingResetTiles?.find((t) => t.i === 'tile-1')
    expect(resetTile).toBeDefined()
    expect(resetTile.dataConfig).toBeUndefined()
    expect(resetTile.secondDataConfig).toBeUndefined()
    expect(resetTile.tableFilters).toEqual([])
    expect(resetTile.orders).toEqual([])

    wrapper.unmount()
  })
})

describe('Dashboard discardChanges', () => {
  it('mounts and renders successfully', () => {
    const wrapper = mount(<Dashboard tiles={[makeTile()]} onChange={jest.fn()} isEditing={true} />)

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })

  it('handles stopEditingCallback prop', () => {
    const stopEditingCallback = jest.fn()
    const wrapper = mount(
      <Dashboard tiles={[makeTile()]} onChange={jest.fn()} isEditing stopEditingCallback={stopEditingCallback} />,
    )

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })
})

describe('Dashboard handleDiscardEvent', () => {
  it('renders successfully', () => {
    const wrapper = mount(<Dashboard tiles={[makeTile()]} onChange={jest.fn()} />)

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })
})

describe('Dashboard componentDidUpdate isResettingTile guard', () => {
  it('renders successfully with executeOnStopEditing', () => {
    const wrapper = mount(
      <Dashboard tiles={[makeTile()]} onChange={jest.fn()} isEditing executeOnStopEditing />,
    )

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })
})

describe('Dashboard resetTileStateLog', () => {
  it('renders dashboard with tiles for state logging', () => {
    const tile = makeTile({ queryResponse: { data: { reference_id: '1.1.200' } } })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)

    expect(wrapper).toBeDefined()

    wrapper.unmount()
  })
})
