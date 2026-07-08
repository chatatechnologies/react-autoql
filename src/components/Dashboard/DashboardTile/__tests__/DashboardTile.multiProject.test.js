import React from 'react'
import { mount } from 'enzyme'
import { DashboardTile } from '../DashboardTile'

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

describe('DashboardTile getTileProject', () => {
  it('reads flat project_id/project_name off the response', () => {
    const tile = makeTile()
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    const response = { data: { data: { project_id: '123', project_name: 'Proj A' } } }
    expect(instance.getTileProject(response)).toEqual({ id: '123', name: 'Proj A' })

    wrapper.unmount()
  })

  it('returns null when neither project_id nor project_name is present', () => {
    const tile = makeTile()
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    expect(instance.getTileProject({ data: { data: { query_id: 'q1' } } })).toBeNull()
    expect(instance.getTileProject(undefined)).toBeNull()

    wrapper.unmount()
  })
})

describe('DashboardTile renderProjectBadge', () => {
  it('renders a badge with the project name when queryResponse has a project_name', () => {
    const tile = makeTile({
      queryResponse: { data: { data: { project_id: '1', project_name: 'MyProject' } } },
    })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} tooltipID='tt-1' />)
    const instance = wrapper.instance()

    const badge = instance.renderProjectBadge()
    expect(badge.props.children).toBe('MyProject')
    expect(badge.props['data-tooltip-content']).toBe('Project: MyProject')
    expect(badge.props['data-tooltip-id']).toBe('tt-1')

    wrapper.unmount()
  })

  it('returns null when there is no queryResponse project data', () => {
    const tile = makeTile({ queryResponse: null })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    expect(instance.renderProjectBadge()).toBeNull()

    wrapper.unmount()
  })
})

describe('DashboardTile componentDidUpdate projectId re-run', () => {
  it('calls processTile when tile.projectId changes and the query is valid', () => {
    const tile = makeTile({ projectId: '1' })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()
    const processTileSpy = jest.spyOn(instance, 'processTile').mockImplementation(() => Promise.resolve())

    wrapper.setProps({ tile: { ...tile, projectId: '2' } })

    expect(processTileSpy).toHaveBeenCalledWith({ query: tile.query })

    processTileSpy.mockRestore()
    wrapper.unmount()
  })

  it('does not call processTile when projectId is unchanged', () => {
    const tile = makeTile({ projectId: '1' })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()
    const processTileSpy = jest.spyOn(instance, 'processTile').mockImplementation(() => Promise.resolve())

    wrapper.setProps({ tile: { ...tile, title: 'changed title' } })

    expect(processTileSpy).not.toHaveBeenCalled()

    processTileSpy.mockRestore()
    wrapper.unmount()
  })

  it('does not call processTile when projectId changes but the query is blank', () => {
    const tile = makeTile({ projectId: '1', query: '   ' })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()
    const processTileSpy = jest.spyOn(instance, 'processTile').mockImplementation(() => Promise.resolve())

    wrapper.setProps({ tile: { ...tile, projectId: '2' } })

    expect(processTileSpy).not.toHaveBeenCalled()

    processTileSpy.mockRestore()
    wrapper.unmount()
  })
})

describe('DashboardTile componentDidUpdate topRequestData sync', () => {
  it('updates topRequestData.projectId when tile.projectId changes', () => {
    const tile = makeTile({ projectId: '2' })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()
    jest.spyOn(instance, 'processTile').mockImplementation(() => Promise.resolve())

    instance.topRequestData = { query: tile.query, tableFilters: [], filters: [], orders: [], projectId: '1' }

    instance.componentDidUpdate({ ...wrapper.props(), tile: { ...tile, projectId: '1' } }, instance.state)

    expect(instance.topRequestData.projectId).toBe('2')

    instance.processTile.mockRestore()
    wrapper.unmount()
  })

  it('does not modify topRequestData when it is unset (query has not run yet)', () => {
    const tile = makeTile({ projectId: '2' })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()
    jest.spyOn(instance, 'processTile').mockImplementation(() => Promise.resolve())

    instance.topRequestData = null

    instance.componentDidUpdate({ ...wrapper.props(), tile: { ...tile, projectId: '1' } }, instance.state)

    expect(instance.topRequestData).toBeNull()

    instance.processTile.mockRestore()
    wrapper.unmount()
  })
})

describe('DashboardTile restoreSavedTileConfig', () => {
  it('schedules setParamsForTile with filtered config (debounced)', () => {
    jest.useFakeTimers()
    const setParams = jest.fn()
    const tile = makeTile()
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={setParams} />)
    const instance = wrapper.instance()

    setParams.mockClear()

    instance._isMounted = true
    instance.savedTileConfig = {
      displayType: 'table',
      columns: ['a', 'b'],
      tableFilters: [],
      dataConfig: { tableConfig: {} },
    }

    instance.restoreSavedTileConfig()

    jest.runOnlyPendingTimers()

    expect(setParams).toHaveBeenCalled()
    const callArgs = setParams.mock.calls[0]
    expect(callArgs[0]).toMatchObject({ columns: ['a', 'b'] })

    jest.useRealTimers()
    wrapper.unmount()
  })
})

describe('DashboardTile executeQueryWithForceRetry', () => {
  it('retries once on a .502 server error and calls onRetry', async () => {
    const tile = makeTile()
    const onRetry = jest.fn()
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} onRetry={onRetry} />)
    const instance = wrapper.instance()

    const failingThenSucceeding = jest
      .fn()
      .mockRejectedValueOnce({ response: { data: { reference_id: '29.9.502' } } })
      .mockResolvedValueOnce({ data: { data: { query_id: 'qid-1' } } })

    const result = await instance.executeQueryWithForceRetry({}, failingThenSucceeding)

    expect(failingThenSucceeding).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalled()
    expect(result).toBeDefined()

    wrapper.unmount()
  })
})
