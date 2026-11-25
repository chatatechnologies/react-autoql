import React from 'react'
import { shallow } from 'enzyme'
import { deleteAllNotifications, deleteMultipleNotifications } from 'autoql-fe-utils'

import { findByTestAttr } from '../../../../test/testUtils'
import { testAuthentication } from '../../../../test/testData'
import NotificationFeed from './NotificationFeed'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  deleteAllNotifications: jest.fn(),
  deleteMultipleNotifications: jest.fn(),
}))

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

  test('deleting after select all deletes every notification in the selected project', () => {
    const wrapper = setupSelecting({ enableFetchAllNotificationFeedAcrossProjects: true, selectedProjectId: 'prj_1' })
    wrapper.instance().onSelectAllClick()
    expect(wrapper.instance().getDeleteSelectedTitle()).toMatch(/^Delete all 25 notifications/)

    wrapper.instance().onDeleteSelectedConfirm()
    expect(deleteAllNotifications).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'prj_1' }))
    expect(deleteMultipleNotifications).not.toHaveBeenCalled()
    expect(wrapper.state('notificationList')).toEqual([])
    expect(wrapper.state('pagination').total_items).toBe(0)
  })

  test('deleting after select all then unselecting one deletes only the checked notifications', () => {
    const wrapper = setupSelecting({ enableFetchAllNotificationFeedAcrossProjects: true, selectedProjectId: 'prj_1' })
    wrapper.instance().onSelectAllClick()
    wrapper.instance().onNotificationItemClick(notificationList[0])

    wrapper.instance().onDeleteSelectedConfirm()
    expect(deleteAllNotifications).not.toHaveBeenCalled()
    expect(deleteMultipleNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notificationList: ['nt_2', 'nt_3'] }),
    )
    expect(wrapper.state('pagination').total_items).toBe(23)
  })

  test('shows how many notifications will be deleted on the Delete button', () => {
    const wrapper = setupSelecting({ enableFetchAllNotificationFeedAcrossProjects: true, selectedProjectId: 'prj_1' })
    const deleteLabel = () => wrapper.find('.react-autoql-notification-delete-label').text()
    expect(deleteLabel()).toBe('Delete')

    wrapper.find('.notification-item-container').at(0).simulate('click', {})
    expect(deleteLabel()).toBe('Delete (1)')

    wrapper.find('.react-autoql-notification-select-all').simulate('click')
    expect(deleteLabel()).toBe('Delete (25)')

    wrapper.find('.notification-item-container').at(0).simulate('click', {})
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
