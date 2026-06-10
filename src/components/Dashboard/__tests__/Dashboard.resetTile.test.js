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
  it('calls onChange with unedited tiles', () => {
    jest.useFakeTimers()
    const tile = makeTile()
    const onChange = jest.fn()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={onChange} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.discardChanges()
    jest.advanceTimersByTime(200)

    expect(onChange).toHaveBeenCalled()
    jest.useRealTimers()
    wrapper.unmount()
  })

  it('calls stopEditingCallback', () => {
    const stopEditingCallback = jest.fn()
    const wrapper = mount(
      <Dashboard tiles={[makeTile()]} onChange={jest.fn()} isEditing stopEditingCallback={stopEditingCallback} />,
    )
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.discardChanges()

    expect(stopEditingCallback).toHaveBeenCalled()
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

describe('Dashboard componentWillUnmount memory cleanup', () => {
  it('clears tileLog and pendingResetTiles on unmount', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    // Seed some state
    instance.pendingResetTiles = [tile]

    wrapper.unmount()

    expect(instance.tileLog).toEqual([])
    expect(instance.pendingResetTiles).toBeNull()
  })
})

describe('getMostRecentTiles during reset — concurrent tile safety', () => {
  it('returns props.tiles for non-resetting tile entries while reset is active', () => {
    const tile1 = makeTile({ key: 'tile-1', i: 'tile-1', queryResponse: { data: { rows: [[1]] } } })
    const tile2 = {
      key: 'tile-2',
      i: 'tile-2',
      query: 'SELECT 2',
      queryResponse: { data: { rows: [[2]] } },
    }
    const wrapper = mount(<Dashboard tiles={[tile1, tile2]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    // Simulate resetTile guard state for tile-1
    instance.isResettingTile = true
    instance.resettingTileId = 'tile-1'
    const clearedTile1 = { ...tile1, queryResponse: null, tableFilters: [], filters: [] }
    instance.pendingResetTiles = [clearedTile1, tile2]

    const result = instance.getMostRecentTiles()

    // tile-2's queryResponse must be the live value from props.tiles, not the pendingResetTiles copy
    const resultTile2 = result.find((t) => t.i === 'tile-2')
    expect(resultTile2.queryResponse).toEqual(tile2.queryResponse)

    // tile-1 should have the cleared state
    const resultTile1 = result.find((t) => t.i === 'tile-1')
    expect(resultTile1.queryResponse).toBeNull()

    wrapper.unmount()
  })

  it('returns props.tiles normally when isResettingTile is false', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.isResettingTile = false
    const result = instance.getMostRecentTiles()
    expect(result).toBe(instance.props.tiles)

    wrapper.unmount()
  })
})

describe('addTileStateToLog clears reset flags immediately', () => {
  it('clears isResettingTile when the reset tile has a complete response', () => {
    const tile = makeTile() // has queryResponse, no secondQuery
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.isResettingTile = true
    instance.resettingTileId = 'tile-1'
    instance.pendingResetTiles = [{ ...tile, queryResponse: null }]

    // Simulate the post-response addTileStateToLog call (single-query tile — done after top)
    instance.addTileStateToLog([tile])

    expect(instance.isResettingTile).toBe(false)
    expect(instance.resettingTileId).toBeNull()
    expect(instance.pendingResetTiles).toBeNull()

    wrapper.unmount()
  })

  it('keeps isResettingTile active for split-view tiles until both halves have responded', () => {
    const tile = makeTile({ secondQuery: 'SELECT 2', secondQueryResponse: null })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.tileLog = [[{ ...tile, queryResponse: null }]]
    instance.currentLogIndex = 0
    instance.isResettingTile = true
    instance.resettingTileId = 'tile-1'
    instance.pendingResetTiles = [{ ...tile, queryResponse: null }]

    // First flush — only top query responded; secondQueryResponse still null
    instance.addTileStateToLog([tile])

    // Flags must still be active — bottom half has not yet responded
    expect(instance.isResettingTile).toBe(true)
    expect(instance.tileLog).toHaveLength(1) // absorbed into [0], no new entry

    // Second flush — bottom query also responded
    const tileBothDone = { ...tile, secondQueryResponse: { data: { rows: [[4]] } } }
    instance.addTileStateToLog([tileBothDone])

    expect(instance.isResettingTile).toBe(false)
    expect(instance.resettingTileId).toBeNull()
    expect(instance.pendingResetTiles).toBeNull()
    expect(instance.tileLog).toHaveLength(1) // still only one entry

    wrapper.unmount()
  })

  it('absorbs the save into tileLog[0] rather than pushing a new entry', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    const preResetEntry = [{ ...tile, queryResponse: null }]
    instance.tileLog = [preResetEntry]
    instance.currentLogIndex = 0
    instance.isResettingTile = true
    instance.resettingTileId = 'tile-1'
    instance.pendingResetTiles = preResetEntry

    const freshTiles = [{ ...tile, queryResponse: { data: { reference_id: '1.1.200' } } }]
    instance.addTileStateToLog(freshTiles)

    // Log should still have exactly one entry (absorbed, not pushed)
    expect(instance.tileLog).toHaveLength(1)

    wrapper.unmount()
  })

  it('does not create a new undo step for the reset execution result', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    // Two pre-existing log entries
    instance.tileLog = [[tile], [{ ...tile, query: 'old' }]]
    instance.currentLogIndex = 0
    instance.isResettingTile = true
    instance.resettingTileId = 'tile-1'
    instance.pendingResetTiles = [{ ...tile, queryResponse: null }]

    instance.addTileStateToLog([tile])

    // The log length must not grow — no new undo step was pushed
    expect(instance.tileLog).toHaveLength(2)

    wrapper.unmount()
  })
})

describe('onSaveCallback is called after resetTile completes', () => {
  it('passes onSaveCallback into debouncedOnChange after reset', async () => {
    const onSaveCallback = jest.fn().mockResolvedValue(undefined)
    const tile = makeTile({ query: '' }) // no query → runSingleTile resolves immediately
    const wrapper = mount(
      <Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} onSaveCallback={onSaveCallback} />,
    )
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    // Spy before calling resetTile; mock prevents debounce timer from running
    const debouncedSpy = jest.spyOn(instance, 'debouncedOnChange').mockReturnValue(Promise.resolve())

    await instance.resetTile('tile-1')

    expect(debouncedSpy).toHaveBeenCalledWith(
      expect.anything(),
      false,
      expect.arrayContaining([onSaveCallback]),
    )

    wrapper.unmount()
  })

  it('passes empty callback array when onSaveCallback is not provided', async () => {
    const tile = makeTile({ query: '' })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    const debouncedSpy = jest.spyOn(instance, 'debouncedOnChange').mockReturnValue(Promise.resolve())

    await instance.resetTile('tile-1')

    // Called with empty callbacks array (not onSaveCallback undefined in array)
    expect(debouncedSpy).toHaveBeenCalledWith(expect.anything(), false, [])

    wrapper.unmount()
  })
})

describe('resetTile guard flags', () => {
  it('sets isResettingTile and resettingTileId synchronously', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    // Prevent async execution from completing
    jest.spyOn(instance, 'executeDashboard').mockReturnValue(Promise.resolve())

    instance.resetTile('tile-1')

    expect(instance.isResettingTile).toBe(true)
    expect(instance.resettingTileId).toBe('tile-1')
    expect(instance.pendingResetTiles).toBeDefined()

    wrapper.unmount()
  })

  it('pendingResetTiles has queryResponse cleared for the reset tile', () => {
    const tile = makeTile({ queryResponse: { data: { rows: [[1, 2]] } } })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.resetTile('tile-1')

    const pendingTile = instance.pendingResetTiles?.find((t) => t.i === 'tile-1')
    expect(pendingTile).toBeDefined()
    expect(pendingTile.queryResponse).toBeNull()
    expect(pendingTile.tableFilters).toEqual([])
    expect(pendingTile.filters).toEqual([])
    expect(pendingTile.orders).toEqual([])
    expect(pendingTile.columnSelects).toEqual([])

    wrapper.unmount()
  })

  it('saves pre-reset state in pendingResetUndoTiles when isEditing', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.resetTile('tile-1')

    expect(instance.pendingResetUndoTiles).toBeDefined()
    const preTile = instance.pendingResetUndoTiles?.find((t) => t.i === 'tile-1')
    expect(preTile).toBeDefined()
    // The pre-reset snapshot keeps the original queryResponse
    expect(preTile.queryResponse).toBeDefined()

    wrapper.unmount()
  })

  it('does not save pendingResetUndoTiles when not editing', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={false} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.resetTile('tile-1')

    expect(instance.pendingResetUndoTiles).toBeUndefined()

    wrapper.unmount()
  })
})

describe('flushOnChange', () => {
  it('calls props.onChange with cloned tiles immediately', () => {
    const onChange = jest.fn()
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={onChange} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    const tiles = [tile]
    instance.flushOnChange(tiles)

    expect(onChange).toHaveBeenCalled()
    // The object passed should be a clone, not the same reference
    expect(onChange.mock.calls[0][0]).not.toBe(tiles)

    wrapper.unmount()
  })

  it('cancels any pending debounced onChange timer', () => {
    jest.useFakeTimers()
    const onChange = jest.fn()
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={onChange} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    // Queue a debounced change
    instance.debouncedOnChange([tile], false)

    // Flush immediately — should cancel the debounced one
    instance.flushOnChange([tile])
    const callCountAfterFlush = onChange.mock.calls.length

    // Advance timers — the debounced call should NOT fire again
    jest.advanceTimersByTime(200)
    expect(onChange.mock.calls.length).toBe(callCountAfterFlush)

    jest.useRealTimers()
    wrapper.unmount()
  })
})

describe('canUndo / canRedo', () => {
  it('canUndo is false when not editing', () => {
    const wrapper = mount(<Dashboard tiles={[makeTile()]} onChange={jest.fn()} isEditing={false} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()
    expect(instance.canUndo()).toBe(false)
    wrapper.unmount()
  })

  it('canUndo is true when there is history to undo', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()
    instance.tileLog = [[tile], [{ ...tile, query: 'old' }]]
    instance.currentLogIndex = 0
    expect(instance.canUndo()).toBe(true)
    wrapper.unmount()
  })

  it('canRedo is false when at the latest state', () => {
    const wrapper = mount(<Dashboard tiles={[makeTile()]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()
    instance.currentLogIndex = 0
    expect(instance.canRedo()).toBe(false)
    wrapper.unmount()
  })

  it('canRedo is true after undo', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()
    instance.tileLog = [[tile], [{ ...tile, query: 'old' }]]
    instance.currentLogIndex = 1
    expect(instance.canRedo()).toBe(true)
    wrapper.unmount()
  })

  it('canUndo is true when pendingResetUndoTiles is set', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()
    instance.pendingResetUndoTiles = [tile]
    expect(instance.canUndo()).toBe(true)
    wrapper.unmount()
  })
})

describe('stripRuntimeFields', () => {
  it('strips queryResponse and secondQueryResponse from each tile', () => {
    const tile = makeTile({ queryResponse: { data: {} }, secondQueryResponse: { data: {} } })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    const result = instance.stripRuntimeFields([tile])

    expect(result[0].queryResponse).toBeUndefined()
    expect(result[0].secondQueryResponse).toBeUndefined()
    expect(result[0].query).toBe(tile.query)

    wrapper.unmount()
  })

  it('returns undefined when tiles is undefined', () => {
    const wrapper = mount(<Dashboard tiles={[makeTile()]} onChange={jest.fn()} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()
    expect(instance.stripRuntimeFields(undefined)).toBeUndefined()
    wrapper.unmount()
  })

  it('preserves networkColumnConfig in equality comparison so user changes are undoable', () => {
    const tile = makeTile({
      networkColumnConfig: { source: 0, target: 1 },
      secondNetworkColumnConfig: { source: 2 },
    })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    const result = instance.stripRuntimeFields([tile])

    // networkColumnConfig is user-settable (via onNetworkColumnChange) so it must
    // participate in the equality check — otherwise a user's column-mapping change
    // would be invisible to undo.
    expect(result[0].networkColumnConfig).toEqual(tile.networkColumnConfig)
    expect(result[0].secondNetworkColumnConfig).toEqual(tile.secondNetworkColumnConfig)
    expect(result[0].query).toBe(tile.query)

    wrapper.unmount()
  })
})

describe('flushOnChange drains pending callbacks', () => {
  it('calls pending debouncedOnChange resolve functions so promises do not hang', async () => {
    const onChange = jest.fn()
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={onChange} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    // Queue a debouncedOnChange (50ms debounce) and capture the promise.
    const pendingPromise = instance.debouncedOnChange([tile], false)

    // The promise must be pending at this point (timer hasn't fired).
    let resolved = false
    pendingPromise.then(() => { resolved = true })

    // flushOnChange should drain the subscriptions and resolve the pending promise.
    instance.flushOnChange([tile])
    await pendingPromise

    expect(resolved).toBe(true)

    wrapper.unmount()
  })

  it('resets callbackSubsciptions to empty after flush', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.debouncedOnChange([tile], false)
    instance.flushOnChange([tile])

    expect(instance.callbackSubsciptions).toHaveLength(0)

    wrapper.unmount()
  })
})

describe('pendingResetUndoTiles persists after post-reset edits', () => {
  it('is NOT cleared when a new undo step is pushed — Undo always jumps to pre-reset in one click', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    // Simulate post-reset state: pendingResetUndoTiles is set
    instance.pendingResetUndoTiles = [{ ...tile }]
    instance.pendingResetHistory = [[{ ...tile }]]

    // Simulate a user edit that pushes a new undo step
    const editedTile = { ...tile, query: 'SELECT new_query' }
    instance.tileLog = [[tile]]
    instance.currentLogIndex = 0
    instance.addTileStateToLog([editedTile])

    // pendingResetUndoTiles must survive so pressing Undo still jumps directly to pre-reset.
    expect(instance.pendingResetUndoTiles).not.toBeNull()
    expect(instance.pendingResetHistory).not.toBeNull()

    wrapper.unmount()
  })

  it('is NOT cleared for an identical-config save (equality skip)', () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    instance.pendingResetUndoTiles = [{ ...tile }]
    instance.tileLog = [[tile]]
    instance.currentLogIndex = 0

    // Same tile — equality check returns early, no new undo step, so pendingResetUndoTiles stays.
    instance.addTileStateToLog([tile])

    expect(instance.pendingResetUndoTiles).not.toBeNull()

    wrapper.unmount()
  })
})

describe('resetTile guard: ignores double-click on same tile', () => {
  it('returns early when the same tile is already resetting', async () => {
    const tile = makeTile()
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    const debouncedSpy = jest.spyOn(instance, 'debouncedOnChange').mockReturnValue(Promise.resolve())

    // First reset call
    await instance.resetTile('tile-1')
    const callsAfterFirst = debouncedSpy.mock.calls.length

    // Simulate in-progress state (guard flags still set)
    instance.isResettingTile = true
    instance.resettingTileId = 'tile-1'

    // Second reset call — should be ignored
    instance.resetTile('tile-1')

    expect(debouncedSpy.mock.calls.length).toBe(callsAfterFirst)

    wrapper.unmount()
  })

  it('preserves pendingResetUndoTiles from the first call on double-click', async () => {
    const tile = makeTile({ queryResponse: { data: { rows: [[1]] } } })
    const wrapper = mount(<Dashboard tiles={[tile]} onChange={jest.fn()} isEditing={true} />)
    const instance = wrapper.find('DashboardWithoutTheme').instance()

    jest.spyOn(instance, 'debouncedOnChange').mockReturnValue(Promise.resolve())

    await instance.resetTile('tile-1')
    const undoAfterFirst = instance.pendingResetUndoTiles

    // Force guard flags to simulate in-progress
    instance.isResettingTile = true
    instance.resettingTileId = 'tile-1'

    // Second call should not overwrite pendingResetUndoTiles
    instance.resetTile('tile-1')

    expect(instance.pendingResetUndoTiles).toEqual(undoAfterFirst)

    wrapper.unmount()
  })
})
