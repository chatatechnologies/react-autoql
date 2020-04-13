import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import _get from 'lodash.get'

import { Modal } from '../../Modal'
import { Steps } from '../../Steps'
import { Input } from '../../Input'
import { Icon } from '../../Icon'
import { Select } from '../../Select'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { WeekSelect } from '../../DateSelect/WeekSelect'
import { MonthSelect } from '../../DateSelect/MonthSelect'
import { YearSelect } from '../../DateSelect/YearSelect'
import { NotificationRulesCopy } from '../NotificationRulesCopy'

import { getScheduleDescription } from '../helpers'
import {
  createNotificationRule,
  deleteNotificationRule,
  fetchNotificationSettings,
  updateNotificationRule,
  updateNotificationRuleStatus
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './NotificationSettings.scss'

export default class NotificationSettings extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onErrorCallback: () => {}
  }

  state = {
    isFetchingList: true,
    ruleList: [],
    isEditModalVisible: false,
    activeRule: undefined,

    titleInput: '',
    messageInput: '',
    isRulesSectionComplete: false,
    rulesJSON: [],
    dataReturnQueryInput: '',
    isDataReturnDirty: false,
    frequencyCategorySelectValue: 'SINGLE_EVENT',
    frequencySelectValue: 'MONTH',
    weekSelectValue: [2],
    monthSelectValue: [1],
    yearSelectValue: [1],
    everyCheckboxValue: false
  }

  componentDidMount = () => {
    this.getNotificationSettings()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      this.state.frequencyCategorySelectValue !==
      prevState.frequencyCategorySelectValue
    ) {
      // Reset checkbox and frequency select values
      this.setState({
        everyCheckboxValue: false,
        frequencySelectValue: 'MONTH',
        weekSelectValue: [2],
        monthSelectValue: [1],
        yearSelectValue: [1]
      })
    }
  }

  getNotificationSettings = () => {
    fetchNotificationSettings({
      ...this.props.authentication
    })
      .then(list => {
        this.setState({
          ruleList: list,
          isFetchingList: false
        })
      })
      .catch(error => {
        console.error(error)
        this.setState({
          isFetchingList: false
        })
      })
  }

  onEditClick = (e, notification) => {
    e.stopPropagation()
    this.setState({
      isEditModalVisible: true,
      activeRule: notification,

      titleInput: notification.title,
      messageInput: notification.message,
      dataReturnQueryInput: notification.query,
      isDataReturnDirty: true,
      frequencyCategorySelectValue: notification.notification_type,
      frequencySelectValue: notification.reset_period || undefined,
      everyCheckboxValue:
        notification.notification_type === 'SINGLE_EVENT' &&
        !!notification.reset_period

      // weekSelectValue: [2],
      // monthSelectValue: [1],
      // yearSelectValue: [1],
    })
  }

  onAddClick = () => {
    this.setState({
      isEditModalVisible: true,
      activeRule: undefined,
      titleInput: '',
      messageInput: '',
      isRulesSectionComplete: false,
      rulesJSON: [],
      dataReturnQueryInput: '',
      isDataReturnDirty: false,
      frequencyCategorySelectValue: 'SINGLE_EVENT',
      frequencySelectValue: 'MONTH',
      everyCheckboxValue: false
    })
  }

  getActiveRuleData = () => {
    const {
      titleInput,
      dataReturnQueryInput,
      messageInput,
      frequencyCategorySelectValue,
      everyCheckboxValue,
      frequencySelectValue,
      rulesJSON,
      activeRule
    } = this.state

    const newRule = {
      id: _get(activeRule, 'id'),
      title: titleInput,
      query: dataReturnQueryInput,
      message: messageInput,
      notification_type: frequencyCategorySelectValue,
      cycle: frequencyCategorySelectValue === 'REPEAT_EVENT' ? 'WEEK' : null, // Hardcoded WEEK for MVP
      reset_period:
        !everyCheckboxValue || frequencyCategorySelectValue === 'REPEAT_EVENT'
          ? null
          : frequencySelectValue,
      day_numbers:
        frequencyCategorySelectValue === 'REPEAT_EVENT'
          ? [1, 2, 3, 4, 5, 6, 7] // Hardcoded for MVP
          : null,
      // Commenting out for MVP
      // month_number: [],
      // run_times: [],
      expression: rulesJSON
    }

    return newRule
  }

  onRuleSave = () => {
    this.setState({
      isSavingRule: true
    })

    var newRuleList = [...this.state.ruleList]
    const newRule = this.getActiveRuleData()
    const requestParams = {
      rule: newRule,
      ...this.props.authentication
    }

    if (newRule.id) {
      updateNotificationRule({
        ...requestParams
      })
        .then(ruleResponse => {
          newRuleList = this.state.ruleList.map(r => {
            if (r.id === newRule.id) {
              return _get(ruleResponse, 'data.data', newRule)
            }
            return r
          })
          this.setState({
            ruleList: newRuleList,
            isEditModalVisible: false,
            activeRule: undefined,
            isSavingRule: false
          })
        })
        .catch(error => {
          console.error(error)
          this.props.onErrorCallback(error)
          this.setState({
            isSavingRule: false
          })
        })
    } else {
      createNotificationRule({
        ...requestParams
      })
        .then(ruleResponse => {
          if (_get(ruleResponse, 'data.data')) {
            newRuleList.unshift(_get(ruleResponse, 'data.data'))
          }
          this.setState({
            ruleList: newRuleList,
            isEditModalVisible: false,
            activeRule: undefined,
            isSavingRule: false
          })
        })
        .catch(error => {
          console.error(error)
          this.props.onErrorCallback(error)
          this.setState({
            isSavingRule: false
          })
        })
    }
  }

  onRuleDelete = () => {
    const ruleId = _get(this.state.activeRule, 'id')
    if (ruleId) {
      this.setState({
        isDeletingRule: true
      })

      deleteNotificationRule({ ruleId, ...this.props.authentication })
        .then(() => {
          const newList = this.state.ruleList.filter(rule => rule.id !== ruleId)
          this.setState({
            ruleList: newList,
            isDeletingRule: false,
            isEditModalVisible: false
          })
        })
        .catch(error => {
          console.error(error)
          this.props.onErrorCallback(error)
          this.setState({
            isDeletingRule: false
          })
        })
    }
  }

  onEnableSwitchChange = (e, rule) => {
    const newStatus = e.target.checked ? 'ACTIVE' : 'INACTIVE'
    const newList = this.state.ruleList.map(n => {
      if (rule.id === n.id) {
        return {
          ...n,
          status: newStatus
        }
      }
      return n
    })

    this.setState({ ruleList: newList })

    updateNotificationRuleStatus({
      ruleId: rule.id,
      status: newStatus,
      ...this.props.authentication
    }).catch(error => {
      console.error(error)
      this.props.onErrorCallback(error)
    })
  }

  onRulesUpdate = (isRulesSectionComplete, rulesJSON) => {
    this.setState({ isRulesSectionComplete, rulesJSON })
  }

  rendertitleStep = () => (
    <div>
      <Input
        className="chata-notification-display-name-input"
        placeholder="Title (max 50 characters)"
        icon="title"
        maxLength="50"
        value={this.state.titleInput}
        onChange={e => this.setState({ titleInput: e.target.value })}
      />
      <Input
        className="chata-notification-message-input"
        placeholder="Notification Message (max 200 characters)"
        type="multi"
        maxLength="200"
        value={this.state.messageInput}
        onChange={e => this.setState({ messageInput: e.target.value })}
      />
    </div>
  )

  renderFrequencySelector = options => {
    return (
      <Select
        options={options}
        className="notification-frequency-select"
        value={this.state.frequencySelectValue}
        onChange={value => this.setState({ frequencySelectValue: value })}
      />
    )
  }

  renderWeekSelector = () => (
    <WeekSelect
      multiSelect
      value={this.state.weekSelectValue}
      onChange={value => this.setState({ weekSelectValue: value })}
    />
  )

  renderMonthSelector = () => (
    <MonthSelect
      multiSelect
      value={this.state.monthSelectValue}
      onChange={value => this.setState({ monthSelectValue: value })}
    />
  )

  renderYearSelector = () => (
    <YearSelect
      multiSelect
      value={this.state.yearSelectValue}
      onChange={value => this.setState({ yearSelectValue: value })}
    />
  )

  renderDateSelector = type => {
    let selector
    switch (type) {
      case 'WEEK': {
        selector = this.renderWeekSelector()
        break
      }
      case 'MONTH': {
        selector = this.renderMonthSelector()
        break
      }
      case 'YEAR': {
        selector = this.renderYearSelector()
        break
      }
      default: {
        return null
      }
    }

    return <div className="frequency-date-select-container">{selector}</div>
  }

  renderRepeatCheckbox = label => {
    return (
      <Checkbox
        label={label}
        className="frequency-repeat-checkbox"
        checked={this.state.everyCheckboxValue}
        onChange={e => {
          this.setState({ everyCheckboxValue: e.target.checked })
        }}
      />
    )
  }

  renderFrequencyDescription = () => {
    let selection
    if (this.state.frequencySelectValue === 'WEEK') {
      selection = this.state.weekSelectValue
    } else if (this.state.frequencySelectValue === 'MONTH') {
      selection = this.state.monthSelectValue
    } else if (this.state.frequencySelectValue === 'YEAR') {
      selection = this.state.yearSelectValue
    }

    const description = getScheduleDescription(
      this.state.frequencyCategorySelectValue,
      this.state.frequencySelectValue,
      this.state.everyCheckboxValue,
      selection
    )

    return (
      <div className="frequency-description-box">
        <div className="frequency-description-title">Description:</div>
        {description}
      </div>
    )
  }

  renderFrequencyStep = () => {
    return (
      <div className="notification-frequency-step">
        <div className="frequency-settings-container">
          Notify me{' '}
          <Select
            options={[
              { value: 'SINGLE_EVENT', label: 'Once, when this happens' },
              { value: 'REPEAT_EVENT', label: 'Every time this happens' }
              // Commenting out for MVP
              // { value: 'SCHEDULE', label: 'On a schedule' }
            ]}
            value={this.state.frequencyCategorySelectValue}
            onChange={value =>
              this.setState({ frequencyCategorySelectValue: value })
            }
          />
          {this.state.frequencyCategorySelectValue === 'SINGLE_EVENT' && (
            <div className="frequency-category-select">
              {this.renderRepeatCheckbox('Repeat')}
              {this.state.everyCheckboxValue && (
                <Fragment>
                  {this.renderFrequencySelector([
                    { value: 'DAY', label: 'Daily' },
                    { value: 'WEEK', label: 'Weekly' },
                    { value: 'MONTH', label: 'Monthly' }
                    // Commenting out for MVP
                    // { value: 'YEAR', label: 'Yearly' }
                  ])}
                  {
                    // Commenting out for MVP
                    // {this.state.frequencySelectValue !== 'DAY' && (
                    //   <span className="frequency-repeat-follow-text"> on:</span>
                    // )}
                    // {this.renderDateSelector(this.state.frequencySelectValue)}
                  }
                </Fragment>
              )}
            </div>
          )}
          {
            // Commenting out for MVP
            //   this.state.frequencyCategorySelectValue === 'REPEAT_EVENT' && (
            //   <div className="frequency-category-select">
            //     {this.renderRepeatCheckbox('Only on')}
            //     {this.state.everyCheckboxValue && (
            //       <Fragment>
            //         {this.renderFrequencySelector([
            //           { value: 'WEEK', label: 'Certain days of the week' },
            //           { value: 'MONTH', label: 'Certain days of the month' },
            //           { value: 'YEAR', label: 'Certain months of the year' }
            //         ])}
            //         {this.state.frequencySelectValue !== 'DAY' &&
            //           this.renderDateSelector(this.state.frequencySelectValue)}
            //       </Fragment>
            //     )}
            //   </div>
            // )
          }
        </div>
        <div className="frequency-description-box-container">
          {this.renderFrequencyDescription()}
        </div>
      </div>
    )
  }

  renderDataReturnStep = () => {
    return (
      <div>
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
    )
  }

  isScheduleSectionComplete = () => {
    return true
  }

  getModalContent = () => {
    const steps = [
      {
        title: 'Appearance',
        content: this.rendertitleStep(),
        complete: !!this.state.titleInput
      },
      {
        title: 'Notification Conditions',
        subtitle: 'Notify me when the following conditions are met',
        content: (
          <NotificationRulesCopy
            onUpdate={this.onRulesUpdate}
            notificationData={_get(this.state.activeRule, 'expression')}
          />
        ),
        complete: this.state.isRulesSectionComplete
      },
      {
        title: 'Data Return',
        subtitle:
          'Return the data from this query when the notification is triggered',
        content: this.renderDataReturnStep(),
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
        // onConfirm={this.onRuleSave}
        // confirmLoading={this.state.isSavingRule}
        // confirmText="Save"
        // confirmDisabled={!!steps.find(step => !step.complete)}
        enableBodyScroll
        width="95vw"
        style={{ marginTop: '21px', maxWidth: '1100px', maxHeight: '85vh' }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {this.state.activeRule && (
                <Button
                  type="danger"
                  onClick={this.onRuleDelete}
                  loading={this.state.isDeletingRule}
                >
                  Delete Notification
                </Button>
              )}
            </div>
            <div>
              <Button
                onClick={() => this.setState({ isEditModalVisible: false })}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                loading={this.state.isSavingRule}
                onClick={this.onRuleSave}
                disabled={!!steps.find(step => !step.complete)}
              >
                Save
              </Button>
            </div>
          </div>
        }
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

  renderNotificationlist = () => (
    <Fragment>
      {this.renderAddNotificationButton()}
      <div className="chata-notification-settings-container">
        {this.state.ruleList.map((notification, i) => {
          return (
            <div
              key={`chata-notification-setting-item-${i}`}
              className="chata-notification-setting-item"
              onClick={e => this.onEditClick(e, notification)}
            >
              <div className="chata-notification-setting-item-header">
                <div className="chata-notification-setting-display-name">
                  <span className="chata-notification-setting-display-name-title">
                    {notification.title}
                  </span>
                  <span className="chata-notification-setting-display-name-message">
                    {notification.message && (
                      <span> - {notification.message}</span>
                    )}
                  </span>
                </div>
                <div className="chata-notification-setting-actions">
                  <Checkbox
                    type="switch"
                    checked={
                      notification.status === 'ACTIVE' ||
                      notification.status === 'WAITING'
                    }
                    className="chata-notification-enable-checkbox"
                    onClick={e => e.stopPropagation()}
                    data-tip={
                      notification.status === 'ACTIVE' ||
                      notification.status === 'WAITING'
                        ? 'Disable'
                        : 'Enable'
                    }
                    data-for="chata-notification-settings-tooltip"
                    onChange={e => {
                      this.onEnableSwitchChange(e, notification)
                      ReactTooltip.hide()
                      ReactTooltip.rebuild()
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Fragment>
  )

  renderEmptyListMessage = () => (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      You don't have any notifications yet.
      <br />
      <Button type="primary" onClick={this.onAddClick}>
        Create a New Notification
      </Button>
    </div>
  )

  render = () => {
    if (this.state.isFetchingList) {
      return (
        <div
          data-test="notification-settings"
          style={{ textAlign: 'center', marginTop: '100px' }}
        >
          Loading...
        </div>
      )
    }

    return (
      <div data-test="notification-settings">
        <ReactTooltip
          className="chata-drawer-tooltip"
          id="chata-notification-settings-tooltip"
          effect="solid"
          delayShow={500}
          html
        />

        {_get(this.state.ruleList, 'length')
          ? this.renderNotificationlist()
          : this.renderEmptyListMessage()}
        {this.renderNotificationEditModal()}
      </div>
    )
  }
}
