import React, { Fragment } from 'react'
// import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'

import { Modal } from '../../Modal'
import { Steps } from '../../Steps'
import { Input } from '../../Input'
import { Icon } from '../../Icon'
import { Checkbox } from '../../Checkbox'
// import { NotificationRules } from '../NotificationRules'
import { NotificationRulesCopy } from '../NotificationRulesCopy'

import './NotificationSettings.scss'

const notificationList = [
  {
    id: 1,
    displayName: 'Transactions exceeded $1000',
    expanded: false,
    enabled: true,
    // last_triggered: '2020-01-14T18:28:56.520Z',
    history: [],
    logic: {}
  },
  {
    id: 2,
    displayName: 'Over budget this month',
    expanded: false,
    enabled: true,
    // last_triggered: '2020-01-10T16:40:56.520Z',
    history: [],
    logic: {}
  },
  {
    id: 3,
    displayName: 'Balance fell below $500',
    expanded: false,
    enabled: false,
    // last_triggered: '2020-01-02T12:10:56.520Z',
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
    displayNameInput: '',
    isMessageChecked: true,
    messageInput: '',
    isRulesSectionComplete: false
  }

  // onItemClick = notification => {
  //   const newList = this.state.notificationList.map(n => {
  //     if (notification.id === n.id) {
  //       return {
  //         ...n,
  //         expanded: !n.expanded
  //       }
  //     }
  //     return {
  //       ...n,
  //       expanded: false
  //     }
  //   })
  //   this.setState({ notificationList: newList })
  // }

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
        isSavingNotification: false,

        eventBasedToggleValue: undefined,
        displayNameInput: '',
        isRulesSectionComplete: false
      })
    }, 2000)
  }

  onEnableSwitchChange = notification => {
    const newList = this.state.notificationList.map(n => {
      if (notification.id === n.id) {
        return {
          ...n,
          enabled: !n.enabled
        }
      }
      return n
    })
    this.setState({ notificationList: newList })
  }

  onRulesUpdate = (isRulesSectionComplete, rulesJSON) => {
    this.setState({ isRulesSectionComplete, rulesJSON })
  }

  renderDisplayNameStep = () => (
    <div>
      <Input
        className="chata-notification-display-name-input"
        placeholder="Title (max 50 characters)"
        icon="title"
        maxLength="50"
        value={this.state.displayNameInput}
        onChange={e => this.setState({ displayNameInput: e.target.value })}
      />
      {
        // <Checkbox checked={this.state.isMessageChecked} onChange={e => this.setState({ isMessageChecked: e.target.checked })} />
      }
      <Input
        className="chata-notification-message-input"
        placeholder="Notification Message (max 200 characters)"
        // icon="description"
        type="multi"
        maxLength="200"
        value={this.state.messageInput}
        onChange={e => this.setState({ messageInput: e.target.value })}
      />
    </div>
  )

  renderFrequencyStep = () => {
    return (
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

  isScheduleSectionComplete = () => {
    return true
  }

  getModalContent = () => {
    const steps = [
      {
        title: 'Appearance',
        content: this.renderDisplayNameStep(),
        complete: !!this.state.displayNameInput
      },
      {
        title: 'Notification Conditions',
        subtitle: 'Notify me when the following conditions are met',
        content: <NotificationRulesCopy onUpdate={this.onRulesUpdate} />,
        complete: this.state.isRulesSectionComplete
      },
      {
        title: 'Data Return',
        subtitle: 'Retrieve this data when the notification is clicked',
        content: (
          <div>
            {
              //   <div
              //   style={{
              //     marginLeft: '8px',
              //     marginBottom: '5px',
              //     color: 'rgba(0, 0, 0, 0.5)'
              //   }}
              // >
              //   Run this query when the user expands the notification:
              // </div>
            }

            <Input
              className="chata-notification-display-name-input"
              icon="chata-bubbles-outlined"
              placeholder="Query"
              value={this.state.dataReturnQueryInput}
              onChange={e =>
                this.setState({ dataReturnQueryInput: e.target.value })
              }
            />
          </div>
        ),
        complete: !!this.state.dataReturnQueryInput
      },
      {
        title: 'Frequency',
        content: this.renderFrequencyStep(),
        complete: this.isScheduleSectionComplete()
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

  renderABTestButtons = () => {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}
      >
        <div
          style={{
            padding: '10px',
            border: '1px solid',
            cursor: 'pointer',
            display: 'inline-block',
            margin: '10px'
          }}
          onClick={() => {
            this.onAddClick()
            this.setState({ option: 1 })
          }}
        >
          Modal Option 1
        </div>
        <div
          style={{
            padding: '10px',
            border: '1px solid',
            cursor: 'pointer',
            display: 'inline-block',
            margin: '10px'
          }}
          onClick={() => {
            this.onAddClick()
            this.setState({ option: 2 })
          }}
        >
          Modal Option 2
        </div>
      </div>
    )
  }

  render = () => {
    return (
      <div data-test="notification-settings">
        <ReactTooltip
          className="chata-drawer-tooltip"
          id="chata-notification-settings-tooltip"
          effect="solid"
          delayShow={500}
          html
        />
        {this.renderAddNotificationButton()}
        {
          // this.renderABTestButtons()
        }
        <div className="chata-notification-settings-container">
          {this.state.notificationList.map((notification, i) => {
            return (
              <div
                key={`chata-notification-setting-item-${i}`}
                className={`chata-notification-setting-item
                          ${notification.expanded ? ' expanded' : ''}`}
                onClick={e => this.onEditClick(e, notification)}
              >
                <div className="chata-notification-setting-item-header">
                  <div className="chata-notification-setting-display-name">
                    {notification.displayName}
                  </div>
                  <div className="chata-notification-setting-actions">
                    <Checkbox
                      type="switch"
                      checked={notification.enabled}
                      className="chata-notification-enable-checkbox"
                      onClick={e => e.stopPropagation()}
                      data-tip={notification.enabled ? 'Disable' : 'Enable'}
                      data-for="chata-notification-settings-tooltip"
                      onChange={e => {
                        this.onEnableSwitchChange(notification)
                        ReactTooltip.hide()
                        ReactTooltip.rebuild()
                      }}
                    />
                  </div>
                </div>
                {notification.expanded && <div></div>}
              </div>
            )
          })}
        </div>
        {this.renderNotificationEditModal()}
      </div>
    )
  }
}
