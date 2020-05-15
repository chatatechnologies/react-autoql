import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import _get from 'lodash.get'
import uuid from 'uuid'

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
  updateNotificationRule,
  deleteNotificationRule,
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './NewNotificationModal.scss'

export default class NewNotificationModal extends React.Component {
  NEW_NOTIFICATION_MODAL_ID = uuid.v4()

  static propTypes = {
    authentication: authenticationType,
    onError: PropTypes.func,
    onSave: PropTypes.func,
    initialQuery: PropTypes.string,
    currentNotification: PropTypes.shape({}),
    isVisible: PropTypes.bool,
    onClose: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onSave: () => {},
    onError: () => {},
    initialQuery: undefined,
    currentNotification: undefined,
    isVisible: false,
    onClose: () => {},
  }

  state = {
    titleInput: '',
    messageInput: '',
    isRulesSectionComplete: false,
    rulesJSON: [],
    dataReturnQueryInput: '',
    isDataReturnDirty: false,
    frequencyCategorySelectValue: undefined,
    frequencySelectValue: 'MONTH',
    weekSelectValue: [2],
    monthSelectValue: [1],
    yearSelectValue: [1],
    everyCheckboxValue: false,
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!this.props.isVisible && prevProps.isVisible) {
      setTimeout(this.resetFields, 500)
    }
    if (this.props.isVisible && !prevProps.isVisible) {
      this.NEW_NOTIFICATION_MODAL_ID = uuid.v4()
      // If we are editing an existing notification
      // Fill the fields with the current settings
      if (this.props.currentNotification) {
        const notification = this.props.currentNotification
        this.setState({
          titleInput: notification.title,
          messageInput: notification.message,
          dataReturnQueryInput: notification.query,
          isDataReturnDirty: true,
          frequencyCategorySelectValue: notification.notification_type,
          frequencySelectValue: notification.reset_period || undefined,
          rulesJSON: _get(this.props.currentNotification, 'expression'),
          everyCheckboxValue:
            notification.notification_type === 'SINGLE_EVENT' &&
            !!notification.reset_period,

          // weekSelectValue: [2],
          // monthSelectValue: [1],
          // yearSelectValue: [1],
        })
      } else if (
        this.props.initialQuery &&
        typeof this.props.initialQuery === 'string'
      ) {
        const rulesJSON = this.createRuleJSONFromQuery(this.props.initialQuery)
        console.log('initial query provided. creating rulesJSON', rulesJSON)
        this.setState({
          isRulesSectionComplete: true,
          rulesJSON,
        })
      }
    }

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
        yearSelectValue: [1],
      })
    }
  }

  resetFields = () => {
    this.setState({
      isRulesSectionComplete: false,
      rulesJSON: [],
      dataReturnQueryInput: '',
      isDataReturnDirty: false,
      frequencyCategorySelectValue: undefined,
      frequencySelectValue: 'MONTH',
      weekSelectValue: [2],
      monthSelectValue: [1],
      yearSelectValue: [1],
      everyCheckboxValue: false,
      titleInput: '',
      messageInput: '',
    })
  }

  createRuleJSONFromQuery = query => {
    return [
      {
        condition: 'TERMINATOR',
        id: uuid.v4(),
        term_type: 'group',
        term_value: [
          {
            id: uuid.v4(),
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                id: uuid.v4(),
                condition: 'EXISTS',
                term_type: 'query',
                term_value: query,
              },
            ],
          },
        ],
      },
    ]
  }

  getNotificationRuleData = () => {
    const {
      titleInput,
      dataReturnQueryInput,
      messageInput,
      frequencyCategorySelectValue,
      everyCheckboxValue,
      frequencySelectValue,
      rulesJSON,
    } = this.state

    const notificationRule = this.props.currentNotification

    const newRule = {
      id: _get(notificationRule, 'id'),
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
      expression: rulesJSON,
    }

    return newRule
  }

  onRulesUpdate = (isRulesSectionComplete, rulesJSON) => {
    this.setState({ isRulesSectionComplete, rulesJSON })
  }

  onRuleSave = () => {
    this.setState({
      isSavingRule: true,
    })

    // var newRuleList = [...this.state.ruleList]
    const newRule = this.getNotificationRuleData()
    const requestParams = {
      rule: newRule,
      ...this.props.authentication,
    }

    if (newRule.id) {
      updateNotificationRule({
        ...requestParams,
      })
        .then(ruleResponse => {
          this.props.onSave(ruleResponse)
          // newRuleList = this.state.ruleList.map(r => {
          //   if (r.id === newRule.id) {
          //     return _get(ruleResponse, 'data.data', newRule)
          //   }
          //   return r
          // })

          this.setState({
            isSavingRule: false,
          })
        })
        .catch(error => {
          console.error(error)
          this.props.onError(error)
          this.setState({
            isSavingRule: false,
          })
        })
    } else {
      createNotificationRule({
        ...requestParams,
      })
        .then(ruleResponse => {
          this.props.onSave(ruleResponse)
          this.setState({
            isSavingRule: false,
          })
        })
        .catch(error => {
          console.error(error)
          this.props.onError(error)
          this.setState({
            isSavingRule: false,
          })
        })
    }
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
    if (!this.isScheduleSectionComplete()) {
      return null
    }

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
              { value: 'REPEAT_EVENT', label: 'Every time this happens' },
              // Commenting out for MVP
              // { value: 'SCHEDULE', label: 'On a schedule' }
            ]}
            selectionPlaceholder="Select a frequency"
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
                    { value: 'MONTH', label: 'Monthly' },
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
    return !!this.state.frequencyCategorySelectValue
  }

  onRuleDelete = () => {
    const ruleId = _get(this.props.currentNotification, 'id')
    if (ruleId) {
      this.setState({
        isDeletingRule: true,
      })

      deleteNotificationRule({ ruleId, ...this.props.authentication })
        .then(() => {
          this.props.onDelete(ruleId)
          this.setState({
            isDeletingRule: false,
          })
        })
        .catch(error => {
          console.error(error)
          this.props.onError(error)
          this.setState({
            isDeletingRule: false,
          })
        })
    }
  }

  getModalContent = () => {
    const steps = [
      {
        title: 'Notification Conditions',
        subtitle: 'Notify me when the following conditions are met',
        content: (
          <NotificationRulesCopy
            key={this.NEW_NOTIFICATION_MODAL_ID}
            onUpdate={this.onRulesUpdate}
            notificationData={this.state.rulesJSON}
          />
        ),
        complete: this.state.isRulesSectionComplete,
      },
      {
        title: 'Frequency',
        content: this.renderFrequencyStep(),
        complete: this.isScheduleSectionComplete(),
      },
      {
        title: 'Data Return',
        subtitle:
          'Return the data from this query when the notification is triggered',
        content: this.renderDataReturnStep(),
        complete: !!this.state.dataReturnQueryInput,
      },
      {
        title: 'Appearance',
        content: this.rendertitleStep(),
        complete: !!this.state.titleInput,
      },
    ]
    return steps
  }

  render = () => {
    const steps = this.getModalContent()

    return (
      <Modal
        title="Custom Notification"
        isVisible={this.props.isVisible}
        onClose={this.props.onClose}
        enableBodyScroll
        width="95vw"
        style={{ marginTop: '21px', maxWidth: '1100px', maxHeight: '93vh' }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {this.props.currentNotification && (
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
              <Button onClick={this.props.onClose}>Cancel</Button>
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
      >
        <Steps steps={steps} />
      </Modal>
    )
  }
}
