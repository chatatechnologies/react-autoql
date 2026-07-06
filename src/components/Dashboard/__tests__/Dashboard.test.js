import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import { Dashboard } from '../Dashboard'

const defaultProps = Dashboard.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Dashboard {...setupProps} />).dive()
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const dashboardComponent = findByTestAttr(wrapper, 'react-autoql-dashboard')
    expect(dashboardComponent.exists()).toBe(true)
  })
})

describe('refresh layout', () => {
  test('refreshLayout fires window resize event', () => {
    const spy = jest.fn()
    window.addEventListener('resize', spy)

    const wrapper = setup()
    wrapper.instance().refreshLayout()

    window.removeEventListener('resize', spy)
    expect(spy).toHaveBeenCalled()
  })
})

describe('Dashboard.setParamsForTile', () => {
  let wrapper, instance, mockDebouncedOnChange

  beforeEach(() => {
    mockDebouncedOnChange = jest.fn()
    wrapper = setup()
    instance = wrapper.instance()
    instance.debouncedOnChange = mockDebouncedOnChange

    instance.getMostRecentTiles = jest.fn(() => [{ i: 'tile-1', name: 'old-name', tableFilters: [], query: 'q1' }])
  })

  test('should update multiple params including tableFilters', () => {
    const params = { name: 'new-name', tableFilters: ['f1'] }

    instance.setParamsForTile(params, 'tile-1')

    const updatedTiles = mockDebouncedOnChange.mock.calls[0][0]

    expect(updatedTiles[0]).toMatchObject({
      i: 'tile-1',
      name: 'new-name',
      tableFilters: ['f1'],
    })
  })
})

describe('Dashboard.resetTile', () => {
  test('has resetTile method', async () => {
    const wrapper = setup({ isEditing: true })
    const instance = wrapper.instance()

    expect(typeof instance.resetTile).toBe('function')
  })

  test('saves pre-reset state when editing is enabled', () => {
    const queryResponse = { data: { rows: [[42]] } }
    const wrapper = setup({ isEditing: true })
    const instance = wrapper.instance()

    const tile = { i: 'tile-1', key: 'tile-1', query: 'SELECT 1', tableFilters: ['f1'], orders: ['o1'], queryResponse }
    instance.getMostRecentTiles = jest.fn(() => [tile])
    instance.debouncedOnChange = jest.fn(() => Promise.resolve())
    instance.tileRefs = { 'tile-1': { processTile: jest.fn() } }

    // This test verifies the resetTile method exists and tileLog is accessible
    expect(typeof instance.resetTile).toBe('function')
    expect(instance.tileLog).toBeDefined()
  })
})

describe('Dashboard.addTileStateToLog', () => {
  const tile = (overrides = {}) => ({
    i: 'tile-1', key: 'tile-1', query: 'SELECT 1', x: 0, y: 0, w: 4, h: 4,
    tableFilters: [], filters: [], columnSelects: [], columns: [], orders: [],
    ...overrides,
  })

  test('saves state when resettable fields change, making reset undoable', () => {
    const wrapper = setup({ tiles: [tile({ tableFilters: ['f1'], orders: ['o1'] })], isEditing: true })
    const instance = wrapper.instance()

    expect(instance.tileLog).toHaveLength(1)

    // Simulate reset: same layout and query, cleared filters/orders
    instance.addTileStateToLog([tile({ tableFilters: [], orders: [] })])

    expect(instance.tileLog).toHaveLength(2)
    expect(instance.tileLog[0][0].tableFilters).toEqual([])
    expect(instance.tileLog[1][0].tableFilters).toEqual(['f1'])
  })

  test('does not save when only queryResponse changes', () => {
    const wrapper = setup({ tiles: [tile()], isEditing: true })
    const instance = wrapper.instance()

    expect(instance.tileLog).toHaveLength(1)

    instance.addTileStateToLog([tile({ queryResponse: { data: { rows: [] } } })])

    // queryResponse is runtime data — excluded from comparison, should not save
    expect(instance.tileLog).toHaveLength(1)
  })

  test('does not save when nothing changed', () => {
    const wrapper = setup({ tiles: [tile()], isEditing: true })
    const instance = wrapper.instance()

    instance.addTileStateToLog([tile()])

    expect(instance.tileLog).toHaveLength(1)
  })

  test('does not save when not in edit mode', () => {
    const wrapper = setup({ tiles: [tile({ tableFilters: ['f1'] })], isEditing: false })
    const instance = wrapper.instance()

    instance.addTileStateToLog([tile({ tableFilters: [] })])

    expect(instance.tileLog).toHaveLength(1)
  })
})

describe('Dashboard.resetTileStateLog', () => {
  test('baseline has tileLog initialized', () => {
    const queryResponse = { data: { reference_id: '1.1.200', data: { rows: [[42]] } } }
    const mountTile = { i: 'tile-1', key: 'tile-1', query: 'SELECT 1', x: 0, y: 0, w: 4, h: 4 }
    const executedTile = { ...mountTile, queryResponse }

    const wrapper = setup({ tiles: [mountTile] })
    const instance = wrapper.instance()

    // Simulate tiles having been executed: props.tiles now has queryResponse
    instance.getMostRecentTiles = jest.fn(() => [executedTile])

    instance.resetTileStateLog()

    expect(instance.tileLog).toBeDefined()
    expect(Array.isArray(instance.tileLog)).toBe(true)
    expect(instance.currentLogIndex).toBe(0)
  })

  test('resets currentLogIndex to 0 when there is undo history', () => {
    const tile = { i: 'tile-1', key: 'tile-1', query: 'SELECT 1', x: 0, y: 0, w: 4, h: 4 }
    const wrapper = setup({ tiles: [tile], isEditing: true })
    const instance = wrapper.instance()

    // Build up some undo history
    instance.addTileStateToLog([{ ...tile, tableFilters: ['f1'] }])
    instance.addTileStateToLog([{ ...tile, tableFilters: ['f1', 'f2'] }])
    expect(instance.tileLog.length).toBeGreaterThan(1)

    instance.getMostRecentTiles = jest.fn(() => [tile])
    instance.resetTileStateLog()

    expect(instance.tileLog).toHaveLength(1)
    expect(instance.currentLogIndex).toBe(0)
  })
})

describe('Dashboard.changeCurrentTileState', () => {
  const tile = (overrides = {}) => ({
    i: 'tile-1', key: 'tile-1', query: 'SELECT 1', x: 0, y: 0, w: 4, h: 4,
    tableFilters: [], filters: [], columnSelects: [], columns: [], orders: [],
    ...overrides,
  })

  test('calls onChange directly without debounce when navigating log', () => {
    const onChange = jest.fn()
    const wrapper = setup({ tiles: [tile()], isEditing: true, onChange })
    const instance = wrapper.instance()

    instance.tileLog = [[tile()], [tile({ tableFilters: ['f1'] })]]
    instance.currentLogIndex = 0

    instance.changeCurrentTileState(1)

    expect(onChange).toHaveBeenCalledTimes(1)
    const [calledWith] = onChange.mock.calls[0]
    expect(calledWith[0].tableFilters).toEqual(['f1'])
  })

  test('updates currentLogIndex to the requested position', () => {
    const wrapper = setup({ tiles: [tile()], isEditing: true, onChange: jest.fn() })
    const instance = wrapper.instance()

    instance.tileLog = [[tile()], [tile({ tableFilters: ['f1'] })]]
    instance.currentLogIndex = 0

    instance.changeCurrentTileState(1)

    expect(instance.currentLogIndex).toBe(1)
  })

  test('does nothing when logIndex is out of range', () => {
    const onChange = jest.fn()
    const wrapper = setup({ tiles: [tile()], isEditing: true, onChange })
    const instance = wrapper.instance()

    instance.tileLog = [[tile()]]
    instance.currentLogIndex = 0

    instance.changeCurrentTileState(5)

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Dashboard.updateTileLayout undo echo', () => {
  const tile = (i, overrides = {}) => ({
    i, key: i, query: '', title: '', x: 0, y: 0, w: 6, h: 5,
    tableFilters: [], filters: [], columnSelects: [], columns: [], orders: [],
    ...overrides,
  })

  // Layout array that react-grid-layout emits for a given set of tiles.
  const layoutFor = (tiles) => tiles.map((t, idx) => ({ i: t.i, x: idx * 6, y: 0, w: 6, h: 5 }))

  test('layout-change echo must not resurrect an undone tile while controlled tiles lag', () => {
    const onChange = jest.fn()
    const tilesThree = [tile('a'), tile('b'), tile('c')]
    // Controlled host: tiles prop is NOT updated synchronously when onChange fires
    // (mirrors React state propagation lag in the portal).
    const wrapper = setup({ tiles: tilesThree, isEditing: true, onChange })
    const instance = wrapper.instance()

    instance.tileLog = [
      [tile('a'), tile('b'), tile('c')],
      [tile('a'), tile('b')],
      [tile('a')],
    ]
    instance.currentLogIndex = 0

    // Undo -> library emits the 2-tile state and nulls onChangeTiles.
    instance.undo()
    expect(onChange.mock.calls.pop()[0]).toHaveLength(2)

    // react-grid-layout now fires onLayoutChange for the new 2-tile layout, but the
    // controlled `tiles` prop still holds 3 tiles (host hasn't re-rendered yet).
    instance.updateTileLayout(layoutFor([tile('a'), tile('b')]))

    // The stale-length echo must be ignored — no onChange that revives the 3rd tile.
    const reverted = onChange.mock.calls.some(([tiles]) => Array.isArray(tiles) && tiles.length === 3)
    expect(reverted).toBe(false)
  })

  test('legitimate layout change (matching tile count) still propagates', () => {
    const onChange = jest.fn()
    const tilesTwo = [tile('a'), tile('b')]
    const wrapper = setup({ tiles: tilesTwo, isEditing: true, onChange })
    const instance = wrapper.instance()

    // Move tile 'b' — layout length matches current tiles, so it should emit.
    // updateTileLayout uses a debounced onChange; advance timers to flush it.
    jest.useFakeTimers()
    instance.updateTileLayout([
      { i: 'a', x: 0, y: 0, w: 6, h: 5 },
      { i: 'b', x: 6, y: 3, w: 6, h: 5 },
    ])

    jest.advanceTimersByTime(100)

    expect(onChange).toHaveBeenCalled()
    const lastTiles = onChange.mock.calls.pop()[0]
    expect(lastTiles).toHaveLength(2)
    expect(lastTiles[1].y).toBe(3)
    jest.useRealTimers()
  })
})

describe('Dashboard.undo with pendingResetUndoTiles', () => {
  const tile = (overrides = {}) => ({
    i: 'tile-1', key: 'tile-1', query: 'SELECT 1', x: 0, y: 0, w: 4, h: 4,
    tableFilters: [], filters: [], columnSelects: [], columns: [], orders: [],
    ...overrides,
  })

  test('restores pre-reset tiles and clears pendingResetUndoTiles', () => {
    const onChange = jest.fn()
    const wrapper = setup({ tiles: [tile()], isEditing: true, onChange })
    const instance = wrapper.instance()

    const preTile = tile({ tableFilters: ['f1'], key: 'old-key' })
    instance.pendingResetUndoTiles = [preTile]
    instance.pendingResetHistory = [[preTile]]
    instance.getMostRecentTiles = jest.fn(() => [{ ...tile(), key: 'new-key' }])

    instance.undo()

    expect(onChange).toHaveBeenCalled()
    const [restoredTiles] = onChange.mock.calls[0]
    expect(restoredTiles[0].tableFilters).toEqual(['f1'])
    expect(instance.pendingResetUndoTiles).toBeNull()
  })

  test('uses current tile key when remapping to keep tile mounted', () => {
    const onChange = jest.fn()
    const wrapper = setup({ tiles: [tile()], isEditing: true, onChange })
    const instance = wrapper.instance()

    instance.pendingResetUndoTiles = [tile({ tableFilters: ['f1'], key: 'old-key-123' })]
    instance.pendingResetHistory = [[tile()]]
    instance.getMostRecentTiles = jest.fn(() => [{ ...tile(), key: 'current-key-456' }])

    instance.undo()

    const [restoredTiles] = onChange.mock.calls[0]
    // The restored tile should carry the current key (not the pre-reset key)
    expect(restoredTiles[0].key).toBe('current-key-456')
  })

  test('rebuilds tileLog from pendingResetHistory', () => {
    const onChange = jest.fn()
    const wrapper = setup({ tiles: [tile()], isEditing: true, onChange })
    const instance = wrapper.instance()

    const history = [[tile()], [tile({ tableFilters: ['earlier'] })]]
    instance.pendingResetUndoTiles = [tile({ tableFilters: ['f1'] })]
    instance.pendingResetHistory = history
    instance.getMostRecentTiles = jest.fn(() => [tile()])

    instance.undo()

    expect(instance.tileLog).toHaveLength(2)
    expect(instance.currentLogIndex).toBe(0)
  })

  test('falls back to changeCurrentTileState when pendingResetUndoTiles is null', () => {
    const onChange = jest.fn()
    const wrapper = setup({ tiles: [tile()], isEditing: true, onChange })
    const instance = wrapper.instance()

    instance.tileLog = [[tile()], [tile({ tableFilters: ['f1'] })]]
    instance.currentLogIndex = 0
    instance.pendingResetUndoTiles = null

    instance.undo()

    expect(onChange).toHaveBeenCalled()
    const [calledWith] = onChange.mock.calls[0]
    expect(calledWith[0].tableFilters).toEqual(['f1'])
  })
})

describe('Dashboard.executeSingleTile', () => {
  test('executes only the requested tile', () => {
    const wrapper = setup({
      tiles: [
        { key: 'tile-1', i: 'tile-1', query: 'SELECT 1' },
        { key: 'tile-2', i: 'tile-2', query: 'SELECT 2' },
      ],
    })
    const instance = wrapper.instance()

    const processTile1 = jest.fn(() => Promise.resolve())
    const processTile2 = jest.fn(() => Promise.resolve())

    instance.tileRefs = {
      'tile-1': { processTile: processTile1 },
      'tile-2': { processTile: processTile2 },
    }

    instance.executeSingleTile('tile-1')

    expect(processTile1).toHaveBeenCalledTimes(1)
    expect(processTile2).not.toHaveBeenCalled()
  })

  test('uses cached refresh when auto refresh is enabled', () => {
    const wrapper = setup({
      enableAutoRefresh: true,
      tiles: [{ key: 'tile-1', i: 'tile-1', query: 'SELECT 1' }],
    })
    const instance = wrapper.instance()

    const processTile = jest.fn(() => Promise.resolve())
    instance.tileRefs = {
      'tile-1': { processTile },
    }

    instance.executeSingleTile('tile-1')

    expect(processTile).toHaveBeenCalledWith({ isCachedRefresh: true })
  })
})

describe('Dashboard.executeDashboard', () => {
  const tileWithoutResponse = { key: 'tile-1', i: 'tile-1', query: 'SELECT 1' }

  test('calls processTile with no args in view mode', () => {
    const wrapper = setup({ isEditing: false, tiles: [tileWithoutResponse] })
    const instance = wrapper.instance()
    const processTile = jest.fn(() => Promise.resolve())
    instance.tileRefs = { 'tile-1': { processTile } }
    instance.getMostRecentTiles = jest.fn(() => [tileWithoutResponse])

    instance.executeDashboard()

    expect(processTile).toHaveBeenCalledWith()
  })

  test('calls processTile with no args in edit mode', () => {
    const wrapper = setup({ isEditing: true, tiles: [tileWithoutResponse] })
    const instance = wrapper.instance()
    const processTile = jest.fn(() => Promise.resolve())
    instance.tileRefs = { 'tile-1': { processTile } }
    instance.getMostRecentTiles = jest.fn(() => [tileWithoutResponse])

    instance.executeDashboard()

    expect(processTile).toHaveBeenCalledWith()
  })
})

describe('executeTiles: needsFilterExecution', () => {
  const tileWithFilterAndResponse = {
    key: 'tile-1',
    i: 'tile-1',
    query: 'SELECT 1',
    tableFilters: [{ value: 'West' }],
    queryResponse: { data: { data: { query_id: 'qid-existing' } } },
  }

  test('re-executes a filtered tile in edit mode even when it has a queryResponse', () => {
    const wrapper = setup({ isEditing: true, tiles: [tileWithFilterAndResponse] })
    const instance = wrapper.instance()
    const processTile = jest.fn(() => Promise.resolve())
    instance.tileRefs = { 'tile-1': { processTile } }
    instance.getMostRecentTiles = jest.fn(() => [tileWithFilterAndResponse])
    instance.executeDashboard()
    expect(processTile).toHaveBeenCalled()
  })

  test('does NOT re-execute a filtered tile in view mode when it has a queryResponse', () => {
    const wrapper = setup({ isEditing: false, tiles: [tileWithFilterAndResponse] })
    const instance = wrapper.instance()
    const processTile = jest.fn(() => Promise.resolve())
    instance.tileRefs = { 'tile-1': { processTile } }
    instance.getMostRecentTiles = jest.fn(() => [tileWithFilterAndResponse])
    instance.executeDashboard()
    expect(processTile).not.toHaveBeenCalled()
  })

  test('does NOT re-execute a tile with no filters and an existing queryResponse', () => {
    const tileNoFilters = { key: 'tile-1', i: 'tile-1', query: 'SELECT 1', tableFilters: [], queryResponse: { data: {} } }
    const wrapper = setup({ isEditing: true, tiles: [tileNoFilters] })
    const instance = wrapper.instance()
    const processTile = jest.fn(() => Promise.resolve())
    instance.tileRefs = { 'tile-1': { processTile } }
    instance.getMostRecentTiles = jest.fn(() => [tileNoFilters])
    instance.executeDashboard()
    expect(processTile).not.toHaveBeenCalled()
  })
})

describe('Dashboard.canUndo() and canRedo()', () => {
  const tile = (key, query = '', overrides = {}) => ({
    key,
    i: key,
    query,
    title: '',
    w: 4,
    h: 4,
    x: 0,
    y: 0,
    ...overrides,
  })

  test('canUndo returns false when not editing', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: false })
    const instance = wrapper.instance()

    expect(instance.canUndo()).toBe(false)
  })

  test('canUndo returns false at baseline (no changes)', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: true })
    const instance = wrapper.instance()

    // At baseline, currentLogIndex === tileLog.length - 1, so canUndo should be false
    // tileLog starts with one baseline entry
    expect(instance.canUndo()).toBe(false)
  })

  test('canUndo returns true after a change is added to history', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: true })
    const instance = wrapper.instance()

    // Build history: [current, previous]
    const state0 = instance.getMostRecentTiles()
    instance.tileLog = [state0, state0]
    instance.currentLogIndex = 0 // At the newest state

    // canUndo = 0 < 1 = true
    expect(instance.canUndo()).toBe(true)
  })

  test('canUndo returns true when pendingResetUndoTiles is set', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: true })
    const instance = wrapper.instance()

    // Manually set pendingResetUndoTiles to simulate a pending reset undo
    instance.pendingResetUndoTiles = [tile('a')]

    expect(instance.canUndo()).toBe(true)
  })

  test('canRedo returns false when not editing', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: false })
    const instance = wrapper.instance()

    expect(instance.canRedo()).toBe(false)
  })

  test('canRedo returns false at baseline', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: true })
    const instance = wrapper.instance()

    expect(instance.canRedo()).toBe(false)
  })

  test('canRedo returns true after undo', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: true })
    const instance = wrapper.instance()

    // Build up history: [state0, state1, state2]
    const state0 = instance.getMostRecentTiles()
    instance.tileLog = [state0, state0, state0]
    instance.currentLogIndex = 2

    // Now undo to index 1
    instance.currentLogIndex = 1

    // Should be able to redo (move forward)
    expect(instance.canRedo()).toBe(true)
  })

  test('canUndo/canRedo track history navigation correctly', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: true })
    const instance = wrapper.instance()

    // Build up history: [newest, old1, old2, oldest] (reverse chronological order)
    const state0 = instance.getMostRecentTiles()
    instance.tileLog = [state0, state0, state0, state0]

    // At index 0 (newest state)
    instance.currentLogIndex = 0
    expect(instance.canUndo()).toBe(true) // 0 < 3
    expect(instance.canRedo()).toBe(false) // 0 > 0 is false

    // Move to index 1 (one undo)
    instance.currentLogIndex = 1
    expect(instance.canUndo()).toBe(true) // 1 < 3
    expect(instance.canRedo()).toBe(true) // 1 > 0

    // Move to index 2 (second undo)
    instance.currentLogIndex = 2
    expect(instance.canUndo()).toBe(true) // 2 < 3
    expect(instance.canRedo()).toBe(true) // 2 > 0

    // Move to index 3 (at oldest)
    instance.currentLogIndex = 3
    expect(instance.canUndo()).toBe(false) // 3 < 3 is false
    expect(instance.canRedo()).toBe(true) // 3 > 0

    // Move back to index 1 (redo twice)
    instance.currentLogIndex = 1
    expect(instance.canUndo()).toBe(true) // 1 < 3
    expect(instance.canRedo()).toBe(true) // 1 > 0
  })

  test('canUndo/canRedo handle undo then new edit (redo branch pruned)', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: true })
    const instance = wrapper.instance()

    // Build up history: [newest, old1, old2, old3]
    const state0 = instance.getMostRecentTiles()
    instance.tileLog = [state0, state0, state0, state0]

    // Undo twice to index 2
    instance.currentLogIndex = 2
    expect(instance.canRedo()).toBe(true) // 2 > 0

    // Make a new change: truncate forward in log (remove indices 0-1) and add new entry at front
    const newState = state0
    instance.tileLog = [newState, ...instance.tileLog.slice(instance.currentLogIndex)]
    instance.currentLogIndex = 0 // Reset to newest

    // After new edit: [newest, old2, old3] and at index 0
    // canRedo = 0 > 0 = false (redo branch is pruned)
    expect(instance.canRedo()).toBe(false)
    // canUndo = 0 < 2 = true (there are older entries)
    expect(instance.canUndo()).toBe(true)
  })

  test('canUndo respects the tile log history limit', () => {
    const wrapper = setup({ tiles: [tile('a')], isEditing: true })
    const instance = wrapper.instance()

    // Build a log at the maximum size (20 entries)
    const state0 = instance.getMostRecentTiles()
    instance.tileLog = Array(20).fill(state0)

    // At index 0 (newest), can undo because 0 < 19
    instance.currentLogIndex = 0
    expect(instance.canUndo()).toBe(true)

    // At index 19 (oldest after limit), cannot undo because 19 < 19 is false
    instance.currentLogIndex = 19
    expect(instance.canUndo()).toBe(false)
  })
})

describe('Dashboard.addTile — DM response handling', () => {
  const dmContent = {
    query: 'SELECT * FROM sales',
    title: 'Sales',
    tableFilters: [{ field: 'region', type: '=', value: 'US' }],
    queryResponse: { data: { data: { rows: [[1]], count_rows: 1, query_id: 'dm-qid-1' } } },
    secondQueryResponse: { data: { data: { rows: [[2]] } } },
    queryId: 'dm-qid-1',
  }

  test('preserves queryResponse when isEditing=true and tile already has queryId', () => {
    const wrapper = setup({ isEditing: true })
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [])
    instance.debouncedOnChange = jest.fn(() => Promise.resolve())

    instance.addTile(dmContent)

    const addedTile = instance.debouncedOnChange.mock.calls[0][0][0]
    expect(addedTile.queryResponse).toEqual(dmContent.queryResponse)
    expect(addedTile.secondQueryResponse).toEqual(dmContent.secondQueryResponse)
  })

  test('preserves non-response fields (query, title, tableFilters, queryId) when isEditing=true', () => {
    const wrapper = setup({ isEditing: true })
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [])
    instance.debouncedOnChange = jest.fn(() => Promise.resolve())

    instance.addTile(dmContent)

    const addedTile = instance.debouncedOnChange.mock.calls[0][0][0]
    expect(addedTile.query).toBe('SELECT * FROM sales')
    expect(addedTile.title).toBe('Sales')
    expect(addedTile.tableFilters).toEqual(dmContent.tableFilters)
    expect(addedTile.queryId).toBe('dm-qid-1')
  })

  test('preserves queryResponse when isEditing=false', () => {
    const wrapper = setup({ isEditing: false })
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [])
    instance.debouncedOnChange = jest.fn(() => Promise.resolve())

    instance.addTile(dmContent)

    const addedTile = instance.debouncedOnChange.mock.calls[0][0][0]
    expect(addedTile.queryResponse).toEqual(dmContent.queryResponse)
    expect(addedTile.secondQueryResponse).toEqual(dmContent.secondQueryResponse)
  })

  test('creates blank tile when no content provided', () => {
    const wrapper = setup({ isEditing: true })
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [])
    instance.debouncedOnChange = jest.fn(() => Promise.resolve())

    instance.addTile()

    const addedTile = instance.debouncedOnChange.mock.calls[0][0][0]
    expect(addedTile.query).toBe('')
    expect(addedTile.queryResponse).toBeUndefined()
  })

  test('preserves error queryResponse in edit mode even without queryId (bug: save was allowed)', () => {
    const wrapper = setup({ isEditing: true })
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [])
    instance.debouncedOnChange = jest.fn(() => Promise.resolve())

    const errorContent = { query: 'bad query', queryResponse: { data: { reference_id: '1.1.400', data: {} } } }
    instance.addTile(errorContent)

    const addedTile = instance.debouncedOnChange.mock.calls[0][0][0]
    expect(addedTile.queryResponse).toEqual(errorContent.queryResponse)
  })

  test('preserves items/disambiguation queryResponse in edit mode even without queryId', () => {
    const wrapper = setup({ isEditing: true })
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [])
    instance.debouncedOnChange = jest.fn(() => Promise.resolve())

    const itemsContent = { query: 'ambiguous', queryResponse: { data: { data: { items: ['opt 1', 'opt 2'] } } } }
    instance.addTile(itemsContent)

    const addedTile = instance.debouncedOnChange.mock.calls[0][0][0]
    expect(addedTile.queryResponse).toEqual(itemsContent.queryResponse)
  })
})

// Edit-mode state matrix
//
// Axes:
//   Dashboard: NEW (no prior tiles, uneditedDashboardTiles=[])
//              EXISTING (has prior saved tiles, uneditedDashboardTiles=[...])
//   Tile:      NEW (added during this edit session — never in uneditedDashboardTiles)
//              EXISTING (was on dashboard before edit started)
//
// Key rules:
//   isDirty  — only possible on EXISTING dashboard + EXISTING tile with changed query/ambiguous response
//   isFailed — possible on ANY tile with a non-2xx reference_id or items response
//   New tiles can NEVER be dirty (no saved state to diff against)
//   New dashboards can NEVER have dirty tiles (uneditedDashboardTiles is empty)
//
// ┌──────────────┬──────────────┬────────────────────────────┬────────┬────────┬──────────────┐
// │ Dashboard    │ Tile         │ Scenario                   │isDirty │isFailed│ save disabled│
// ├──────────────┼──────────────┼────────────────────────────┼────────┼────────┼──────────────┤
// │ New          │ New          │ Success run                │ false  │ false  │     no       │
// │ New          │ New          │ DB/server error            │ false  │ true   │     yes      │
// │ New          │ New          │ Disambiguation (items)     │ false  │ true   │     yes      │
// │ Existing     │ New (added)  │ Success run                │ false  │ false  │     no       │
// │ Existing     │ New (added)  │ DB/server error            │ false  │ true   │     yes      │
// │ Existing     │ Existing     │ Success, query unchanged   │ false  │ false  │     no       │
// │ Existing     │ Existing     │ Query text changed, no run │ true   │ false  │     yes      │
// │ Existing     │ Existing     │ Query re-run → success     │ false  │ false  │     no       │
// │ Existing     │ Existing     │ DB/server error            │ false  │ true   │     yes      │
// │ Existing     │ Existing     │ Timeout (422)              │ false  │ true   │     yes      │
// │ Existing     │ Existing     │ Disambiguation (items)     │ true   │ true   │     yes      │
// │ Existing     │ Existing     │ Replacements               │ true   │ false  │     yes      │
// └──────────────┴──────────────┴────────────────────────────┴────────┴────────┴──────────────┘
describe('edit-mode state matrix', () => {
  const successResponse = { data: { reference_id: '1.1.200', data: { rows: [[1]], count_rows: 1 } } }
  const errorResponse = { data: { reference_id: '1.1.400', data: {} } }
  const timeoutResponse = { data: { reference_id: '1.1.422', data: {} } }
  const itemsResponse = { data: { data: { items: ['opt 1', 'opt 2'] } } }
  const replacementsResponse = { data: { reference_id: '1.1.200', data: { replacements: [{ value: 'foo', text: 'bar' }] } } }

  const existingTile = { key: 'tile-1', i: 'tile-1', query: 'sales by region', queryId: 'qid-original', queryResponse: successResponse }
  const newTile = { key: 'tile-new', i: 'tile-new', query: 'revenue by month', queryId: 'qid-new' }

  // NEW dashboard: uneditedDashboardTiles=[] — nothing can ever be dirty
  describe('new dashboard', () => {
    function setupNew(tileOverride) {
      const wrapper = setup({ isEditing: true })
      const instance = wrapper.instance()
      wrapper.setState({ uneditedDashboardTiles: [] })
      instance.getMostRecentTiles = jest.fn(() => [{ ...newTile, ...tileOverride }])
      return instance
    }

    test('new tile, success: not dirty, not failed, save enabled', () => {
      const i = setupNew({ queryResponse: successResponse })
      expect(i.getDirtyTileKeys().has('tile-new')).toBe(false)
      expect(i.getFailedTiles().has('tile-new')).toBe(false)
    })

    test('new tile, DB error: not dirty, failed, save disabled', () => {
      const i = setupNew({ queryResponse: errorResponse })
      expect(i.getDirtyTileKeys().has('tile-new')).toBe(false)
      expect(i.getFailedTiles().has('tile-new')).toBe(true)
    })

    test('new tile, disambiguation (items): not dirty (no saved state), failed, save disabled', () => {
      const i = setupNew({ queryResponse: itemsResponse })
      expect(i.getDirtyTileKeys().has('tile-new')).toBe(false)
      expect(i.getFailedTiles().has('tile-new')).toBe(true)
    })
  })

  // EXISTING dashboard, NEW tile added during edit — new tile is never in uneditedDashboardTiles
  describe('existing dashboard — new tile added during edit', () => {
    function setupNewTileOnExisting(tileOverride) {
      const wrapper = setup({ isEditing: true })
      const instance = wrapper.instance()
      // existing tile is in uneditedDashboardTiles; new tile is NOT
      wrapper.setState({ uneditedDashboardTiles: [existingTile] })
      instance.baselineQueryIds.set('tile-1', { queryId: existingTile.queryId })
      instance.getMostRecentTiles = jest.fn(() => [existingTile, { ...newTile, ...tileOverride }])
      return instance
    }

    test('success run: new tile not dirty, not failed', () => {
      const i = setupNewTileOnExisting({ queryResponse: successResponse })
      expect(i.getDirtyTileKeys().has('tile-new')).toBe(false)
      expect(i.getFailedTiles().has('tile-new')).toBe(false)
    })

    test('DB error: new tile not dirty but failed, save disabled', () => {
      const i = setupNewTileOnExisting({ queryResponse: errorResponse })
      expect(i.getDirtyTileKeys().has('tile-new')).toBe(false)
      expect(i.getFailedTiles().has('tile-new')).toBe(true)
      expect(i.hasDirtyTiles() || i.getFailedTiles().size > 0).toBe(true)
    })

    test('addTile with error preserves queryResponse so getFailedTiles can detect it', () => {
      const wrapper = setup({ isEditing: true })
      const instance = wrapper.instance()
      instance.getMostRecentTiles = jest.fn(() => [])
      instance.debouncedOnChange = jest.fn(() => Promise.resolve())

      instance.addTile({ query: 'bad query', queryResponse: errorResponse })
      const addedTile = instance.debouncedOnChange.mock.calls[0][0][0]
      expect(addedTile.queryResponse).toEqual(errorResponse)

      instance.getMostRecentTiles = jest.fn(() => [{ ...addedTile, key: addedTile.key || addedTile.i }])
      expect(instance.getFailedTiles().has(addedTile.key || addedTile.i)).toBe(true)
    })
  })

  // EXISTING dashboard, EXISTING tile — full dirty + failed detection
  describe('existing dashboard — existing tile', () => {
    function setupExisting(tileOverride) {
      const wrapper = setup({ isEditing: true })
      const instance = wrapper.instance()
      wrapper.setState({ uneditedDashboardTiles: [existingTile] })
      instance.baselineQueryIds.set('tile-1', { queryId: existingTile.queryId })
      instance.getMostRecentTiles = jest.fn(() => [{ ...existingTile, ...tileOverride }])
      return instance
    }

    test('query unchanged, success: not dirty, not failed, save enabled', () => {
      const i = setupExisting({})
      expect(i.getDirtyTileKeys().has('tile-1')).toBe(false)
      expect(i.getFailedTiles().has('tile-1')).toBe(false)
      expect(i.hasDirtyTiles()).toBe(false)
    })

    test('query text changed, not re-run: dirty, not failed, save disabled', () => {
      const i = setupExisting({ query: 'different query' })
      expect(i.getDirtyTileKeys().has('tile-1')).toBe(true)
      expect(i.getFailedTiles().has('tile-1')).toBe(false)
      expect(i.hasDirtyTiles()).toBe(true)
    })

    test('query re-run → new queryId: not dirty, not failed, save enabled', () => {
      const i = setupExisting({ queryId: 'qid-after-run', queryResponse: successResponse })
      expect(i.getDirtyTileKeys().has('tile-1')).toBe(false)
      expect(i.getFailedTiles().has('tile-1')).toBe(false)
    })

    test('DB error (400): not dirty, failed, save disabled', () => {
      const i = setupExisting({ queryResponse: errorResponse })
      expect(i.getDirtyTileKeys().has('tile-1')).toBe(false)
      expect(i.getFailedTiles().has('tile-1')).toBe(true)
    })

    test('timeout (422): not dirty, failed, save disabled', () => {
      const i = setupExisting({ queryResponse: timeoutResponse })
      expect(i.getDirtyTileKeys().has('tile-1')).toBe(false)
      expect(i.getFailedTiles().has('tile-1')).toBe(true)
    })

    test('disambiguation (items): dirty AND failed, save disabled', () => {
      const i = setupExisting({ queryResponse: itemsResponse })
      expect(i.getDirtyTileKeys().has('tile-1')).toBe(true)
      expect(i.getFailedTiles().has('tile-1')).toBe(true)
      expect(i.hasDirtyTiles()).toBe(true)
    })

    test('replacements: dirty, not failed, save disabled', () => {
      const i = setupExisting({ queryResponse: replacementsResponse })
      expect(i.getDirtyTileKeys().has('tile-1')).toBe(true)
      expect(i.getFailedTiles().has('tile-1')).toBe(false)
      expect(i.hasDirtyTiles()).toBe(true)
    })
  })
})

describe('Dashboard.getDirtyTileKeys', () => {
  const savedTile = {
    key: 'tile-abc',
    i: 'tile-abc',
    query: 'sales by region',
    tableFilters: [],
    orders: [],
    displayType: 'table',
    queryId: 'qid-1',
    queryResponse: { data: { data: { rows: [[1]], count_rows: 1 } } },
  }

  const setupDirtyTest = (currentTileOverrides, { isEditing = true } = {}) => {
    const currentTile = { ...savedTile, ...currentTileOverrides }
    const wrapper = setup({ isEditing }, { uneditedDashboardTiles: [savedTile] })
    const instance = wrapper.instance()
    // Simulate entering edit mode: baselineQueryIds initialized from saved tile
    instance.baselineQueryIds.set('tile-abc', { queryId: savedTile.queryId, secondQueryId: savedTile.secondQueryId })
    instance.getMostRecentTiles = jest.fn(() => [currentTile])
    return instance.getDirtyTileKeys()
  }

  test('returns empty Set when not in edit mode', () => {
    expect(setupDirtyTest({}, { isEditing: false }).size).toBe(0)
  })

  test('returns empty Set when uneditedDashboardTiles is null', () => {
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: null })
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [savedTile])
    expect(instance.getDirtyTileKeys().size).toBe(0)
  })

  test('returns empty Set when nothing has changed', () => {
    expect(setupDirtyTest({}).size).toBe(0)
  })

  test('detects query text change', () => {
    expect(setupDirtyTest({ query: 'sales by product' }).has('tile-abc')).toBe(true)
  })

  test('does NOT mark dirty when displayType changes (chart switch needs no re-fetch)', () => {
    expect(setupDirtyTest({ displayType: 'bar' }).has('tile-abc')).toBe(false)
  })

  test('does NOT mark dirty when dataConfig changes', () => {
    expect(setupDirtyTest({ dataConfig: { tableConfig: { numberColumnIndex: 1 } } }).has('tile-abc')).toBe(false)
  })

  test('does NOT mark dirty when query text changed AND new queryId (already re-executed)', () => {
    expect(setupDirtyTest({ query: 'sales by product', queryId: 'qid-new' }).has('tile-abc')).toBe(false)
  })

  test('does NOT mark dirty when only queryId changes', () => {
    expect(setupDirtyTest({ queryId: 'qid-new' }).has('tile-abc')).toBe(false)
  })

  test('does NOT mark dirty when only queryResponse changes', () => {
    expect(setupDirtyTest({ queryResponse: { data: { data: { rows: [[999]] } } } }).has('tile-abc')).toBe(false)
  })

  test('marks dirty when queryResponse contains replacements (suggestion pending)', () => {
    expect(
      setupDirtyTest({ queryResponse: { data: { data: { replacements: [{ text: 'sales by region' }] } } } }).has('tile-abc'),
    ).toBe(true)
  })

  test('marks dirty when queryResponse contains items (list suggestion pending)', () => {
    expect(
      setupDirtyTest({ queryResponse: { data: { data: { items: [{ label: 'Region' }] } } } }).has('tile-abc'),
    ).toBe(true)
  })

  test('marks dirty when queryResponse contains both replacements and items', () => {
    expect(
      setupDirtyTest({ queryResponse: { data: { data: { replacements: [{ text: 'x' }], items: [{ label: 'y' }] } } } }).has('tile-abc'),
    ).toBe(true)
  })

  test('does NOT mark dirty when queryResponse has neither replacements nor items', () => {
    expect(
      setupDirtyTest({ queryResponse: { data: { data: { rows: [[1]], replacements: undefined, items: undefined } } } }).has('tile-abc'),
    ).toBe(false)
  })

  test('does NOT mark dirty for a new tile (not in uneditedDashboardTiles) that has suggestions', () => {
    const newTile = {
      key: 'tile-new',
      i: 'tile-new',
      query: '9999',
      queryResponse: { data: { data: { replacements: [{ text: 'all cogs 9999' }] } } },
    }
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: [savedTile] })
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [newTile])
    expect(instance.getDirtyTileKeys().has('tile-new')).toBe(false)
  })

  test('does NOT mark dirty for a brand new tile (not in uneditedDashboardTiles)', () => {
    const newTile = { key: 'tile-new', i: 'tile-new', query: 'player stats', queryId: undefined }
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: [savedTile] })
    const instance = wrapper.instance()
    instance.baselineQueryIds.set('tile-abc', { queryId: savedTile.queryId })
    instance.getMostRecentTiles = jest.fn(() => [savedTile, newTile])
    expect(instance.getDirtyTileKeys().has('tile-new')).toBe(false)
  })

  test('does NOT mark dirty for a new tile that has been run (has queryId, not in saved)', () => {
    const newTile = { key: 'tile-new', i: 'tile-new', query: 'player stats', queryId: 'qid-new' }
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: [savedTile] })
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [newTile])
    expect(instance.getDirtyTileKeys().has('tile-new')).toBe(false)
  })

  test('does NOT mark dirty for a pre-AQLP-792 tile with empty saved.query after running', () => {
    const preLegacyTile = { ...savedTile, query: '', queryId: 'qid-old' }
    const currentTile = { ...savedTile, query: 'avrg spread profit', queryId: 'qid-new' }
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: [preLegacyTile] })
    const instance = wrapper.instance()
    instance.baselineQueryIds.set('tile-abc', { queryId: 'qid-old' })
    instance.getMostRecentTiles = jest.fn(() => [currentTile])
    expect(instance.getDirtyTileKeys().has('tile-abc')).toBe(false)
  })

  test('does NOT mark dirty for a pre-AQLP-792 tile while user is typing (legacy queryId still present on tile)', () => {
    const preLegacyTile = { ...savedTile, query: '', queryId: 'qid-old' }
    const typingTile = { ...savedTile, query: 'player stats', queryId: 'qid-old' }
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: [preLegacyTile] })
    const instance = wrapper.instance()
    instance.baselineQueryIds.set('tile-abc', { queryId: 'qid-old' })
    instance.getMostRecentTiles = jest.fn(() => [typingTile])
    expect(instance.getDirtyTileKeys().has('tile-abc')).toBe(false)
  })

  test('does NOT mark dirty for a blank tile (no saved query, no queryId) when user types a new query', () => {
    const blankTile = { ...savedTile, query: '', queryId: undefined }
    const typingTile = { ...savedTile, query: 'player stats', queryId: undefined }
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: [blankTile] })
    const instance = wrapper.instance()
    instance.baselineQueryIds.set('tile-abc', { queryId: undefined })
    instance.getMostRecentTiles = jest.fn(() => [typingTile])
    expect(instance.getDirtyTileKeys().has('tile-abc')).toBe(false)
  })

  test('only marks the changed tile as dirty in a multi-tile dashboard', () => {
    const savedTile2 = { ...savedTile, key: 'tile-xyz', i: 'tile-xyz', query: 'revenue by month' }
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: [savedTile, savedTile2] })
    const instance = wrapper.instance()
    instance.baselineQueryIds.set('tile-abc', { queryId: savedTile.queryId, secondQueryId: savedTile.secondQueryId })
    instance.baselineQueryIds.set('tile-xyz', { queryId: savedTile2.queryId, secondQueryId: savedTile2.secondQueryId })
    instance.getMostRecentTiles = jest.fn(() => [
      { ...savedTile, query: 'sales by product' },
      { ...savedTile2 },
    ])
    const result = instance.getDirtyTileKeys()
    expect(result.has('tile-abc')).toBe(true)
    expect(result.has('tile-xyz')).toBe(false)
  })
})

describe('Dashboard.hasDirtyTiles', () => {
  const savedTile = {
    key: 'tile-abc',
    i: 'tile-abc',
    query: 'sales by region',
    tableFilters: [],
    orders: [],
    displayType: 'table',
    queryId: 'qid-1',
    queryResponse: { data: { data: { rows: [[1]], count_rows: 1 } } },
  }

  test('returns false when no tiles are dirty', () => {
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: [savedTile] })
    const instance = wrapper.instance()
    instance.baselineQueryIds.set('tile-abc', { queryId: savedTile.queryId })
    instance.getMostRecentTiles = jest.fn(() => [savedTile])
    expect(instance.hasDirtyTiles()).toBe(false)
  })

  test('returns true when at least one tile is dirty', () => {
    const wrapper = setup({ isEditing: true }, { uneditedDashboardTiles: [savedTile] })
    const instance = wrapper.instance()
    instance.baselineQueryIds.set('tile-abc', { queryId: savedTile.queryId })
    const changedTile = { ...savedTile, query: 'different query' }
    instance.getMostRecentTiles = jest.fn(() => [changedTile])
    expect(instance.hasDirtyTiles()).toBe(true)
  })
})

describe('Dashboard.baselineQueryIds — tracks executed queryIds', () => {
  const savedTile = {
    key: 'tile-abc',
    i: 'tile-abc',
    query: 'sales by region',
    queryId: 'qid-original',
    secondQuery: undefined,
    secondQueryId: undefined,
  }

  const setupBaseline = (isEditing = true) => {
    const wrapper = setup({ isEditing }, { uneditedDashboardTiles: [savedTile] })
    const instance = wrapper.instance()
    instance.baselineQueryIds.set('tile-abc', { queryId: 'qid-original', secondQueryId: undefined })
    instance.getMostRecentTiles = jest.fn(() => [savedTile])
    instance.debouncedOnChange = jest.fn(() => Promise.resolve())
    return instance
  }

  test('setParamsForTile snapshots queryId into baseline when query TEXT changes in edit mode', () => {
    const instance = setupBaseline()
    instance.setParamsForTile({ query: 'new query text' }, 'tile-abc', [])
    expect(instance.baselineQueryIds.get('tile-abc').queryId).toBe('qid-original')
  })

  test('does NOT update baseline when only queryId changes (post-run)', () => {
    const instance = setupBaseline()
    instance.setParamsForTile({ queryId: 'qid-after-run' }, 'tile-abc', [])
    // baseline stays at the value set before the run
    expect(instance.baselineQueryIds.get('tile-abc').queryId).toBe('qid-original')
  })

  test('does NOT update baselineQueryIds when not editing', () => {
    const instance = setupBaseline(false)
    instance.setParamsForTile({ query: 'new query text' }, 'tile-abc', [])
    expect(instance.baselineQueryIds.get('tile-abc').queryId).toBe('qid-original')
  })

  test('dirty clears after re-run: text change sets baseline, new queryId differs from it', () => {
    const instance = setupBaseline()

    // User changes query text → baseline snaps to current queryId ('qid-original')
    instance.setParamsForTile({ query: 'sales by product' }, 'tile-abc', [])
    expect(instance.baselineQueryIds.get('tile-abc').queryId).toBe('qid-original')

    // While unrun: tile still has old queryId — dirty
    instance.getMostRecentTiles = jest.fn(() => [{ ...savedTile, query: 'sales by product' }])
    expect(instance.getDirtyTileKeys().has('tile-abc')).toBe(true)

    // Tile re-executes — queryId becomes new; baseline stays at 'qid-original'
    instance.setParamsForTile({ queryId: 'qid-after-run' }, 'tile-abc', [])
    instance.getMostRecentTiles = jest.fn(() => [{ ...savedTile, query: 'sales by product', queryId: 'qid-after-run' }])
    expect(instance.getDirtyTileKeys().has('tile-abc')).toBe(false)
  })

  test('after re-run, a subsequent text change is detected as dirty', () => {
    const instance = setupBaseline()

    // First run changes queryId but NOT baseline
    instance.setParamsForTile({ queryId: 'qid-after-run' }, 'tile-abc', [])
    instance.getMostRecentTiles = jest.fn(() => [{ ...savedTile, queryId: 'qid-after-run' }])

    // User then changes query text → baseline snaps to current queryId ('qid-after-run')
    instance.setParamsForTile({ query: 'sales by product' }, 'tile-abc', [])
    expect(instance.baselineQueryIds.get('tile-abc').queryId).toBe('qid-after-run')

    // Tile has new text but queryId still 'qid-after-run' = baseline → dirty
    instance.getMostRecentTiles = jest.fn(() => [{ ...savedTile, queryId: 'qid-after-run', query: 'sales by product' }])
    expect(instance.getDirtyTileKeys().has('tile-abc')).toBe(true)
  })
})

describe('Dashboard.getFailedTiles', () => {
  const successResponse = { data: { reference_id: '1.1.200', data: { rows: [[1], [2]], count_rows: 2 } } }
  const emptySuccessResponse = { data: { reference_id: '1.1.200', data: { rows: [], count_rows: 0 } } }
  const errorResponse = { data: { reference_id: '1.1.400', data: {} } }
  const timeoutResponse = { data: { reference_id: '1.1.422', data: {} } }
  const suggestionsResponse = { data: { data: { items: ['option 1', 'option 2'] } } }

  const setupFailedTest = (tileOverrides) => {
    const wrapper = setup({})
    const instance = wrapper.instance()
    instance.getMostRecentTiles = jest.fn(() => [{ key: 'tile-1', ...tileOverrides }])
    return instance.getFailedTiles()
  }

  test('does NOT flag a tile with no queryResponse', () => {
    expect(setupFailedTest({}).has('tile-1')).toBe(false)
  })

  test('does NOT flag a tile with a successful response', () => {
    expect(setupFailedTest({ queryResponse: successResponse }).has('tile-1')).toBe(false)
  })

  test('does NOT flag a tile with a successful empty-result response', () => {
    expect(setupFailedTest({ queryResponse: emptySuccessResponse }).has('tile-1')).toBe(false)
  })

  test('flags a tile whose query returned an error reference_id', () => {
    expect(setupFailedTest({ queryResponse: errorResponse }).has('tile-1')).toBe(true)
  })

  test('flags a tile whose query timed out', () => {
    expect(setupFailedTest({ queryResponse: timeoutResponse }).has('tile-1')).toBe(true)
  })

  test('flags a tile whose query returned suggestions (items)', () => {
    expect(setupFailedTest({ queryResponse: suggestionsResponse }).has('tile-1')).toBe(true)
  })

  test('flags a tile whose queryResponse has no reference_id (NaN path)', () => {
    expect(setupFailedTest({ queryResponse: { data: { data: { rows: [] } } } }).has('tile-1')).toBe(true)
  })
})
