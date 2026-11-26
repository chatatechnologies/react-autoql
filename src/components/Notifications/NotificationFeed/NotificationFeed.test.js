import React from 'react'
import { shallow } from 'enzyme'
import { deleteAllNotifications, deleteMultipleNotifications, fetchNotificationFeed } from 'autoql-fe-utils'

import { findByTestAttr } from '../../../../test/testUtils'
import { testAuthentication } from '../../../../test/testData'
import NotificationFeed from './NotificationFeed'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  deleteAllNotifications: jest.fn(),
  deleteMultipleNotifications: jest.fn(),
  fetchNotificationFeed: jest.fn(() => Promise.resolve({ items: [] })),
}))

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const defaultProps = {
  authentication: testAuthentication,
  notifications: [],
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<NotificationFeed {...setupProps} />).dive()
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', async () => {
    const wrapper = setup()
    const notificationListComponent = findByTestAttr(wrapper, 'notification-list')
    expect(notificationListComponent.exists()).toBe(true)
  })
})

describe('selecting notifications', () => {
  const notificationList = [
    { id: 'nt_1', title: 'One', payload: {} },
    { id: 'nt_2', title: 'Two', payload: {} },
    { id: 'nt_3', title: 'Three', payload: {} },
  ]

  const setupSelecting = (props = {}) =>
    setup(
      { shouldRender: false, ...props },
      {
        isFetchingFirstNotifications: false,
        notificationList,
        pagination: { total_items: 25 },
        displayNotificationItemCheckbox: true,
      },
    )

  beforeEach(() => {
    deleteAllNotifications.mockResolvedValue({})
    deleteMultipleNotifications.mockResolvedValue({})
  })
  afterEach(() => jest.clearAllMocks())

  test('clicking anywhere on a notification selects it, and the item does not expand', () => {
    const wrapper = setupSelecting()
    wrapper.find('.notification-item-container').at(1).simulate('click')
    expect(wrapper.state('selectedNotifications')).toEqual(['nt_2'])
    expect(wrapper.find('NotificationItem').at(1).prop('isSelecting')).toBe(true)

    wrapper.find('.notification-item-container').at(1).simulate('click')
    expect(wrapper.state('selectedNotifications')).toEqual([])
  })

  test('clicking a notification outside select mode does not select it', () => {
    const wrapper = setupSelecting()
    wrapper.setState({ displayNotificationItemCheckbox: false })
    wrapper.find('.notification-item-container').at(0).simulate('click')
    expect(wrapper.state('selectedNotifications')).toEqual([])
  })

  test('shift-click selects every notification between the last click and this one', () => {
    const wrapper = setupSelecting()
    wrapper.find('.notification-item-container').at(0).simulate('click', {})
    wrapper.find('.notification-item-container').at(2).simulate('click', { shiftKey: true })
    expect(wrapper.state('selectedNotifications')).toEqual(['nt_1', 'nt_2', 'nt_3'])
  })

  test('shift-click upwards works, and unselecting with shift-click unselects the range', () => {
    const wrapper = setupSelecting()
    wrapper.instance().onSelectAllClick()
    wrapper.find('.notification-item-container').at(2).simulate('click', {})
    expect(wrapper.state('selectedNotifications')).toEqual(['nt_1', 'nt_2'])

    wrapper.find('.notification-item-container').at(1).simulate('click', { shiftKey: true })
    expect(wrapper.state('selectedNotifications')).toEqual(['nt_1'])
    expect(wrapper.state('isAllSelected')).toBe(false)
  })

  test('shift-click with no previous click selects only that notification', () => {
    const wrapper = setupSelecting()
    wrapper.find('.notification-item-container').at(2).simulate('click', { shiftKey: true })
    expect(wrapper.state('selectedNotifications')).toEqual(['nt_3'])
  })

  test('select all selects every loaded notification, and unselecting one leaves "all" mode', () => {
    const wrapper = setupSelecting()
    wrapper.instance().onSelectAllClick()
    expect(wrapper.state('selectedNotifications')).toEqual(['nt_1', 'nt_2', 'nt_3'])
    expect(wrapper.state('isAllSelected')).toBe(true)

    wrapper.find('.notification-item-container').at(0).simulate('click')
    expect(wrapper.state('selectedNotifications')).toEqual(['nt_2', 'nt_3'])
    expect(wrapper.state('isAllSelected')).toBe(false)
  })

  const projectProps = {
    enableFetchAllNotificationFeedAcrossProjects: true,
    selectedProjectId: 'prj_1',
    selectedProjectName: 'Sales',
  }
  const banner = (wrapper) => wrapper.find('.react-autoql-notification-select-all-banner')

  test('the header checkbox selects only the loaded notifications', () => {
    const wrapper = setupSelecting(projectProps)
    wrapper.find('.react-autoql-notification-select-all').simulate('click')
    expect(wrapper.find('.react-autoql-notification-delete-label').text()).toBe('Delete (3)')

    wrapper.instance().onDeleteSelectedConfirm()
    expect(deleteAllNotifications).not.toHaveBeenCalled()
    expect(deleteMultipleNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notificationList: ['nt_1', 'nt_2', 'nt_3'] }),
    )
  })

  test('the banner selects everything in the project, and Delete removes every one of their IDs', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `nt_${i + 1}`)
    fetchNotificationFeed.mockResolvedValueOnce({ items: ids.map((id) => ({ id })) })

    const wrapper = setupSelecting(projectProps)
    expect(banner(wrapper).exists()).toBe(false)

    wrapper.instance().onSelectAllClick()
    expect(banner(wrapper).text()).toBe('All 3 loaded notifications are selected. Select all 25 notifications in Sales')

    banner(wrapper).find('a').simulate('click')
    expect(banner(wrapper).text()).toBe('All 25 notifications in Sales are selected. Clear selection')
    expect(wrapper.find('.react-autoql-notification-delete-label').text()).toBe('Delete (25)')
    expect(wrapper.instance().getDeleteSelectedTitle()).toBe('Delete all 25 notifications in Sales?')

    wrapper.instance().onDeleteSelectedConfirm()
    await flushPromises()
    expect(fetchNotificationFeed).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, limit: 500, selectedProjectId: 'prj_1' }),
    )
    expect(deleteMultipleNotifications).toHaveBeenCalledWith(expect.objectContaining({ notificationList: ids }))
    expect(deleteAllNotifications).not.toHaveBeenCalled()
    expect(wrapper.state('notificationList')).toEqual([])
    expect(wrapper.state('pagination').total_items).toBe(0)
  })

  test('the banner is offered outside cross-project mode, and fetches IDs page by page', async () => {
    const firstPage = Array.from({ length: 500 }, (_, i) => ({ id: `nt_${i}` }))
    fetchNotificationFeed
      .mockResolvedValueOnce({ items: firstPage })
      .mockResolvedValueOnce({ items: [{ id: 'nt_500' }] })

    const wrapper = setupSelecting()
    wrapper.setState({ pagination: { total_items: 501 } })
    wrapper.instance().onSelectAllClick()
    expect(banner(wrapper).text()).toBe('All 3 loaded notifications are selected. Select all 501 notifications')

    banner(wrapper).find('a').simulate('click')
    wrapper.instance().onDeleteSelectedConfirm()
    await flushPromises()
    await flushPromises()

    expect(fetchNotificationFeed).toHaveBeenCalledTimes(2)
    expect(fetchNotificationFeed).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 500, limit: 500 }))
    expect(deleteMultipleNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notificationList: [...firstPage.map((n) => n.id), 'nt_500'] }),
    )
  })

  test('reloads the list when deleting everything fails', async () => {
    fetchNotificationFeed.mockRejectedValueOnce(new Error('network'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const onErrorCallback = jest.fn()

    const wrapper = setupSelecting({ ...projectProps, onErrorCallback })
    // getNotifications does nothing while a delete is in progress, so the reload needs isDeleting cleared first
    let stateAtReload
    wrapper.instance().getNotifications = jest.fn(() => (stateAtReload = { ...wrapper.instance().state }))

    wrapper.instance().onSelectAllClick()
    wrapper.instance().onSelectEverythingClick()
    wrapper.instance().onDeleteSelectedConfirm()
    await flushPromises()
    await flushPromises()

    expect(onErrorCallback).toHaveBeenCalled()
    expect(deleteMultipleNotifications).not.toHaveBeenCalled()
    expect(wrapper.instance().getNotifications).toHaveBeenCalledTimes(1)
    expect(stateAtReload.isDeleting).toBe(false)
    expect(stateAtReload.pagination).toEqual({})
    console.error.mockRestore()
  })

  test('reads every ID when the service returns fewer per page than asked for', async () => {
    const page = (start) => ({ items: Array.from({ length: 100 }, (_, i) => ({ id: `nt_${start + i}` })) })
    fetchNotificationFeed
      .mockResolvedValueOnce(page(0))
      .mockResolvedValueOnce(page(100))
      .mockResolvedValueOnce({ items: page(200).items.slice(0, 50) })

    const wrapper = setupSelecting(projectProps)
    wrapper.setState({ pagination: { total_items: 250 } })
    wrapper.instance().onSelectAllClick()
    wrapper.instance().onSelectEverythingClick()
    wrapper.instance().onDeleteSelectedConfirm()
    for (let i = 0; i < 4; i++) {
      await flushPromises()
    }

    expect(fetchNotificationFeed.mock.calls.map(([args]) => args.offset)).toEqual([0, 100, 200])
    expect(deleteMultipleNotifications.mock.calls[0][0].notificationList).toHaveLength(250)
  })

  test('stops fetching IDs when a page adds nothing new, e.g. a service that ignores the offset', async () => {
    fetchNotificationFeed.mockResolvedValue({ items: notificationList })

    const wrapper = setupSelecting(projectProps)
    wrapper.instance().onSelectAllClick()
    wrapper.instance().onSelectEverythingClick()
    wrapper.instance().onDeleteSelectedConfirm()
    for (let i = 0; i < 4; i++) {
      await flushPromises()
    }

    expect(fetchNotificationFeed).toHaveBeenCalledTimes(2)
    expect(deleteMultipleNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notificationList: ['nt_1', 'nt_2', 'nt_3'] }),
    )
    fetchNotificationFeed.mockImplementation(() => Promise.resolve({ items: [] }))
  })

  test('tells the host about a delete of everything, as Delete all does', async () => {
    const onConfirmCallback = jest.fn()
    const wrapper = setupSelecting({ ...projectProps, onConfirmCallback })
    wrapper.instance().onSelectAllClick()
    wrapper.instance().onSelectEverythingClick()
    wrapper.instance().onDeleteSelectedConfirm()
    await flushPromises()
    expect(onConfirmCallback).toHaveBeenCalledTimes(1)
  })

  test('clear selection in the banner unselects everything', () => {
    const wrapper = setupSelecting(projectProps)
    wrapper.instance().onSelectAllClick()
    wrapper.instance().onSelectEverythingClick()
    banner(wrapper).find('a').simulate('click')
    expect(wrapper.state('selectedNotifications')).toEqual([])
    expect(banner(wrapper).exists()).toBe(false)
  })

  test('unselecting one after selecting everything deletes only the checked notifications', () => {
    const wrapper = setupSelecting(projectProps)
    wrapper.instance().onSelectAllClick()
    wrapper.instance().onSelectEverythingClick()
    wrapper.instance().onNotificationItemClick(notificationList[0])
    expect(wrapper.find('.react-autoql-notification-delete-label').text()).toBe('Delete (2)')

    wrapper.instance().onDeleteSelectedConfirm()
    expect(deleteAllNotifications).not.toHaveBeenCalled()
    expect(deleteMultipleNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notificationList: ['nt_2', 'nt_3'] }),
    )
    expect(wrapper.state('pagination').total_items).toBe(23)
  })

  test('never offers to select everything across all projects', () => {
    const wrapper = setupSelecting({ enableFetchAllNotificationFeedAcrossProjects: true, selectedProjectId: 'all' })
    wrapper.instance().onSelectAllClick()
    expect(banner(wrapper).exists()).toBe(false)

    wrapper.instance().onSelectEverythingClick()
    wrapper.instance().onDeleteSelectedConfirm()
    expect(deleteAllNotifications).not.toHaveBeenCalled()
    expect(fetchNotificationFeed).not.toHaveBeenCalled()
    expect(deleteMultipleNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notificationList: ['nt_1', 'nt_2', 'nt_3'] }),
    )
  })

  test('does not show the banner when every notification is already loaded', () => {
    const wrapper = setupSelecting(projectProps)
    wrapper.setState({ pagination: { total_items: 3 } })
    wrapper.instance().onSelectAllClick()
    expect(banner(wrapper).exists()).toBe(false)
  })

  test('shows how many notifications will be deleted on the Delete button', () => {
    const wrapper = setupSelecting(projectProps)
    const deleteLabel = () => wrapper.find('.react-autoql-notification-delete-label').text()
    expect(deleteLabel()).toBe('Delete')

    wrapper.find('.notification-item-container').at(0).simulate('click', {})
    expect(deleteLabel()).toBe('Delete (1)')

    wrapper.find('.notification-item-container').at(1).simulate('click', {})
    expect(deleteLabel()).toBe('Delete (2)')
  })

  test('select all only deletes loaded notifications when a title filter is active', () => {
    const wrapper = setupSelecting({
      enableFetchAllNotificationFeedAcrossProjects: true,
      selectedProjectId: 'prj_1',
      notificationTitle: 'sales',
    })
    wrapper.instance().onSelectAllClick()
    expect(wrapper.instance().getDeleteSelectedTitle()).toBe('Delete 3 notifications?')

    wrapper.instance().onDeleteSelectedConfirm()
    expect(deleteAllNotifications).not.toHaveBeenCalled()
    expect(deleteMultipleNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notificationList: ['nt_1', 'nt_2', 'nt_3'] }),
    )
  })

  test('select all only deletes loaded notifications when the feed is not across projects', () => {
    const wrapper = setupSelecting()
    wrapper.instance().onSelectAllClick()
    wrapper.instance().onDeleteSelectedConfirm()
    expect(deleteAllNotifications).not.toHaveBeenCalled()
    expect(deleteMultipleNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notificationList: ['nt_1', 'nt_2', 'nt_3'] }),
    )
  })
})
