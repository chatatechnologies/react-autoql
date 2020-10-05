import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import uuid from 'uuid'

import { Modal } from '../../Modal'
import { ConfirmModal } from '../../ConfirmModal'
import { Steps } from '../../Steps'
import { Input } from '../../Input'
import { Button } from '../../Button'
import { Icon } from '../../Icon'
import { ExpressionBuilder } from '../ExpressionBuilder'
import { ScheduleBuilder } from '../ScheduleBuilder'

import {
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  isExpressionQueryValid,
} from '../../../js/notificationService'

import { authenticationType, themeConfigType } from '../../../props/types'
import {
  authenticationDefault,
  themeConfigDefault,
} from '../../../props/defaults'

import './NotificationModal.scss'

export default class NotificationModal extends React.Component {
  NEW_NOTIFICATION_MODAL_ID = uuid.v4()

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSave: PropTypes.func,
    initialQuery: PropTypes.string,
    currentRule: PropTypes.shape({}),
    isVisible: PropTypes.bool,
    allowDelete: PropTypes.bool,
    onClose: PropTypes.func,
    themeConfig: themeConfigType,
    isManagement: PropTypes.bool,
    onManagementCreateRule: PropTypes.func,
    onManagementDeleteRule: PropTypes.func,
    title: PropTypes.string,
    enableQueryValidation: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onSave: () => {},
    onErrorCallback: () => {},
    initialQuery: undefined,
    currentRule: undefined,
    isVisible: false,
    allowDelete: true,
    onClose: () => {},
    themeConfig: themeConfigDefault,
    isManagement: false,
    onManagementCreateRule: () => {},
    onManagementDeleteRule: () => {},
    title: 'Create New Data Alert',
    enableQueryValidation: true,
  }

  state = {
    titleInput: '',
    messageInput: '',
    isExpressionSectionComplete: false,
    expressionJSON: [],
    isScheduleSectionComplete: false,
    dataReturnQueryInput: '',
    isDataReturnDirty: false,
    isDataReturnQueryValid: true,
    isDataReturnValidated: false,
    isConfirmDeleteModalVisible: false,
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!this.props.isVisible && prevProps.isVisible) {
      setTimeout(this.resetFields, 500)
    }
    if (this.props.isVisible && !prevProps.isVisible) {
      // If we are editing an existing notification
      // Fill the fields with the current settings
      if (this.props.currentRule) {
        const notification = this.props.currentRule
        this.setState({
          titleInput: notification.title,
          messageInput: notification.message,
          dataReturnQueryInput: notification.query,
          isDataReturnDirty: true,
          expressionJSON: _get(this.props.currentRule, 'expression'),
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

    const notificationRule = this.props.currentRule

    const newRule = {
      id: _get(notificationRule, 'id'),
      title: titleInput,
      query: dataReturnQueryInput,
      message: messageInput,
      notification_type: scheduleData.frequencyCategorySelectValue,
      expression: expressionJSON,
      reset_period:
        scheduleData.frequencyCategorySelectValue === 'REPEAT_EVENT'
          ? null
          : scheduleData.frequencySelectValue,
      // Commenting out for MVP
      // day_numbers:
      //   scheduleData.frequencyCategorySelectValue === 'REPEAT_EVENT'
      //     ? [1, 2, 3, 4, 5, 6, 7] // Hardcoded for MVP
      //     : null,
      // month_number: [],
      // run_times: [],
      // cycle:
      //   scheduleData.frequencyCategorySelectValue === 'REPEAT_EVENT'
      //     ? 'WEEK'
      //     : null,
    }

    return newRule
  }

  onExpressionChange = (isComplete, isValid, expressionJSON) => {
    let { dataReturnQueryInput } = this.state
    const firstQuery = this.getFirstQuery(expressionJSON[0])
    if (!this.state.isDataReturnDirty && firstQuery) {
      dataReturnQueryInput = firstQuery
    }

    this.setState(
      {
        isExpressionSectionComplete: isComplete,
        isFirstSectionComplete: isComplete && !!this.state.titleInput,
        isExpressionSectionValid: isValid,
        expressionJSON,
        dataReturnQueryInput,
      },
      () => {
        this.validateDataReturnQuery()
      }
    )
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

  validateDataReturnQuery = () => {
    if (this.props.enableQueryValidation) {
      if (
        this.state.dataReturnQueryInput &&
        !this.state.isValidatingDataReturnQuery &&
        this.state.lastCheckedDataReturnQuery !==
          this.state.dataReturnQueryInput
      ) {
        this.setState({
          isValidatingDataReturnQuery: true,
          lastCheckedDataReturnQuery: this.state.dataReturnQueryInput,
        })
        isExpressionQueryValid({
          query: this.state.dataReturnQueryInput,
          ...this.props.authentication,
        })
          .then(() => {
            this.setState({
              isDataReturnQueryValid: true,
              isValidatingDataReturnQuery: false,
              isDataReturnValidated: true,
            })
          })
          .catch(() => {
            this.setState({
              isDataReturnQueryValid: false,
              isValidatingDataReturnQuery: false,
              isDataReturnValidated: true,
            })
          })
      }
    }

    this.setState({ isDataReturnValidated: true })
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

    if (this.props.isManagement) {
      this.props.onManagementCreateRule(newRule)
      this.setState({
        isSavingRule: false,
      })
    } else if (newRule.id) {
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

  renderNextBtn = (className, disabled, onclick = () => {}) => {
    return (
      <Button
        className={className}
        onClick={() => {
          onclick()
          if (this.stepsRef) {
            this.stepsRef.nextStep()
          }
        }}
        disabled={disabled}
        type="primary"
      >
        Next
      </Button>
    )
  }

  renderBackBtn = (className) => {
    return (
      <Button
        className={className}
        onClick={() => {
          if (this.stepsRef) {
            this.stepsRef.prevStep()
          }
        }}
      >
        Back
      </Button>
    )
  }

  renderSetUpDataAlertStep = () => {
    return (
      <div>
        <p>Name:</p>
        <Input
          className="chata-notification-display-name-input"
          placeholder="Add an Alert Name"
          icon="title"
          maxLength="50"
          value={this.state.titleInput}
          onChange={(e) => {
            const isFirstSectionComplete =
              this.state.isExpressionSectionComplete && !!e.target.value
            this.setState({
              titleInput: e.target.value,
              isFirstSectionComplete,
            })
          }}
        />
        <p>Conditions:</p>
        <ExpressionBuilder
          authentication={this.props.authentication}
          ref={(r) => (this.expressionRef = r)}
          key={`expression-${this.NEW_NOTIFICATION_MODAL_ID}`}
          onChange={this.onExpressionChange}
          enableQueryValidation={this.props.enableQueryValidation}
          expression={_get(
            this.props.currentRule,
            'expression',
            this.state.expressionJSON
          )}
        />
        {this.renderNextBtn(
          'first-step-next-btn',
          !this.state.isFirstSectionComplete
        )}
      </div>
    )
  }

  renderFrequencyStep = () => {
    return (
      <div>
        <ScheduleBuilder
          ref={(r) => (this.scheduleBuilderRef = r)}
          key={`schedule-${this.NEW_NOTIFICATION_MODAL_ID}`}
          rule={this.props.currentRule}
          onCompletedChange={(isComplete) => {
            this.setState({ isScheduleSectionComplete: isComplete })
          }}
          onErrorCallback={this.props.onErrorCallback}
        />
        <div className="step-btn-container">
          {this.renderBackBtn('second-step-back-btn')}
          {this.renderNextBtn(
            'second-step-next-btn',
            !this.state.isScheduleSectionComplete,
            () => {
              if (this.state.dataReturnQueryInput) {
                this.setState({ isDataReturnDirty: true })
              }
            }
          )}
        </div>
      </div>
    )
  }

  renderAlertPreferencesStep = () => {
    return (
      <div>
        <p>Return the data from this query:</p>
        <Input
          ref={(r) => (this.dataReturnInputRef = r)}
          className="chata-notification-display-name-input"
          icon="chata-bubbles-outlined"
          placeholder="Type query here"
          value={this.state.dataReturnQueryInput}
          onFocus={() => {
            this.setState({ isDataReturnDirty: true })
          }}
          onKeyDown={(e) => {
            if (!this.state.isDataReturnDirty) {
              this.setState({ isDataReturnDirty: true })
            }
            if (e.key === 'Enter' && this.stepsRef) {
              this.stepsRef.nextStep()
              this.validateDataReturnQuery()
            }
          }}
          onBlur={this.validateDataReturnQuery}
          onChange={(e) =>
            this.setState({ dataReturnQueryInput: e.target.value })
          }
        />
        {!this.state.isDataReturnQueryValid && (
          <div className="rule-term-validation-error">
            <Icon type="warning-triangle" /> That query is invalid. Try entering
            a different query.
          </div>
        )}
        <p>Send the following message:</p>
        <Input
          className="chata-notification-message-input"
          placeholder="Compose a short message to accompany your triggered Alert"
          type="multi"
          maxLength="200"
          value={this.state.messageInput}
          onChange={(e) => this.setState({ messageInput: e.target.value })}
        />
        <div className="step-btn-container">
          {this.renderBackBtn('second-step-back-btn')}
        </div>
      </div>
    )
  }

  onRuleDelete = () => {
    const ruleId = _get(this.props.currentRule, 'id')
    if (ruleId) {
      this.setState({
        isDeletingRule: true,
      })

      deleteNotificationRule({ ruleId, ...this.props.authentication })
        .then(() => {
          this.props.onDelete(ruleId)
          this.setState({
            isDeletingRule: false,
            isConfirmDeleteModalVisible: false,
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
        title: 'Set up your Alert',
        content: this.renderSetUpDataAlertStep(),
        complete: this.state.isFirstSectionComplete,
        error:
          this.state.isExpressionSectionComplete &&
          !this.state.isExpressionSectionValid,
      },
      {
        title: 'Schedule Frequency',
        content: this.renderFrequencyStep(),
        complete: this.state.isScheduleSectionComplete,
      },
      {
        title: 'Manage Alert Preferences',
        subtitle: 'When this Alert is triggered:',
        content: this.renderAlertPreferencesStep(),
        onClick: () => {
          if (this.state.dataReturnQueryInput) {
            this.setState({ isDataReturnDirty: true })
          }
        },
        complete:
          !!this.state.dataReturnQueryInput &&
          this.state.isDataReturnDirty &&
          this.state.isDataReturnQueryValid,
        error:
          this.state.isDataReturnValidated &&
          !!this.state.dataReturnQueryInput &&
          this.state.isDataReturnDirty &&
          !this.state.isDataReturnQueryValid,
      },
    ]
    return steps
  }

  isSaveButtonDisabled = (steps) => {
    return steps && !!steps.find((step) => !step.complete || step.error)
  }

  render = () => {
    const steps = this.getModalContent()

    return (
      <Fragment>
        <Modal
          title={this.props.title}
          ref={(r) => (this.modalRef = r)}
          isVisible={this.props.isVisible}
          onClose={this.props.onClose}
          confirmOnClose={true}
          enableBodyScroll
          // confirmText="Save"
          // onConfirm={this.onRuleSave}
          // confirmLoading={this.state.isSavingRule}
          // confirmDisabled={this.isSaveButtonDisabled(steps)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {this.props.currentRule && this.props.allowDelete && (
                  <Button
                    type="danger"
                    onClick={() => {
                      this.setState({ isConfirmDeleteModalVisible: true })
                    }}
                    loading={this.state.isDeletingRule}
                  >
                    Delete Data Alert
                  </Button>
                )}
              </div>
              <div>
                <Button
                  onClick={() => {
                    if (this.modalRef) {
                      this.modalRef.onClose()
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  loading={this.state.isSavingRule}
                  onClick={this.onRuleSave}
                  disabled={this.isSaveButtonDisabled(steps)}
                >
                  Save
                </Button>
              </div>
            </div>
          }
        >
          <div className="notification-modal-content">
            <Steps ref={(r) => (this.stepsRef = r)} steps={steps} />
          </div>
        </Modal>
        <ConfirmModal
          isVisible={this.state.isConfirmDeleteModalVisible}
          onConfirm={this.onRuleDelete}
          confirmLoading={this.state.isDeletingRule}
          onClose={() => {
            this.setState({ isConfirmDeleteModalVisible: false })
          }}
          confirmText="Delete"
          width="450px"
        >
          <h3>Are you sure you want to delete this Data Alert?</h3>
          <p>
            You will no longer be notified about these changes in your data.
          </p>
        </ConfirmModal>
      </Fragment>
    )
  }
}
