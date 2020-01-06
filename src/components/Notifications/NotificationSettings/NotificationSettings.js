import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'

import { Modal } from '../../Modal'
import { Steps } from '../../Steps'
import { Input } from '../../Input'
import { Icon } from '../../Icon'
import { NotificationRules } from '../NotificationRules'

import './NotificationSettings.scss'

const notificationList = [
  {
    id: 1,
    displayName: 'Transactions exceeded $1000',
    expanded: false,
    last_triggered: new Date(),
    history: [],
    logic: {}
  },
  {
    id: 2,
    displayName: 'Over budget this month',
    expanded: false,
    last_triggered: new Date(),
    history: [],
    logic: {}
  },
  {
    id: 3,
    displayName: 'Balance fell below $500',
    expanded: false,
    last_triggered: new Date(),
    history: [],
    logic: {}
  }
]

export default class NotificationSettings extends React.Component {
  static propTypes = {}

  state = {
    notificationList: notificationList,
    isEditModalVisible: false,
    activeNotification: undefined,

    eventBasedToggleValue: undefined,
    displayNameInput: ''
  }

  onItemClick = notification => {
    const newList = this.state.notificationList.map(n => {
      if (notification.id === n.id) {
        return {
          ...n,
          expanded: !n.expanded
        }
      }
      return {
        ...n,
        expanded: false
      }
    })
    this.setState({ notificationList: newList })
  }

  onEditClick = (e, notification) => {
    e.stopPropagation()
    this.setState({
      isEditModalVisible: true,
      activeNotification: notification
    })
  }

  onAddClick = () => {
    this.setState({
      isEditModalVisible: true,
      activeNotification: {}
    })
  }

  onNotificationSave = () => {
    this.setState({
      isSavingNotification: true
    })

    setTimeout(() => {
      this.setState({
        isEditModalVisible: false,
        activeNotification: undefined,
        isSavingNotification: false
      })
    }, 2000)
  }

  getModalContent = () => {
    const steps = [
      {
        // step: 1,
        title: 'Display Name',
        content: (
          <div>
            <Input
              className="chata-notification-display-name-input"
              value={this.state.displayNameInput}
              onChange={e =>
                this.setState({ displayNameInput: e.target.value })
              }
            />
          </div>
        ),
        complete: !!this.state.displayNameInput
      },
      {
        // step: 2,
        title: 'Rules',
        content: <NotificationRules />
      },
      {
        // step: 3,
        title: 'Schedule',
        content: (
          <div>
            {
              // <Checkbox
              //   type="switch"
              //   label="Event Based"
              //   checked={this.state.eventBasedToggleValue}
              //   onChange={e =>
              //     this.setState({ eventBasedToggleValue: e.target.checked })
              //   }
              // />
            }
          </div>
        )
      }
    ]
    return steps
  }

  renderNotificationEditModal = () => {
    const steps = this.getModalContent()

    return (
      <Modal
        title="Custom Notification"
        isVisible={this.state.isEditModalVisible}
        onClose={() => this.setState({ isEditModalVisible: false })}
        onConfirm={this.onNotificationSave}
        confirmLoading={this.state.isSavingNotification}
        confirmText="Save"
        enableBodyScroll
        width="85vw"
        style={{ marginTop: '45px', maxWidth: '1000px', maxHeight: '85vh' }}
        confirmDisabled={!!steps.find(step => !step.complete)}
        // height: PropTypes.number,
        // showCancelButton: PropTypes.bool,
        // showFooter: PropTypes.bool,
      >
        <Steps steps={steps} />
      </Modal>
    )
  }

  renderAddNotificationButton = () => (
    <div className="chata-notification-add-btn-container">
      <div className="chata-notification-add-btn" onClick={this.onAddClick}>
        <Icon type="plus" className="chata-notification-add-icon" />
      </div>
    </div>
  )

  render = () => {
    return (
      <Fragment data-test="notification-settings">
        {this.renderAddNotificationButton()}
        <div className="chata-notification-settings-container">
          {this.state.notificationList.map((notification, i) => {
            return (
              <div
                key={`chata-notification-setting-item-${i}`}
                className={`chata-notification-setting-item
                          ${notification.expanded ? ' expanded' : ''}`}
                onClick={() => this.onItemClick(notification)}
              >
                <div className="chata-notification-setting-item-header">
                  <div className="chata-notification-setting-display-name">
                    {notification.displayName}
                  </div>
                  <Icon
                    type="edit"
                    className="chata-notification-edit-icon"
                    onClick={e => this.onEditClick(e, notification)}
                  />
                </div>
                {notification.expanded && <div></div>}
              </div>
            )
          })}
        </div>
        {this.renderNotificationEditModal()}
      </Fragment>
    )
  }
}
