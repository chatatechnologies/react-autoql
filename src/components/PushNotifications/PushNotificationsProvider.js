import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  PUSH_SERVICE_WORKER_URL,
  disablePushNotifications,
  enablePushNotifications,
  getPushPermission,
  isPushEnabled,
  isPushSupported,
  listenForPushMessages,
  syncPushSubscription,
} from 'autoql-fe-utils'

import { authenticationType } from '../../props/types'

export const PUSH_NOTIFICATION_STATUS = {
  UNSUPPORTED: 'unsupported',
  CHECKING: 'checking',
  ON: 'on',
  OFF: 'off',
  BLOCKED: 'blocked',
}

const PushNotificationsContext = createContext(null)

const hasAuthentication = (authentication) =>
  !!(authentication?.domain && authentication?.apiKey && authentication?.token)

/**
 * Push notifications for Data Alerts. Wrap the app in this provider once, then use usePushNotifications or
 * PushNotificationsToggle anywhere inside it. The provider:
 * - saves this browser's subscription again once credentials are available, because browsers replace
 *   subscriptions from time to time
 * - sends notification clicks to onNotificationClick, so the app's router handles them
 * - calls onPushReceived when an alert arrives while the app is open, for example to refresh an unread badge
 */
export const PushNotificationsProvider = ({
  authentication = {},
  serviceWorkerUrl = PUSH_SERVICE_WORKER_URL,
  scope,
  onNotificationClick,
  onPushReceived,
  children = null,
}) => {
  const isSupported = useMemo(() => isPushSupported(), [])
  const [status, setStatus] = useState(
    isSupported ? PUSH_NOTIFICATION_STATUS.CHECKING : PUSH_NOTIFICATION_STATUS.UNSUPPORTED,
  )
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState(null)

  // Read the latest props through refs, so token refreshes don't recreate the callbacks or rerun the effects
  const optionsRef = useRef()
  optionsRef.current = { authentication, serviceWorkerUrl, scope }
  const handlersRef = useRef()
  handlersRef.current = { onNotificationClick, onPushReceived }

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const updateStatus = useCallback(async () => {
    if (!isSupported) {
      return
    }

    const isEnabled = await isPushEnabled({ scope: optionsRef.current.scope }).catch(() => false)
    let nextStatus = PUSH_NOTIFICATION_STATUS.OFF
    if (isEnabled) {
      nextStatus = PUSH_NOTIFICATION_STATUS.ON
    } else if (getPushPermission() === 'denied') {
      nextStatus = PUSH_NOTIFICATION_STATUS.BLOCKED
    }

    if (isMountedRef.current) {
      setStatus(nextStatus)
    }
  }, [isSupported])

  const sync = useCallback(async () => {
    if (!isSupported) {
      return
    }

    try {
      await syncPushSubscription(optionsRef.current)
    } catch (syncError) {
      // Nothing to show: the next load tries again
    }

    await updateStatus()
  }, [isSupported, updateStatus])

  useEffect(() => {
    updateStatus()
  }, [updateStatus])

  // People unblock (or block) notifications in the browser's site settings, outside the app. Check again when the
  // Permissions API reports a change, and whenever the tab becomes visible, so the toggle doesn't stay blocked
  // until a reload.
  useEffect(() => {
    if (!isSupported) {
      return undefined
    }

    let isActive = true
    let permissionStatus
    const onPermissionChange = () => updateStatus()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateStatus()
      }
    }

    try {
      navigator.permissions
        ?.query({ name: 'notifications' })
        .then((result) => {
          if (isActive) {
            permissionStatus = result
            permissionStatus.onchange = onPermissionChange
          }
        })
        .catch(() => {
          // Not every browser can query this permission. The visibility check still covers it
        })
    } catch (permissionError) {
      // Same, for browsers that throw instead of rejecting
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      isActive = false
      if (permissionStatus) {
        permissionStatus.onchange = null
      }
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isSupported, updateStatus])

  // Once per sign-in, make the server match this browser
  const isSignedIn = hasAuthentication(authentication)
  const hasSyncedRef = useRef(false)
  useEffect(() => {
    if (!isSupported || !isSignedIn) {
      hasSyncedRef.current = false
      return
    }

    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true
      sync()
    }
  }, [isSupported, isSignedIn, sync])

  useEffect(() => {
    if (!isSupported) {
      return undefined
    }

    return listenForPushMessages({
      onClick: (url, data) => {
        const { onNotificationClick: onClick } = handlersRef.current
        if (onClick) {
          onClick(url, data)
        } else {
          window.location.assign(url)
        }
      },
      onReceived: (data) => handlersRef.current.onPushReceived?.(data),
      onSubscriptionChange: () => sync(),
    })
  }, [isSupported, sync])

  const enable = useCallback(async () => {
    if (!isSupported) {
      return false
    }

    setIsBusy(true)
    setError(null)

    try {
      const result = await enablePushNotifications(optionsRef.current)
      return result === 'enabled'
    } catch (enableError) {
      if (isMountedRef.current) {
        setError(enableError)
      }
      return false
    } finally {
      await updateStatus()
      if (isMountedRef.current) {
        setIsBusy(false)
      }
    }
  }, [isSupported, updateStatus])

  // Call this on logout too, so the next person who signs in on this browser doesn't get these alerts
  const disable = useCallback(async () => {
    if (!isSupported) {
      return
    }

    setIsBusy(true)
    setError(null)

    try {
      await disablePushNotifications(optionsRef.current)
    } catch (disableError) {
      if (isMountedRef.current) {
        setError(disableError)
      }
    } finally {
      await updateStatus()
      if (isMountedRef.current) {
        setIsBusy(false)
      }
    }
  }, [isSupported, updateStatus])

  const value = useMemo(
    () => ({
      isSupported,
      status,
      isEnabled: status === PUSH_NOTIFICATION_STATUS.ON,
      isBusy,
      error,
      enable,
      disable,
      sync,
    }),
    [isSupported, status, isBusy, error, enable, disable, sync],
  )

  return <PushNotificationsContext.Provider value={value}>{children}</PushNotificationsContext.Provider>
}

PushNotificationsProvider.propTypes = {
  authentication: authenticationType,
  /** Where the app serves push-sw.js. Pass null when the app's own service worker imports push-sw.js. */
  serviceWorkerUrl: PropTypes.string,
  /** Service worker scope. Leave it out to use the scope of the current page. */
  scope: PropTypes.string,
  /** Called with the notification's URL when the user clicks a notification. Defaults to a full page load. */
  onNotificationClick: PropTypes.func,
  /** Called when an alert arrives while the app is open. */
  onPushReceived: PropTypes.func,
  children: PropTypes.node,
}

export const usePushNotifications = () => {
  const context = useContext(PushNotificationsContext)
  if (!context) {
    throw new Error('usePushNotifications has to be used inside PushNotificationsProvider')
  }

  return context
}
