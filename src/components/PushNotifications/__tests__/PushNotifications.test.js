import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import * as feUtils from 'autoql-fe-utils'

import { PushNotificationsProvider, PushNotificationsToggle, usePushNotifications } from '..'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  PUSH_SERVICE_WORKER_URL: '/push-sw.js',
  isPushSupported: jest.fn(),
  getPushPermission: jest.fn(),
  isPushEnabled: jest.fn(),
  enablePushNotifications: jest.fn(),
  disablePushNotifications: jest.fn(),
  syncPushSubscription: jest.fn(),
  listenForPushMessages: jest.fn(),
}))

const authentication = { token: 'token-1', apiKey: 'api-key', domain: 'https://autoql.test' }

let pushHandlers
let stopListening

beforeEach(() => {
  jest.clearAllMocks()
  feUtils.isPushSupported.mockReturnValue(true)
  feUtils.getPushPermission.mockReturnValue('default')
  feUtils.isPushEnabled.mockResolvedValue(false)
  feUtils.enablePushNotifications.mockResolvedValue('enabled')
  feUtils.disablePushNotifications.mockResolvedValue({ serverDeleted: true })
  feUtils.syncPushSubscription.mockResolvedValue('off')
  stopListening = jest.fn()
  feUtils.listenForPushMessages.mockImplementation((handlers) => {
    pushHandlers = handlers
    return stopListening
  })
})

const renderToggle = (providerProps = {}) =>
  render(
    <PushNotificationsProvider authentication={authentication} {...providerProps}>
      <PushNotificationsToggle />
    </PushNotificationsProvider>,
  )

const getSwitch = () => screen.getByRole('checkbox', { name: 'Browser notifications' })
const getToggleMessage = () => screen.getByTestId('react-autoql-push-toggle-message')

// jsdom has no Permissions API. This stands in for navigator.permissions and returns the PermissionStatus it hands out
const mockPermissionsApi = () => {
  const permissionStatus = { state: 'denied', onchange: null }
  Object.defineProperty(navigator, 'permissions', {
    value: { query: jest.fn().mockResolvedValue(permissionStatus) },
    configurable: true,
  })
  return permissionStatus
}

afterEach(() => {
  delete navigator.permissions
})

describe('PushNotificationsToggle', () => {
  test('renders nothing in browsers without web push', () => {
    feUtils.isPushSupported.mockReturnValue(false)
    const { container } = renderToggle()
    expect(container).toBeEmptyDOMElement()
    expect(feUtils.syncPushSubscription).not.toHaveBeenCalled()
  })

  test('turns push on from the switch', async () => {
    renderToggle()
    await waitFor(() => expect(getSwitch()).toBeEnabled())
    expect(getSwitch()).not.toBeChecked()

    feUtils.isPushEnabled.mockResolvedValue(true)
    fireEvent.click(getSwitch())

    await waitFor(() => expect(getSwitch()).toBeChecked())
    expect(feUtils.enablePushNotifications).toHaveBeenCalledWith({
      authentication,
      serviceWorkerUrl: '/push-sw.js',
      scope: undefined,
    })
  })

  test('turns push off from the switch', async () => {
    feUtils.isPushEnabled.mockResolvedValue(true)
    renderToggle()
    await waitFor(() => expect(getSwitch()).toBeChecked())

    feUtils.isPushEnabled.mockResolvedValue(false)
    fireEvent.click(getSwitch())

    await waitFor(() => expect(getSwitch()).not.toBeChecked())
    expect(feUtils.disablePushNotifications).toHaveBeenCalledWith(expect.objectContaining({ authentication }))
  })

  test('the slider takes clicks once the status check finishes', async () => {
    // Real users click the slider: the input is hidden. jsdom delivers clicks whatever the CSS says, so check the
    // style the browser goes by
    const { container } = renderToggle()
    const slider = container.querySelector('.toggle-switch-slider')
    await waitFor(() => expect(slider).toHaveStyle({ pointerEvents: 'auto' }))

    fireEvent.click(slider)

    await waitFor(() => expect(feUtils.enablePushNotifications).toHaveBeenCalled())
  })

  test('clears a browser block when the permission changes in site settings', async () => {
    const permissionStatus = mockPermissionsApi()
    feUtils.getPushPermission.mockReturnValue('denied')
    renderToggle()
    await waitFor(() => expect(getToggleMessage()).toHaveTextContent('blocked'))
    await waitFor(() => expect(permissionStatus.onchange).toEqual(expect.any(Function)))

    feUtils.getPushPermission.mockReturnValue('default')
    act(() => permissionStatus.onchange())

    await waitFor(() => expect(getSwitch()).toBeEnabled())
    expect(getToggleMessage()).not.toHaveTextContent('blocked')
  })

  test('clears a browser block when the user comes back to the tab', async () => {
    feUtils.getPushPermission.mockReturnValue('denied')
    renderToggle()
    await waitFor(() => expect(getToggleMessage()).toHaveTextContent('blocked'))

    feUtils.getPushPermission.mockReturnValue('granted')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(getSwitch()).toBeEnabled())
  })

  test('explains a browser block and disables the switch', async () => {
    feUtils.getPushPermission.mockReturnValue('denied')
    renderToggle()

    await waitFor(() => expect(screen.getByTestId('react-autoql-push-toggle-message')).toHaveTextContent('blocked'))
    expect(getSwitch()).toBeDisabled()
  })

  test('says so when turning push on fails', async () => {
    feUtils.enablePushNotifications.mockRejectedValue(new Error('network down'))
    renderToggle()
    await waitFor(() => expect(getSwitch()).toBeEnabled())

    fireEvent.click(getSwitch())

    await waitFor(() => expect(screen.getByTestId('react-autoql-push-toggle-message')).toHaveTextContent("Couldn't"))
    expect(getSwitch()).not.toBeChecked()
  })

  test('uses the app’s own service worker when serviceWorkerUrl is null', async () => {
    renderToggle({ serviceWorkerUrl: null })
    await waitFor(() => expect(getSwitch()).toBeEnabled())

    fireEvent.click(getSwitch())

    await waitFor(() =>
      expect(feUtils.enablePushNotifications).toHaveBeenCalledWith(expect.objectContaining({ serviceWorkerUrl: null })),
    )
  })
})

describe('PushNotificationsProvider', () => {
  test('saves the subscription again once per sign-in', async () => {
    const { rerender } = render(<PushNotificationsProvider authentication={authentication} />)
    await waitFor(() => expect(feUtils.syncPushSubscription).toHaveBeenCalledTimes(1))
    expect(feUtils.syncPushSubscription).toHaveBeenCalledWith(expect.objectContaining({ authentication }))

    // A token refresh isn't a new sign-in
    rerender(<PushNotificationsProvider authentication={{ ...authentication, token: 'token-2' }} />)
    // Signing out, then in again, is
    rerender(<PushNotificationsProvider authentication={{}} />)
    rerender(<PushNotificationsProvider authentication={{ ...authentication, token: 'token-3' }} />)

    await waitFor(() => expect(feUtils.syncPushSubscription).toHaveBeenCalledTimes(2))
  })

  test('sends clicks to onNotificationClick and new alerts to onPushReceived', async () => {
    const onNotificationClick = jest.fn()
    const onPushReceived = jest.fn()
    const { unmount } = render(
      <PushNotificationsProvider
        authentication={authentication}
        onNotificationClick={onNotificationClick}
        onPushReceived={onPushReceived}
      />,
    )
    await waitFor(() => expect(feUtils.listenForPushMessages).toHaveBeenCalled())

    pushHandlers.onClick('/notifications/7', { id: '7' })
    pushHandlers.onReceived({ id: '7' })
    expect(onNotificationClick).toHaveBeenCalledWith('/notifications/7', { id: '7' })
    expect(onPushReceived).toHaveBeenCalledWith({ id: '7' })

    // The browser replaced the subscription: save the new one
    pushHandlers.onSubscriptionChange()
    await waitFor(() => expect(feUtils.syncPushSubscription).toHaveBeenCalledTimes(2))

    unmount()
    expect(stopListening).toHaveBeenCalled()
  })

  test('usePushNotifications needs the provider', () => {
    const Consumer = () => {
      usePushNotifications()
      return null
    }
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Consumer />)).toThrow('PushNotificationsProvider')

    consoleError.mockRestore()
  })
})
