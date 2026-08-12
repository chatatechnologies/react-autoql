import React from 'react'
import { mount } from 'enzyme'
import { UNAUTHENTICATED_ERROR } from 'autoql-fe-utils'
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

// formatErrorResponse strips the status off a bare 401 and rejects with only the message
const statuslessAuthError = { data: { message: UNAUTHENTICATED_ERROR } }
const axiosAuthError = { response: { status: 401 } }

// Mounts a tile whose per-project token flips to `refreshedToken` as soon as onTileAuthExpired fires
const mountTileWithRefreshableAuth = (props = {}) => {
  let currentToken = 'stale-token'
  const onTileAuthExpired = jest.fn(() => {
    currentToken = 'refreshed-token'
  })
  const wrapper = mount(
    <DashboardTile
      tile={makeTile({ projectId: 'tile-project' })}
      setParamsForTile={() => {}}
      authentication={{ token: 'dashboard-token' }}
      getAuthenticationForProject={() => ({ token: currentToken })}
      onTileAuthExpired={onTileAuthExpired}
      {...props}
    />,
  )
  return { wrapper, instance: wrapper.instance(), onTileAuthExpired }
}

describe('DashboardTile isAuthError', () => {
  const wrapper = mount(<DashboardTile tile={makeTile()} setParamsForTile={() => {}} />)
  const instance = wrapper.instance()

  afterAll(() => wrapper.unmount())

  it('detects a 401 on the error itself', () => {
    expect(instance.isAuthError({ status: 401 })).toBe(true)
  })

  it('detects a 401 on a wrapped axios response', () => {
    expect(instance.isAuthError(axiosAuthError)).toBe(true)
  })

  it('detects a status-less 401 by its UNAUTHENTICATED_ERROR message', () => {
    expect(instance.isAuthError(statuslessAuthError)).toBe(true)
  })

  it('does not treat other errors as auth errors', () => {
    expect(instance.isAuthError({ status: 500 })).toBe(false)
    expect(instance.isAuthError({ data: { message: 'Something else went wrong' } })).toBe(false)
    expect(instance.isAuthError(undefined)).toBe(false)
  })
})

describe('DashboardTile auth-expiry retry', () => {
  it('refreshes the token and retries once on a status-less 401', async () => {
    const { wrapper, instance, onTileAuthExpired } = mountTileWithRefreshableAuth()

    const queryFunction = jest.fn().mockRejectedValueOnce(statuslessAuthError).mockResolvedValueOnce({ data: 'ok' })

    const result = await instance.executeQueryWithForceRetry({ token: 'stale-token' }, queryFunction)

    expect(onTileAuthExpired).toHaveBeenCalledWith('tile-project')
    expect(queryFunction).toHaveBeenCalledTimes(2)
    expect(queryFunction.mock.calls[1][0].token).toBe('refreshed-token')
    expect(result).toEqual({ data: 'ok' })

    wrapper.unmount()
  })

  it('refreshes the token and retries once on an axios 401', async () => {
    const { wrapper, instance, onTileAuthExpired } = mountTileWithRefreshableAuth()

    const queryFunction = jest.fn().mockRejectedValueOnce(axiosAuthError).mockResolvedValueOnce({ data: 'ok' })

    await instance.executeQueryWithForceRetry({ token: 'stale-token' }, queryFunction)

    expect(onTileAuthExpired).toHaveBeenCalledTimes(1)
    expect(queryFunction).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('only retries once - a second 401 rejects instead of looping', async () => {
    const { wrapper, instance, onTileAuthExpired } = mountTileWithRefreshableAuth()

    const queryFunction = jest.fn().mockRejectedValue(statuslessAuthError)

    await expect(instance.executeQueryWithForceRetry({ token: 'stale-token' }, queryFunction)).rejects.toEqual(
      statuslessAuthError,
    )

    expect(onTileAuthExpired).toHaveBeenCalledTimes(1)
    expect(queryFunction).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('rejects without retrying when the tile has no projectId', async () => {
    const onTileAuthExpired = jest.fn()
    const wrapper = mount(
      <DashboardTile tile={makeTile()} setParamsForTile={() => {}} onTileAuthExpired={onTileAuthExpired} />,
    )
    const queryFunction = jest.fn().mockRejectedValue(statuslessAuthError)

    await expect(
      wrapper.instance().executeQueryWithForceRetry({ force: false }, queryFunction),
    ).rejects.toEqual(statuslessAuthError)

    expect(onTileAuthExpired).not.toHaveBeenCalled()
    expect(queryFunction).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('rejects without retrying when the host provides no onTileAuthExpired handler', async () => {
    const wrapper = mount(
      <DashboardTile
        tile={makeTile({ projectId: 'tile-project' })}
        setParamsForTile={() => {}}
        getAuthenticationForProject={() => ({ token: 'stale-token' })}
      />,
    )
    const queryFunction = jest.fn().mockRejectedValue(statuslessAuthError)

    await expect(
      wrapper.instance().executeQueryWithForceRetry({ force: false }, queryFunction),
    ).rejects.toEqual(statuslessAuthError)

    expect(queryFunction).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('waits for a genuinely new token instead of retrying with the same stale one', async () => {
    jest.useFakeTimers()
    let currentToken = 'stale-token'
    const wrapper = mount(
      <DashboardTile
        tile={makeTile({ projectId: 'tile-project' })}
        setParamsForTile={() => {}}
        getAuthenticationForProject={() => ({ token: currentToken })}
        onTileAuthExpired={() => {}}
      />,
    )
    const queryFunction = jest.fn().mockRejectedValueOnce(statuslessAuthError).mockResolvedValueOnce({ data: 'ok' })

    const promise = wrapper.instance().executeQueryWithForceRetry({ token: 'stale-token' }, queryFunction)

    // Token hasn't actually changed yet, so the retry must stay parked
    await jest.advanceTimersByTimeAsync(1000)
    expect(queryFunction).toHaveBeenCalledTimes(1)

    currentToken = 'refreshed-token'
    await jest.advanceTimersByTimeAsync(100)
    await promise
    jest.useRealTimers()

    expect(queryFunction).toHaveBeenCalledTimes(2)
    expect(queryFunction.mock.calls[1][0].token).toBe('refreshed-token')

    wrapper.unmount()
  })

  it('gives up and rejects with the original error if the token never refreshes', async () => {
    jest.useFakeTimers()
    const wrapper = mount(
      <DashboardTile
        tile={makeTile({ projectId: 'tile-project' })}
        setParamsForTile={() => {}}
        getAuthenticationForProject={() => ({ token: 'stale-token' })}
        onTileAuthExpired={() => {}}
      />,
    )
    const queryFunction = jest.fn().mockRejectedValue(statuslessAuthError)

    const promise = wrapper.instance().executeQueryWithForceRetry({ token: 'stale-token' }, queryFunction)
    const assertion = expect(promise).rejects.toEqual(statuslessAuthError)

    await jest.advanceTimersByTimeAsync(15000)
    await assertion
    jest.useRealTimers()

    expect(queryFunction).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
