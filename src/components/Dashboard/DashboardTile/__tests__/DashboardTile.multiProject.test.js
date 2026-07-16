import React from 'react'
import { mount } from 'enzyme'
import { DashboardTile } from '../DashboardTile'
import { QueryOutput } from '../../../QueryOutput'
import { OptionsToolbar } from '../../../OptionsToolbar'
import sampleResponses from '../../../../../test/responseTestCases'

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

describe('DashboardTile getTileAutoQLConfig', () => {
  it('returns autoQLConfig unchanged when the tile has no projectId', () => {
    const tile = makeTile()
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} autoQLConfig={{ enableDrilldowns: true }} />,
    )
    const instance = wrapper.instance()

    expect(instance.getTileAutoQLConfig()).toMatchObject({ enableDrilldowns: true })
    expect(instance.getTileAutoQLConfig().projectId).toBeFalsy()

    wrapper.unmount()
  })

  it('overrides projectId with the tile-level projectId when set', () => {
    const tile = makeTile({ projectId: 'tile-project' })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        autoQLConfig={{ enableDrilldowns: true, projectId: 'dashboard-project' }}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.getTileAutoQLConfig()).toMatchObject({
      enableDrilldowns: true,
      projectId: 'tile-project',
    })

    wrapper.unmount()
  })

  it('passes the tile-scoped autoQLConfig (not the raw dashboard-wide one) to QueryOutput and OptionsToolbar', () => {
    const tile = makeTile({ projectId: 'tile-project', queryResponse: sampleResponses[2] })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} autoQLConfig={{ projectId: 'dashboard-project' }} />,
    )

    expect(wrapper.find(QueryOutput).prop('autoQLConfig').projectId).toBe('tile-project')
    expect(wrapper.find(OptionsToolbar).prop('autoQLConfig').projectId).toBe('tile-project')

    wrapper.unmount()
  })
})

describe('DashboardTile getTileAuthentication', () => {
  it('returns props.authentication when the tile has no projectId', () => {
    const tile = makeTile()
    const dashboardAuth = { token: 'dashboard-token' }
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        authentication={dashboardAuth}
        getAuthenticationForProject={() => ({ token: 'should-not-be-used' })}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.getTileAuthentication()).toBe(dashboardAuth)

    wrapper.unmount()
  })

  it('returns props.authentication when no getAuthenticationForProject resolver is provided', () => {
    const tile = makeTile({ projectId: 'tile-project' })
    const dashboardAuth = { token: 'dashboard-token' }
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} authentication={dashboardAuth} />)
    const instance = wrapper.instance()

    expect(instance.getTileAuthentication()).toBe(dashboardAuth)

    wrapper.unmount()
  })

  it('uses the resolved per-project authentication when the resolver returns one', () => {
    const tile = makeTile({ projectId: 'tile-project' })
    const dashboardAuth = { token: 'dashboard-token' }
    const tileAuth = { token: 'tile-project-token' }
    const getAuthenticationForProject = jest.fn((projectId) => (projectId === 'tile-project' ? tileAuth : undefined))
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        authentication={dashboardAuth}
        getAuthenticationForProject={getAuthenticationForProject}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.getTileAuthentication()).toBe(tileAuth)
    expect(getAuthenticationForProject).toHaveBeenCalledWith('tile-project')

    wrapper.unmount()
  })

  it('falls back to props.authentication when the resolver has no token cached yet', () => {
    const tile = makeTile({ projectId: 'tile-project' })
    const dashboardAuth = { token: 'dashboard-token' }
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        authentication={dashboardAuth}
        getAuthenticationForProject={() => undefined}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.getTileAuthentication()).toBe(dashboardAuth)

    wrapper.unmount()
  })

  it('passes the resolved authentication (not props.authentication) to QueryOutput and OptionsToolbar', () => {
    const tile = makeTile({ projectId: 'tile-project', queryResponse: sampleResponses[2] })
    const dashboardAuth = { token: 'dashboard-token' }
    const tileAuth = { token: 'tile-project-token' }
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        authentication={dashboardAuth}
        getAuthenticationForProject={() => tileAuth}
      />,
    )

    expect(wrapper.find(QueryOutput).prop('authentication')).toBe(tileAuth)
    expect(wrapper.find(OptionsToolbar).prop('authentication')).toBe(tileAuth)

    wrapper.unmount()
  })
})

describe('DashboardTile waitForTileAuthentication', () => {
  it('resolves ready when the tile has no projectId', async () => {
    const tile = makeTile()
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} getAuthenticationForProject={() => undefined} />,
    )
    const instance = wrapper.instance()

    await expect(instance.waitForTileAuthentication()).resolves.toBe(true)

    wrapper.unmount()
  })

  it('resolves ready when no getAuthenticationForProject resolver is provided', async () => {
    const tile = makeTile({ projectId: 'tile-project' })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    await expect(instance.waitForTileAuthentication()).resolves.toBe(true)

    wrapper.unmount()
  })

  it('resolves ready when the resolver already has a token for this project', async () => {
    const tile = makeTile({ projectId: 'tile-project' })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        getAuthenticationForProject={() => ({ token: 'ready' })}
      />,
    )
    const instance = wrapper.instance()

    await expect(instance.waitForTileAuthentication()).resolves.toBe(true)

    wrapper.unmount()
  })

  it('polls and resolves ready once the resolver starts returning a token', async () => {
    jest.useFakeTimers()
    const tile = makeTile({ projectId: 'tile-project' })
    let tokenReady = false
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        getAuthenticationForProject={() => (tokenReady ? { token: 'ready' } : undefined)}
      />,
    )
    const instance = wrapper.instance()

    let resolvedValue
    instance.waitForTileAuthentication().then((v) => {
      resolvedValue = v
    })

    expect(resolvedValue).toBeUndefined()

    tokenReady = true
    await jest.advanceTimersByTimeAsync(100)

    expect(resolvedValue).toBe(true)

    wrapper.unmount()
    jest.useRealTimers()
  })

  it('resolves NOT ready after the bounded wait if the token never arrives (so caller can avoid a 403)', async () => {
    jest.useFakeTimers()
    const tile = makeTile({ projectId: 'tile-project' })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} getAuthenticationForProject={() => undefined} />,
    )
    const instance = wrapper.instance()

    let resolvedValue
    instance.waitForTileAuthentication().then((v) => {
      resolvedValue = v
    })

    await jest.advanceTimersByTimeAsync(15000)

    expect(resolvedValue).toBe(false)

    wrapper.unmount()
    jest.useRealTimers()
  })
})

describe('DashboardTile processTile per-project auth guard', () => {
  it('does NOT fire a query and surfaces an auth error when the per-project token never arrives', async () => {
    jest.useFakeTimers()
    const setParams = jest.fn()
    const tile = makeTile({ projectId: 'tile-project' })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={setParams}
        authentication={{ token: 'dashboard-token' }}
        getAuthenticationForProject={() => undefined}
      />,
    )
    const instance = wrapper.instance()

    // processTileTop is what actually issues the network query — it must never be reached.
    const processTileTopSpy = jest.spyOn(instance, 'processTileTop')

    const promise = instance.processTile({ query: 'SELECT 1' })

    // Elapse the 15s auth wait, then flush the debounced setParamsForTile (50ms) that carries the
    // error response — all under fake timers so the microtask chain settles deterministically.
    await jest.advanceTimersByTimeAsync(15000)
    await jest.advanceTimersByTimeAsync(100)
    await promise.catch(() => {})
    jest.useRealTimers()

    expect(processTileTopSpy).not.toHaveBeenCalled()

    // The tile is handed a truthful unauthenticated error response (rendered as an error state)
    // rather than being left to fire a doomed request.
    const errorCall = setParams.mock.calls.find(([params]) => params?.queryResponse?.data?.reference_id === '1.1.401')
    expect(errorCall).toBeTruthy()

    processTileTopSpy.mockRestore()
    wrapper.unmount()
  })

  it('fires the query normally once the per-project token is available', async () => {
    const tile = makeTile({ projectId: 'tile-project' })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        authentication={{ token: 'dashboard-token' }}
        getAuthenticationForProject={() => ({ token: 'tile-project-token' })}
      />,
    )
    const instance = wrapper.instance()

    const processTileTopSpy = jest.spyOn(instance, 'processTileTop').mockResolvedValue({ data: { data: {} } })

    await instance.processTile({ query: 'SELECT 1' })

    expect(processTileTopSpy).toHaveBeenCalledTimes(1)

    processTileTopSpy.mockRestore()
    wrapper.unmount()
  })
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

describe('DashboardTile renderProjectButton', () => {
  it('returns null when showProjectIndicator is false, even with a projectSelectList', () => {
    const tile = makeTile()
    const projectSelectList = [{ projectId: '1', displayName: 'Proj A' }]
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        projectSelectList={projectSelectList}
        showProjectIndicator={false}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectButton()).toBeNull()

    wrapper.unmount()
  })

  it('renders the button when showProjectIndicator is true (default) and projectSelectList is populated', () => {
    const tile = makeTile()
    const projectSelectList = [{ projectId: '1', displayName: 'Proj A' }]
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={projectSelectList} />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectButton()).not.toBeNull()

    wrapper.unmount()
  })
})

describe('DashboardTile hasNonDefaultProject / project button indicator', () => {
  const projectSelectList = [
    { projectId: '1', displayName: 'Default Project' },
    { projectId: '2', displayName: 'Other Project' },
  ]

  it('returns false when the tile has no projectId', () => {
    const tile = makeTile()
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        projectSelectList={projectSelectList}
        autoQLConfig={{ projectId: '1' }}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.hasNonDefaultProject()).toBe(false)
    expect(instance.renderProjectButton().props.children[1]).toBeFalsy()

    wrapper.unmount()
  })

  it('returns false when the tile project matches the dashboard default project', () => {
    const tile = makeTile({ projectId: '1' })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        projectSelectList={projectSelectList}
        autoQLConfig={{ projectId: '1' }}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.hasNonDefaultProject()).toBe(false)

    wrapper.unmount()
  })

  it('returns true and renders the indicator dot when the tile project differs from the dashboard default project', () => {
    const tile = makeTile({ projectId: '2' })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        projectSelectList={projectSelectList}
        autoQLConfig={{ projectId: '1' }}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.hasNonDefaultProject()).toBe(true)
    expect(instance.renderProjectButton().props.children[1].props.className).toBe(
      'dashboard-tile-project-button-indicator',
    )

    wrapper.unmount()
  })
})

describe('DashboardTile renderProjectBadge', () => {
  it('returns null when showProjectIndicator is false, even with a differing project_name', () => {
    const tile = makeTile({
      queryResponse: { data: { data: { project_id: '1', project_name: 'MyProject' } } },
    })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} tooltipID='tt-1' showProjectIndicator={false} />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectBadge()).toBeNull()

    wrapper.unmount()
  })

  it('renders a badge with the project name when showProjectIndicator is true (default) and queryResponse has a project_name', () => {
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

  it('returns null when the queried project is the dashboard-wide current project', () => {
    const tile = makeTile({
      queryResponse: { data: { data: { project_id: '1', project_name: 'MyProject' } } },
    })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} autoQLConfig={{ projectId: '1' }} />)
    const instance = wrapper.instance()

    expect(instance.renderProjectBadge()).toBeNull()

    wrapper.unmount()
  })

  it('renders the badge when the queried project differs from the dashboard-wide current project', () => {
    const tile = makeTile({
      queryResponse: { data: { data: { project_id: '2', project_name: 'MyProject' } } },
    })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} autoQLConfig={{ projectId: '1' }} />)
    const instance = wrapper.instance()

    expect(instance.renderProjectBadge()).not.toBeNull()

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

describe('DashboardTile project change button + modal', () => {
  const projectSelectList = [
    { projectId: '1', displayName: 'Project A' },
    { projectId: '2', displayName: 'Project B' },
  ]

  it('renderProjectButton returns null when no projectSelectList is provided', () => {
    const tile = makeTile()
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    expect(instance.renderProjectButton()).toBeNull()
    expect(instance.renderProjectModal()).toBeNull()

    wrapper.unmount()
  })

  it('renderProjectButton returns null when projectSelectList is empty', () => {
    const tile = makeTile()
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={[]} />)
    const instance = wrapper.instance()

    expect(instance.renderProjectButton()).toBeNull()

    wrapper.unmount()
  })

  it('renders an icon-only button with the current project name in its tooltip', () => {
    const tile = makeTile({ projectId: '2' })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={projectSelectList} />,
    )
    const instance = wrapper.instance()

    const button = instance.renderProjectButton()
    expect(button.props['data-tooltip-content']).toBe('Change project (current: Project B)')

    wrapper.unmount()
  })

  it('openProjectModal stages the tile projectId and opens the modal', () => {
    const tile = makeTile({ projectId: '1' })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={projectSelectList} />,
    )
    const instance = wrapper.instance()

    instance.openProjectModal()

    expect(instance.state.isProjectModalOpen).toBe(true)
    expect(instance.state.pendingProjectId).toBe('1')

    wrapper.unmount()
  })

  it('confirmProjectChange applies the staged projectId and closes the modal', () => {
    const setParams = jest.fn()
    const tile = makeTile({ projectId: '1' })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={setParams} projectSelectList={projectSelectList} />,
    )
    const instance = wrapper.instance()

    instance.setState({ isProjectModalOpen: true, pendingProjectId: '2' })
    instance.confirmProjectChange()

    expect(setParams).toHaveBeenCalledWith({ projectId: '2' }, tile.i, [])
    expect(instance.state.isProjectModalOpen).toBe(false)

    wrapper.unmount()
  })

  it('closeProjectModal closes without applying a change', () => {
    const setParams = jest.fn()
    const tile = makeTile({ projectId: '1' })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={setParams} projectSelectList={projectSelectList} />,
    )
    const instance = wrapper.instance()

    instance.setState({ isProjectModalOpen: true, pendingProjectId: '2' })
    instance.closeProjectModal()

    // Unrelated debounced calls (e.g. QueryOutput's onAggConfigChange on mount) may still fire;
    // only assert that closing the modal never applies the staged projectId.
    const calledWithProjectId = setParams.mock.calls.some(([params]) => 'projectId' in (params || {}))
    expect(calledWithProjectId).toBe(false)
    expect(instance.state.isProjectModalOpen).toBe(false)

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
