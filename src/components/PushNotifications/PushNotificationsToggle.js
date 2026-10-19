import React from 'react'
import PropTypes from 'prop-types'

import { Switch } from '../Switch'
import { PUSH_NOTIFICATION_STATUS, usePushNotifications } from './PushNotificationsProvider'

import './PushNotificationsToggle.scss'

/**
 * A ready-made switch for push notifications, for a settings page. It hides itself in browsers without web push,
 * and explains what to do when the user has blocked notifications in the browser.
 */
export const PushNotificationsToggle = ({
  label = 'Browser notifications',
  description = 'Get a notification on this device when a Data Alert fires, even when the app is closed.',
  blockedMessage = 'Notifications are blocked for this site. Allow them in your browser settings, then try again.',
  errorMessage = "Couldn't change notifications. Try again.",
  className = '',
}) => {
  const { status, isBusy, error, enable, disable } = usePushNotifications()

  if (status === PUSH_NOTIFICATION_STATUS.UNSUPPORTED) {
    return null
  }

  const isBlocked = status === PUSH_NOTIFICATION_STATUS.BLOCKED

  let message = description
  if (isBlocked) {
    message = blockedMessage
  } else if (error) {
    message = errorMessage
  }

  return (
    <div className={`react-autoql-push-notifications-toggle ${className}`} data-test='react-autoql-push-toggle'>
      <div className='react-autoql-push-notifications-toggle-text'>
        <span className='react-autoql-push-notifications-toggle-label'>{label}</span>
        {message ? (
          <span
            className={`react-autoql-push-notifications-toggle-message ${
              isBlocked || error ? 'react-autoql-push-notifications-toggle-message-warning' : ''
            }`}
            data-test='react-autoql-push-toggle-message'
          >
            {message}
          </span>
        ) : null}
      </div>
      <Switch
        className=''
        aria-label={label}
        checked={status === PUSH_NOTIFICATION_STATUS.ON}
        disabled={isBusy || isBlocked || status === PUSH_NOTIFICATION_STATUS.CHECKING}
        onChange={(checked) => (checked ? enable() : disable())}
      />
    </div>
  )
}

PushNotificationsToggle.propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
  blockedMessage: PropTypes.string,
  errorMessage: PropTypes.string,
  className: PropTypes.string,
}
