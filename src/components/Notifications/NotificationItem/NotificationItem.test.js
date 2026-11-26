import React from 'react'
import { shallow } from 'enzyme'
import { GENERAL_ERROR, fetchNotification, updateDataAlertStatus } from 'autoql-fe-utils'

import { testAuthentication } from '../../../../test/testData'
import NotificationItem from './NotificationItem'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  fetchNotification: jest.fn(),
  updateDataAlertStatus: jest.fn(),
}))

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const notification = {
  id: 'nt_1',
  event_type: 'DATA_ALERT',
  title: 'Sales spiked',
  message: 'Total sales exceeded 10,000',
  state: 'UNACKNOWLEDGED',
  created_at: 1763251200,
  project: { id: 'prj_1', name: 'Sales' },
  payload: { data_alert_id: 'da_1', data_alert_type: 'PROJECT', outcome: 'TRUE' },
}

const setup = (props = {}) =>
  shallow(<NotificationItem authentication={testAuthentication} notification={notification} {...props} />)

describe('NotificationItem with notifications service payloads', () => {
  afterEach(() => jest.clearAllMocks())

  test('fetches the query result by id when expanded', async () => {
    const queryResult = { data: { query_id: 'q1' } }
    fetchNotification.mockResolvedValue({
      ...notification,
      payload: { ...notification.payload, query_result: queryResult },
    })

    const wrapper = setup()
    expect(fetchNotification).not.toHaveBeenCalled()

    wrapper.setState({ expanded: true })
    await flushPromises()

    expect(fetchNotification).toHaveBeenCalledTimes(1)
    expect(fetchNotification).toHaveBeenCalledWith(expect.objectContaining({ id: 'nt_1' }))
    expect(wrapper.state('queryResponse')).toEqual({ data: queryResult })
  })

  test('does not fetch again when collapsed and expanded again', async () => {
    fetchNotification.mockResolvedValue({ ...notification, payload: { query_result: { data: {} } } })

    const wrapper = setup()
    wrapper.setState({ expanded: true })
    await flushPromises()
    wrapper.setState({ expanded: false })
    wrapper.setState({ expanded: true })
    await flushPromises()

    expect(fetchNotification).toHaveBeenCalledTimes(1)
  })

  test('uses payload.query_result without fetching when it is already present', () => {
    const queryResult = { data: { query_id: 'q1' } }
    const wrapper = setup({
      defaultExpanded: true,
      notification: { ...notification, payload: { ...notification.payload, query_result: queryResult } },
    })

    expect(fetchNotification).not.toHaveBeenCalled()
    expect(wrapper.state('queryResponse')).toEqual({ data: queryResult })
  })

  test('shows the general error when the fetched notification has no query result', async () => {
    fetchNotification.mockResolvedValue({ ...notification, payload: {} })

    const wrapper = setup({ defaultExpanded: true })
    await flushPromises()

    expect(wrapper.state('queryResponse')).toEqual({ data: { message: GENERAL_ERROR } })
  })

  test('shows an error message when the fetch fails', async () => {
    fetchNotification.mockRejectedValue({ data: { message: 'Notification not found' } })
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = setup({ defaultExpanded: true })
    await flushPromises()

    expect(wrapper.state('queryResponse')).toEqual({ data: { message: 'Notification not found' } })
    console.error.mockRestore()
  })

  test('does not expand or show the options menu in select mode', () => {
    const wrapper = setup({ isSelecting: true })
    wrapper.find('.react-autoql-notification-list-item-header').simulate('click')

    expect(wrapper.state('expanded')).toBeFalsy()
    expect(fetchNotification).not.toHaveBeenCalled()
    expect(wrapper.find('.react-autoql-notification-options-btn-container').exists()).toBe(false)
  })

  test('reads the error outcome from the payload', () => {
    const wrapper = setup({ notification: { ...notification, payload: { outcome: 'ERROR' } } })
    expect(wrapper.instance().isError()).toBe(true)
    expect(setup().instance().isError()).toBe(false)
  })

  test('turns the data alert on/off using the ids from the payload', () => {
    updateDataAlertStatus.mockResolvedValue({})
    setup().instance().changeDataAlertStatus('INACTIVE')

    expect(updateDataAlertStatus).toHaveBeenCalledWith(
      expect.objectContaining({ dataAlertId: 'da_1', type: 'PROJECT', status: 'INACTIVE' }),
    )
  })
})
