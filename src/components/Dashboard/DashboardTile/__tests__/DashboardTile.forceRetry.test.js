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

const serverErrorResponse = { data: { reference_id: '29.9.502' } }
const otherErrorResponse = { data: { reference_id: '29.9.500' } }

describe('DashboardTile executeQueryWithForceRetry', () => {
  it('retries once with force: true on a server error for a custom dashboard', async () => {
    const tile = makeTile()
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} isProjectDashboard={false} />,
    )
    const instance = wrapper.instance()

    const queryFunction = jest
      .fn()
      .mockRejectedValueOnce(serverErrorResponse)
      .mockResolvedValueOnce({ data: 'success' })

    const result = await instance.executeQueryWithForceRetry({ force: false }, queryFunction)

    expect(queryFunction).toHaveBeenCalledTimes(2)
    expect(queryFunction).toHaveBeenNthCalledWith(1, { force: false })
    expect(queryFunction).toHaveBeenNthCalledWith(2, { force: true })
    expect(result).toEqual({ data: 'success' })

    wrapper.unmount()
  })

  it('does not retry with force: true on a server error for a project-based dashboard', async () => {
    const tile = makeTile()
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} isProjectDashboard={true} />,
    )
    const instance = wrapper.instance()

    const queryFunction = jest.fn().mockRejectedValueOnce(serverErrorResponse)

    await expect(instance.executeQueryWithForceRetry({ force: false }, queryFunction)).rejects.toEqual(
      serverErrorResponse,
    )

    expect(queryFunction).toHaveBeenCalledTimes(1)
    expect(queryFunction).toHaveBeenCalledWith({ force: false })

    wrapper.unmount()
  })

  it('does not retry when the error is not a retryable server error, regardless of dashboard type', async () => {
    const tile = makeTile()
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} isProjectDashboard={false} />,
    )
    const instance = wrapper.instance()

    const queryFunction = jest.fn().mockRejectedValueOnce(otherErrorResponse)

    await expect(instance.executeQueryWithForceRetry({ force: false }, queryFunction)).rejects.toEqual(
      otherErrorResponse,
    )

    expect(queryFunction).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('does not retry again when the request already has force: true', async () => {
    const tile = makeTile()
    const wrapper = mount(
      <DashboardTile tile={tile} setParamsForTile={() => {}} isProjectDashboard={false} />,
    )
    const instance = wrapper.instance()

    const queryFunction = jest.fn().mockRejectedValueOnce(serverErrorResponse)

    await expect(instance.executeQueryWithForceRetry({ force: true }, queryFunction)).rejects.toEqual(
      serverErrorResponse,
    )

    expect(queryFunction).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
