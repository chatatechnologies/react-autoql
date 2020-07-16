import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import uuid from 'uuid'

import { Modal } from '../../Modal'
import { Steps } from '../../Steps'
import { Input } from '../../Input'
import { Button } from '../../Button'
import { ExpressionBuilder } from '../ExpressionBuilder'
import { ScheduleBuilder } from '../ScheduleBuilder'

import {
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './NotificationModal.scss'

export default class NotificationModal extends React.Component {
  NEW_NOTIFICATION_MODAL_ID = uuid.v4()

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSave: PropTypes.func,
    initialQuery: PropTypes.string,
    currentNotification: PropTypes.shape({}),
    isVisible: PropTypes.bool,
    allowDelete: PropTypes.bool,
    onClose: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onSave: () => {},
    onErrorCallback: () => {},
    initialQuery: undefined,
    currentNotification: undefined,
    isVisible: false,
    allowDelete: true,
    onClose: () => {},
  }

  state = {
    titleInput: '',
    messageInput: '',
    isExpressionSectionComplete: false,
    expressionJSON: [],
    dataReturnQueryInput: '',
    isDataReturnDirty: false,
    isScheduleSectionComplete: false,
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!this.props.isVisible && prevProps.isVisible) {
      setTimeout(this.resetFields, 500)
    }
    if (this.props.isVisible && !prevProps.isVisible) {
      // this.NEW_NOTIFICATION_MODAL_ID = uuid.v4()
      // If we are editing an existing notification
      // Fill the fields with the current settings
      if (this.props.currentNotification) {
        const notification = this.props.currentNotification
        this.setState({
          titleInput: notification.title,
          messageInput: notification.message,
          dataReturnQueryInput: notification.query,
          isDataReturnDirty: true,
          expressionJSON: _get(this.props.currentNotification, 'expression'),
        })
      } else if (
        this.props.initialQuery &&
        typeof this.props.initialQuery === 'string'
      ) {
        const expressionJSON = this.createRuleJSONFromQuery(
          this.props.initialQuery
        )
        this.setState({
          isExpressionSectionComplete: true,
          expressionJSON,
        })
      }
    }

    if (
      this.props.initialQuery &&
      this.props.initialQuery !== prevProps.initialQuery
    ) {
      this.resetFields()
      const rulesJSON = this.createRuleJSONFromQuery(this.props.initialQuery)
      this.setState({
        isRulesSectionComplete: true,
        rulesJSON,
      })
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
      isExpressionSectionComplete: false,
      isScheduleSectionComplete: false,
      expressionJSON: [],
      dataReturnQueryInput: '',
      isDataReturnDirty: false,
      // frequencyCategorySelectValue: undefined,
      // frequencySelectValue: 'MONTH',
      // weekSelectValue: [2],
      // monthSelectValue: [1],
      // yearSelectValue: [1],
      // everyCheckboxValue: false,
      titleInput: '',
      messageInput: '',
    })
  }

  createRuleJSONFromQuery = (query) => {
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
    const { titleInput, dataReturnQueryInput, messageInput } = this.state

    let expressionJSON = this.state.expressionJSON
    if (this.expressionRef) {
      expressionJSON = this.expressionRef.getJSON()
    }

    let scheduleData = {}
    if (this.scheduleBuilderRef) {
      scheduleData = this.scheduleBuilderRef.getData()
    }

    const notificationRule = this.props.currentNotification

    const newRule = {
      id: _get(notificationRule, 'id'),
      title: titleInput,
      query: dataReturnQueryInput,
      message: messageInput,
      notification_type: scheduleData.frequencyCategorySelectValue,
      cycle:
        scheduleData.frequencyCategorySelectValue === 'REPEAT_EVENT'
          ? 'WEEK'
          : null, // Hardcoded WEEK for MVP
      reset_period:
        !scheduleData.everyCheckboxValue ||
        scheduleData.frequencyCategorySelectValue === 'REPEAT_EVENT'
          ? null
          : scheduleData.frequencySelectValue,
      day_numbers:
        scheduleData.frequencyCategorySelectValue === 'REPEAT_EVENT'
          ? [1, 2, 3, 4, 5, 6, 7] // Hardcoded for MVP
          : null,
      // Commenting out for MVP
      // month_number: [],
      // run_times: [],
      expression: expressionJSON,
    }

    return newRule
  }

  onExpressionChange = (isComplete, expressionJSON) => {
    let { dataReturnQueryInput } = this.state
    const firstQuery = this.getFirstQuery(expressionJSON[0])
    if (!this.state.isDataReturnDirty && firstQuery) {
      dataReturnQueryInput = firstQuery
    }

    this.setState({
      isExpressionSectionComplete: isComplete,
      expressionJSON,
      dataReturnQueryInput,
    })
  }

  getFirstQuery = (term) => {
    if (!term) {
      return undefined
    }

    if (term.term_type === 'group') {
      return this.getFirstQuery(_get(term, 'term_value[0]'))
    } else if (term.term_type === 'query') {
      return term.term_value
    }
    return undefined
  }

  onRuleSave = () => {
    this.setState({
      isSavingRule: true,
    })

    const newRule = this.getNotificationRuleData()
    const requestParams = {
      rule: newRule,
      ...this.props.authentication,
    }

    if (newRule.id) {
      updateNotificationRule({
        ...requestParams,
      })
        .then((ruleResponse) => {
          this.props.onSave(ruleResponse)

          this.setState({
            isSavingRule: false,
          })
        })
        .catch((error) => {
          console.error(error)
          this.props.onErrorCallback(error)
          this.setState({
            isSavingRule: false,
          })
        })
    } else {
      createNotificationRule({
        ...requestParams,
      })
        .then((ruleResponse) => {
          this.props.onSave(ruleResponse)
          this.setState({
            isSavingRule: false,
          })
        })
        .catch((error) => {
          console.error(error)
          this.props.onErrorCallback(error)
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
        onChange={(e) => this.setState({ titleInput: e.target.value })}
      />
      <Input
        className="chata-notification-message-input"
        placeholder="Notification Message (max 200 characters)"
        type="multi"
        maxLength="200"
        value={this.state.messageInput}
        onChange={(e) => this.setState({ messageInput: e.target.value })}
      />
    </div>
  )

  renderFrequencyStep = () => {
    return (
      <ScheduleBuilder
        ref={(r) => (this.scheduleBuilderRef = r)}
        key={`schedule-${this.NEW_NOTIFICATION_MODAL_ID}`}
        rule={this.props.currentNotification}
        onCompletedChange={(isComplete) => {
          this.setState({ isScheduleSectionComplete: isComplete })
        }}
        onErrorCallback={this.props.onErrorCallback}
      />
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
          onKeyDown={(e) => {
            if (!this.state.isDataReturnDirty) {
              this.setState({ isDataReturnDirty: true })
            }
            if (e.key === 'Enter' && this.stepsRef) {
              this.stepsRef.nextStep()
            }
          }}
          onChange={(e) =>
            this.setState({ dataReturnQueryInput: e.target.value })
          }
        />
      </div>
    )
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
        .catch((error) => {
          console.error(error)
          this.props.onErrorCallback(error)
          this.setState({
            isDeletingRule: false,
          })
        })
    }
  }

  getModalContent = () => {
    if (!this.props.isVisible) {
      return null
    }

    const steps = [
      {
        title: 'Notification Conditions',
        subtitle: 'Notify me when the following conditions are met',
        content: (
          <ExpressionBuilder
            ref={(r) => (this.expressionRef = r)}
            key={`expression-${this.NEW_NOTIFICATION_MODAL_ID}`}
            onChange={this.onExpressionChange}
            expression={_get(
              this.props.currentNotification,
              'expression',
              this.state.expressionJSON
            )}
          />
        ),
        complete: this.state.isExpressionSectionComplete,
      },
      {
        title: 'Frequency',
        content: this.renderFrequencyStep(),
        complete: this.state.isScheduleSectionComplete,
      },
      {
        title: 'Data Return',
        subtitle:
          'Return the data from this query when the notification is triggered',
        content: this.renderDataReturnStep(),
        onClick: () => this.setState({ isDataReturnDirty: true }),
        complete:
          !!this.state.dataReturnQueryInput && this.state.isDataReturnDirty,
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
        style={{ marginTop: '21px', maxWidth: '900px', maxHeight: '93vh' }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {this.props.currentNotification && this.props.allowDelete && (
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
                disabled={steps && !!steps.find((step) => !step.complete)}
              >
                Save
              </Button>
            </div>
          </div>
        }
      >
        <Steps ref={(r) => (this.stepsRef = r)} steps={steps} />
      </Modal>
    )
  }
}
