import React from 'react'
import { mount } from 'enzyme'
import { DashboardTile } from '../DashboardTile'
import { QueryOutput } from '../../../QueryOutput'
import { OptionsToolbar } from '../../../OptionsToolbar'
import { Select } from '../../../Select'
import { Modal } from '../../../Modal'
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

  it('gives each overlapping processTile call its own cancel token instead of racing on the latest this.axiosSource', async () => {
    let authReady = false
    const tile = makeTile({ projectId: 'tile-project' })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        authentication={{ token: 'dashboard-token' }}
        getAuthenticationForProject={() => (authReady ? { token: 'tile-project-token' } : undefined)}
      />,
    )
    const instance = wrapper.instance()

    const processQuerySpy = jest.spyOn(instance, 'processQuery').mockResolvedValue({ data: { data: {} } })

    // Call A starts waiting on auth (not ready yet) and captures its own axiosSource.
    const promiseA = instance.processTile({ query: 'SELECT A' })
    const axiosSourceA = instance.axiosSource

    // Call B fires before A's wait resolves: it cancels A's source and installs a new one.
    const promiseB = instance.processTile({ query: 'SELECT B' })
    const axiosSourceB = instance.axiosSource

    expect(axiosSourceA).not.toBe(axiosSourceB)
    expect(axiosSourceA.token.reason).toBeTruthy() // A's own source was cancelled by B, as expected

    authReady = true
    await Promise.all([promiseA.catch(() => {}), promiseB.catch(() => {})])

    // Each call's outgoing request must use the token captured at its own start, not whichever
    // source happens to be current (this.axiosSource) once its auth wait resolves.
    expect(processQuerySpy).toHaveBeenCalledTimes(2)
    expect(processQuerySpy.mock.calls[0][0].axiosSource).toBe(axiosSourceA)
    expect(processQuerySpy.mock.calls[1][0].axiosSource).toBe(axiosSourceB)

    processQuerySpy.mockRestore()
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

  it('renders the button when showProjectIndicator is true (default) and projectSelectList has more than one project', () => {
    const tile = makeTile()
    const projectSelectList = [
      { projectId: '1', displayName: 'Proj A' },
      { projectId: '2', displayName: 'Proj B' },
    ]
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={projectSelectList} />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectButton()).not.toBeNull()

    wrapper.unmount()
  })

  it('returns null when projectSelectList has only one project - nothing to switch to', () => {
    const tile = makeTile()
    const projectSelectList = [{ projectId: '1', displayName: 'Proj A' }]
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={projectSelectList} />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectButton()).toBeNull()
    expect(instance.renderProjectModal()).toBeNull()

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
  const twoProjectList = [
    { projectId: '1', displayName: 'Default Project' },
    { projectId: '2', displayName: 'Other Project' },
  ]

  it('returns null when showProjectIndicator is false, even with a differing project_name', () => {
    const tile = makeTile({
      queryResponse: { data: { data: { project_id: '1', project_name: 'MyProject' } } },
    })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        tooltipID='tt-1'
        showProjectIndicator={false}
        projectSelectList={twoProjectList}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectBadge()).toBeNull()

    wrapper.unmount()
  })

  it('returns null when only one project is available, even with a differing project_name', () => {
    const tile = makeTile({
      queryResponse: { data: { data: { project_id: '2', project_name: 'MyProject' } } },
    })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        tooltipID='tt-1'
        projectSelectList={[{ projectId: '1', displayName: 'Only Project' }]}
        autoQLConfig={{ projectId: '1' }}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectBadge()).toBeNull()

    wrapper.unmount()
  })

  it('renders a badge with the project name when showProjectIndicator is true (default) and queryResponse has a project_name', () => {
    const tile = makeTile({
      queryResponse: { data: { data: { project_id: '1', project_name: 'MyProject' } } },
    })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        tooltipID='tt-1'
        projectSelectList={twoProjectList}
      />,
    )
    const instance = wrapper.instance()

    const badge = instance.renderProjectBadge()
    expect(badge.props.children).toBe('MyProject')
    expect(badge.props['data-tooltip-content']).toBe('Project: MyProject')
    expect(badge.props['data-tooltip-id']).toBe('tt-1')

    wrapper.unmount()
  })

  it('returns null when there is no queryResponse project data', () => {
    const tile = makeTile({ queryResponse: null })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={twoProjectList} />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectBadge()).toBeNull()

    wrapper.unmount()
  })

  it('returns null when the queried project is the dashboard-wide current project', () => {
    const tile = makeTile({
      queryResponse: { data: { data: { project_id: '1', project_name: 'MyProject' } } },
    })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        autoQLConfig={{ projectId: '1' }}
        projectSelectList={twoProjectList}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectBadge()).toBeNull()

    wrapper.unmount()
  })

  it('renders the badge when the queried project differs from the dashboard-wide current project', () => {
    const tile = makeTile({
      queryResponse: { data: { data: { project_id: '2', project_name: 'MyProject' } } },
    })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        autoQLConfig={{ projectId: '1' }}
        projectSelectList={twoProjectList}
      />,
    )
    const instance = wrapper.instance()

    expect(instance.renderProjectBadge()).not.toBeNull()

    wrapper.unmount()
  })

  it('falls back to tile.projectId + projectSelectList when there is no queryResponse yet (loading/failed tile)', () => {
    const projectSelectList = [
      { projectId: '1', displayName: 'Proj A' },
      { projectId: '2', displayName: 'Proj B' },
    ]
    const tile = makeTile({ projectId: '2', queryResponse: null })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        projectSelectList={projectSelectList}
        autoQLConfig={{ projectId: '1' }}
        tooltipID='tt-1'
      />,
    )
    const instance = wrapper.instance()

    const badge = instance.renderProjectBadge()
    expect(badge.props.children).toBe('Proj B')
    expect(badge.props['data-tooltip-content']).toBe('Project: Proj B')

    wrapper.unmount()
  })

  it('does not use the projectSelectList fallback when the tile project matches the dashboard default', () => {
    const projectSelectList = [
      { projectId: '1', displayName: 'Proj A' },
      { projectId: '2', displayName: 'Proj B' },
    ]
    const tile = makeTile({ projectId: '1', queryResponse: null })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        projectSelectList={projectSelectList}
        autoQLConfig={{ projectId: '1' }}
      />,
    )
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

describe('DashboardTile projectIdsEqual (string vs number coercion)', () => {
  it('treats a numeric and string projectId representing the same project as equal', () => {
    const wrapper = mount(<DashboardTile tile={makeTile()} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    expect(instance.projectIdsEqual(2, '2')).toBe(true)
    expect(instance.projectIdsEqual('2', 2)).toBe(true)

    wrapper.unmount()
  })

  it('treats two nullish projectIds as equal (no project set on either side)', () => {
    const wrapper = mount(<DashboardTile tile={makeTile()} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    expect(instance.projectIdsEqual(undefined, null)).toBe(true)
    expect(instance.projectIdsEqual(undefined, undefined)).toBe(true)

    wrapper.unmount()
  })

  it('treats a set projectId vs a nullish one as different', () => {
    const wrapper = mount(<DashboardTile tile={makeTile()} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()

    expect(instance.projectIdsEqual('1', null)).toBe(false)
    expect(instance.projectIdsEqual(null, '1')).toBe(false)

    wrapper.unmount()
  })

  it('does NOT re-run the query on componentDidUpdate when projectId only changes type (2 -> "2")', () => {
    const tile = makeTile({ projectId: 2 })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()
    const processTileSpy = jest.spyOn(instance, 'processTile').mockImplementation(() => Promise.resolve())

    wrapper.setProps({ tile: { ...tile, projectId: '2' } })

    expect(processTileSpy).not.toHaveBeenCalled()

    processTileSpy.mockRestore()
    wrapper.unmount()
  })

  it('does not treat a pure projectId type flip as a structural change to topRequestData', () => {
    const tile = makeTile({ projectId: 2 })
    const wrapper = mount(<DashboardTile tile={tile} setParamsForTile={() => {}} />)
    const instance = wrapper.instance()
    jest.spyOn(instance, 'processTile').mockImplementation(() => Promise.resolve())

    instance.topRequestData = { query: tile.query, tableFilters: [], filters: [], orders: [], projectId: 2 }

    instance.componentDidUpdate({ ...wrapper.props(), tile: { ...tile, projectId: '2' } }, instance.state)

    // topRequestData.projectId is left untouched (2, not overwritten with the string '2') because
    // topChanged evaluates false — a pure type flip must not be treated as a structural request change.
    expect(instance.topRequestData.projectId).toBe(2)

    instance.processTile.mockRestore()
    wrapper.unmount()
  })

  it('getSelectedProjectName matches a list entry regardless of string/number projectId type', () => {
    const projectSelectList = [{ projectId: 1, displayName: 'Project A' }]
    const tile = makeTile({ projectId: '1' })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={projectSelectList} />,
    )
    const instance = wrapper.instance()

    expect(instance.getSelectedProjectName()).toBe('Project A')

    wrapper.unmount()
  })

  it('confirmDisabled treats a same-project type flip as a no-op change (Modal stays disabled)', () => {
    const projectSelectList = [
      { projectId: 1, displayName: 'Project A' },
      { projectId: 2, displayName: 'Project B' },
    ]
    const tile = makeTile({ projectId: 1 })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={projectSelectList} isEditing />,
    )
    const instance = wrapper.instance()

    // Same project id as the tile's, but as a string instead of a number.
    instance.setState({ isProjectModalOpen: true, pendingProjectId: '1' })
    wrapper.update()

    expect(wrapper.find(Modal).prop('confirmDisabled')).toBe(true)

    wrapper.unmount()
  })

  it('openProjectModal normalizes pendingProjectId to the exact type/value used in projectSelectList', () => {
    const projectSelectList = [
      { projectId: 1, displayName: 'Project A' },
      { projectId: 2, displayName: 'Project B' },
    ]
    const tile = makeTile({ projectId: '2' })
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} projectSelectList={projectSelectList} isEditing />,
    )
    const instance = wrapper.instance()

    instance.openProjectModal()
    wrapper.update()

    // Normalized to the list's numeric 2, not the tile's raw string '2', so Select's internal
    // strict === match against option.value actually highlights the current selection.
    expect(instance.state.pendingProjectId).toBe(2)
    expect(wrapper.find(Select).prop('value')).toBe(2)

    wrapper.unmount()
  })

  it('resolveListProjectId returns the original value unchanged when no list entry matches', () => {
    const projectSelectList = [{ projectId: 1, displayName: 'Project A' }]
    const wrapper = mount(
      <DashboardTile tile={makeTile()} setParamsForTile={() => {}} projectSelectList={projectSelectList} />,
    )
    const instance = wrapper.instance()

    expect(instance.resolveListProjectId('unknown-project')).toBe('unknown-project')
    expect(instance.resolveListProjectId(undefined)).toBeUndefined()

    wrapper.unmount()
  })
})

describe('DashboardTile runWithTileAuthGuard unmount race', () => {
  it('does not fire the query or the auth-error fallback if the tile unmounts mid-wait', async () => {
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
    const processTileTopSpy = jest.spyOn(instance, 'processTileTop')
    const handleUnavailableSpy = jest.spyOn(instance, 'handleUnavailableTileAuth')

    const promise = instance.runWithTileAuthGuard(() => instance.processTileTop({ query: 'SELECT 1' }))

    wrapper.unmount()
    await jest.advanceTimersByTimeAsync(15000)
    await promise
    jest.useRealTimers()

    expect(processTileTopSpy).not.toHaveBeenCalled()
    expect(handleUnavailableSpy).not.toHaveBeenCalled()

    processTileTopSpy.mockRestore()
    handleUnavailableSpy.mockRestore()
  })
})

describe('DashboardTile runWithTileAuthGuard late-auth self-healing retry', () => {
  it('fires the query once auth arrives after the 15s wait times out, replacing the stale error', async () => {
    jest.useFakeTimers()
    const setParams = jest.fn()
    const tile = makeTile({ projectId: 'tile-project' })
    let tokenReady = false
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={setParams}
        authentication={{ token: 'dashboard-token' }}
        getAuthenticationForProject={() => (tokenReady ? { token: 'tile-project-token' } : undefined)}
      />,
    )
    const instance = wrapper.instance()
    const fireQuery = jest.fn().mockResolvedValue('real-data')

    const promise = instance.runWithTileAuthGuard(fireQuery)

    // Times out at 15s with no token yet — the synthetic error fires, fireQuery does not.
    await jest.advanceTimersByTimeAsync(15000)
    await promise
    expect(fireQuery).not.toHaveBeenCalled()

    // Auth arrives late — the background watcher picks it up on its next 100ms poll.
    tokenReady = true
    await jest.advanceTimersByTimeAsync(100)
    jest.useRealTimers()

    expect(fireQuery).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('does not fire fireQuery if the tile unmounts before late auth arrives', async () => {
    jest.useFakeTimers()
    const tile = makeTile({ projectId: 'tile-project' })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        authentication={{ token: 'dashboard-token' }}
        getAuthenticationForProject={() => undefined}
      />,
    )
    const instance = wrapper.instance()
    const fireQuery = jest.fn()

    const promise = instance.runWithTileAuthGuard(fireQuery)

    await jest.advanceTimersByTimeAsync(15000)
    await promise

    wrapper.unmount()
    await jest.advanceTimersByTimeAsync(10000)
    jest.useRealTimers()

    expect(fireQuery).not.toHaveBeenCalled()
  })

  it('does not fire the query twice when a manual re-run happens while a late-auth watcher is pending', async () => {
    jest.useFakeTimers()
    const tile = makeTile({ projectId: 'tile-project' })
    let tokenReady = false
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        authentication={{ token: 'dashboard-token' }}
        getAuthenticationForProject={() => (tokenReady ? { token: 'tile-project-token' } : undefined)}
      />,
    )
    const instance = wrapper.instance()
    const fireQuery = jest.fn().mockResolvedValue('real-data')

    const firstPromise = instance.runWithTileAuthGuard(fireQuery)
    await jest.advanceTimersByTimeAsync(15000)
    await firstPromise
    expect(fireQuery).not.toHaveBeenCalled()

    // Manual re-run supersedes the pending late-auth watcher from the first attempt.
    tokenReady = true
    const secondPromise = instance.runWithTileAuthGuard(fireQuery)
    await secondPromise
    await jest.advanceTimersByTimeAsync(200)
    jest.useRealTimers()

    expect(fireQuery).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})

describe('DashboardTile onSuggestionClick per-project auth guard', () => {
  it('does not fire the query for a suggestion button click until the per-project token resolves', async () => {
    jest.useFakeTimers()
    const tile = makeTile({ projectId: 'tile-project' })
    const wrapper = mount(
      <DashboardTile
        tile={tile}
        setParamsForTile={() => {}}
        authentication={{ token: 'dashboard-token' }}
        getAuthenticationForProject={() => undefined}
      />,
    )
    const instance = wrapper.instance()
    const processTileTopSpy = jest.spyOn(instance, 'processTileTop')

    instance.onSuggestionClick({ query: 'SELECT 1', isButtonClick: true })

    expect(processTileTopSpy).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(15000)
    jest.useRealTimers()

    expect(processTileTopSpy).not.toHaveBeenCalled()

    processTileTopSpy.mockRestore()
    wrapper.unmount()
  })

  it('fires the query for a suggestion button click once the per-project token is available', async () => {
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

    instance.onSuggestionClick({ query: 'SELECT 1', isButtonClick: true })
    await Promise.resolve()
    await Promise.resolve()

    expect(processTileTopSpy).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'SELECT 1', skipQueryValidation: true }),
    )

    processTileTopSpy.mockRestore()
    wrapper.unmount()
  })
})
