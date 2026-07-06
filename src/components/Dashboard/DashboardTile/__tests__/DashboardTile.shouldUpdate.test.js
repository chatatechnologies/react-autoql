import React from 'react'
import { mount } from 'enzyme'
import { DashboardTile } from '../DashboardTile'

// Minimal tile factory
const makeTile = (overrides = {}) => ({
  i: 'tile-1',
  query: 'SELECT 1',
  title: 'Tile 1',
  columns: [],
  tableFilters: [],
  orders: [],
  filters: [],
  ...overrides,
})

describe('DashboardTile update behavior', () => {
  it('updates state when queryResponse arrives while isDragging stays true', () => {
    const tile = makeTile({ queryResponse: null })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} isDragging={true} />)
    const instance = wrapper.instance()

    const before = instance.state.queryResponseVersion

    // Simulate an async query result arriving while still dragging
    wrapper.setProps({ tile: { ...tile, queryResponse: { data: { data: { query_id: 'q1' } } } }, isDragging: true })
    wrapper.update()

    expect(instance.state.queryResponseVersion).toBeGreaterThan(before)

    wrapper.unmount()
  })
})

describe('DashboardTile shouldComponentUpdate', () => {
  it('returns false when props have not changed', () => {
    const tile = makeTile()
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    const result = instance.shouldComponentUpdate(wrapper.props(), instance.state)
    expect(result).toBe(false)

    wrapper.unmount()
  })

  it('returns true when tile.query changes while isDragging is true on both sides', () => {
    // Previously shouldComponentUpdate returned false unconditionally when both sides had isDragging=true.
    // After the fix, it must allow re-renders when tile data actually changed.
    const tile = makeTile({ queryResponse: null })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} isDragging={true} />)
    const instance = wrapper.instance()

    const nextTile = { ...tile, query: 'SELECT 2' }
    const result = instance.shouldComponentUpdate(
      { ...wrapper.props(), tile: nextTile, isDragging: true },
      instance.state,
    )
    expect(result).toBe(true)

    wrapper.unmount()
  })

  it('returns true when tile.queryResponse arrives while isDragging is true', () => {
    const tile = makeTile({ queryResponse: null })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} isDragging={true} />)
    const instance = wrapper.instance()

    const nextTile = { ...tile, queryResponse: { data: { data: { query_id: 'q1' } } } }
    const result = instance.shouldComponentUpdate(
      { ...wrapper.props(), tile: nextTile, isDragging: true },
      instance.state,
    )
    expect(result).toBe(true)

    wrapper.unmount()
  })
})

describe('DashboardTile componentDidUpdate queryResponseVersion', () => {
  it('bumps queryResponseVersion when prevQR is null and nextQR arrives (post-reset scenario)', () => {
    // queryResponse: null means the tile was explicitly cleared by resetTile.
    // When the reset query completes, prevQR===null → nextQR!==null, which must trigger a re-render.
    const tile = makeTile({ queryResponse: null })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    const before = instance.state.queryResponseVersion

    wrapper.setProps({ tile: { ...tile, queryResponse: { data: { data: { query_id: 'q1' } } } } })
    wrapper.update()

    expect(instance.state.queryResponseVersion).toBeGreaterThan(before)

    wrapper.unmount()
  })

  it('does NOT bump queryResponseVersion when prevQR is undefined (initial mount — no reset)', () => {
    // When the tile has never had a queryResponse (undefined, not null), the first response
    // arriving is an initial load, not a reset completion — skip the version bump.
    const tile = makeTile({ queryResponse: undefined })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    const before = instance.state.queryResponseVersion

    wrapper.setProps({ tile: { ...tile, queryResponse: { data: { data: { query_id: 'q1' } } } } })
    wrapper.update()

    expect(instance.state.queryResponseVersion).toBe(before)

    wrapper.unmount()
  })

  it('bumps queryResponseVersion when query_id changes (new query result)', () => {
    const qr1 = { data: { data: { query_id: 'q1' } } }
    const tile = makeTile({ queryResponse: qr1 })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    const before = instance.state.queryResponseVersion

    const qr2 = { data: { data: { query_id: 'q2' } } }
    wrapper.setProps({ tile: { ...tile, queryResponse: qr2 } })
    wrapper.update()

    expect(instance.state.queryResponseVersion).toBeGreaterThan(before)

    wrapper.unmount()
  })
})

describe('DashboardTile componentDidUpdate topRequestData sync', () => {
  it('updates topRequestData when tile.tableFilters change', () => {
    const oldFilters = [{ col: 'a', value: '1' }]
    const newFilters = [{ col: 'a', value: '2' }]
    const newTile = makeTile({ tableFilters: newFilters })
    const wrapper = mount(<DashboardTile tile={newTile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    instance.topRequestData = { query: 'SELECT 1', tableFilters: oldFilters, filters: [], orders: [] }

    // Call componentDidUpdate directly with prevProps that had the old filters
    instance.componentDidUpdate({ ...wrapper.props(), tile: { ...newTile, tableFilters: oldFilters } }, instance.state)

    expect(instance.topRequestData.tableFilters).toEqual(newFilters)

    wrapper.unmount()
  })

  it('does NOT modify topRequestData when it is unset (query has not run yet)', () => {
    const oldFilters = [{ col: 'a', value: '1' }]
    const newFilters = [{ col: 'a', value: '2' }]
    const newTile = makeTile({ tableFilters: newFilters })
    const wrapper = mount(<DashboardTile tile={newTile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    instance.topRequestData = null

    instance.componentDidUpdate({ ...wrapper.props(), tile: { ...newTile, tableFilters: oldFilters } }, instance.state)

    expect(instance.topRequestData).toBeNull()

    wrapper.unmount()
  })

})
