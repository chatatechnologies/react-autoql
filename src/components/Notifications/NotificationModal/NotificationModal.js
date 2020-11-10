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
  createDataAlert,
  updateDataAlert,
  deleteDataAlert,
  isExpressionQueryValid,
} from '../../../js/notificationService'

import { authenticationType, themeConfigType } from '../../../props/types'
import {
  authenticationDefault,
  themeConfigDefault,
  getAuthentication,
  getThemeConfig,
} from '../../../props/defaults'

import './NotificationModal.scss'

export default class NotificationModal extends React.Component {
  NEW_NOTIFICATION_MODAL_ID = uuid.v4()

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSave: PropTypes.func,
    initialQuery: PropTypes.string,
    currentDataAlert: PropTypes.shape({}),
    isVisible: PropTypes.bool,
    allowDelete: PropTypes.bool,
    onClose: PropTypes.func,
    themeConfig: themeConfigType,
    isManagement: PropTypes.bool,
    onManagementCreateDataAlert: PropTypes.func,
    onManagementDeleteDataAlert: PropTypes.func,
    title: PropTypes.string,
    enableQueryValidation: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onSave: () => {},
    onErrorCallback: () => {},
    initialQuery: undefined,
    currentDataAlert: undefined,
    isVisible: false,
    allowDelete: true,
    onClose: () => {},
    themeConfig: themeConfigDefault,
    isManagement: false,
    onManagementCreateDataAlert: () => {},
    onManagementDeleteDataAlert: () => {},
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
      if (this.props.currentDataAlert) {
        const notification = this.props.currentDataAlert
        this.setState({
          titleInput: notification.title,
          messageInput: notification.message,
          dataReturnQueryInput: notification.data_return_query,
          isDataReturnDirty: true,
          expressionJSON: _get(this.props.currentDataAlert, 'expression'),
        })
      } else if (
        this.props.initialQuery &&
        typeof this.props.initialQuery === 'string'
      ) {
        const expressionJSON = this.createExpressionJSONFromQuery(
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
      const expressionJSON = this.createExpressionJSONFromQuery(
        this.props.initialQuery
      )
      this.setState({
        isExpressionSectionComplete: true,
        expressionJSON,
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

  createExpressionJSONFromQuery = (query) => {
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

  getDataAlertData = () => {
    const { titleInput, dataReturnQueryInput, messageInput } = this.state

    let expressionJSON = this.state.expressionJSON
    if (this.expressionRef) {
      expressionJSON = this.expressionRef.getJSON()
    }

    let scheduleData = {}
    if (this.scheduleBuilderRef) {
      scheduleData = this.scheduleBuilderRef.getData()
    }

    const newDataAlert = {
      id: _get(this.props.currentDataAlert, 'id'),
      title: titleInput,
      data_return_query: dataReturnQueryInput,
      message: messageInput,
      expression: expressionJSON,
      notification_type: scheduleData.notificationType,
      reset_period: scheduleData.resetPeriod,
    }

    return newDataAlert
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
          ...getAuthentication(this.props.authentication),
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

  onDataAlertSave = () => {
    this.setState({
      isSavingDataAlert: true,
    })

    const newDataAlert = this.getDataAlertData()

    const requestParams = {
      dataAlert: newDataAlert,
      ...getAuthentication(this.props.authentication),
    }

    if (this.props.isManagement) {
      this.props.onManagementCreateDataAlert(newDataAlert)
      this.setState({
        isSavingDataAlert: false,
      })
    } else if (newDataAlert.id) {
      updateDataAlert({
        ...requestParams,
      })
        .then((dataAlertResponse) => {
          this.props.onSave(dataAlertResponse)

          this.setState({
            isSavingDataAlert: false,
          })
        })
        .catch((error) => {
          console.error(error)
          this.props.onErrorCallback(error)
          this.setState({
            isSavingDataAlert: false,
          })
        })
    } else {
      createDataAlert({
        ...requestParams,
      })
        .then((dataAlertResponse) => {
          this.props.onSave(dataAlertResponse)
          this.setState({
            isSavingDataAlert: false,
          })
        })
        .catch((error) => {
          console.error(error)
          this.props.onErrorCallback(error)
          this.setState({
            isSavingDataAlert: false,
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
          className="react-autoql-notification-display-name-input"
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
          authentication={getAuthentication(this.props.authentication)}
          themeConfig={getThemeConfig(this.props.themeConfig)}
          ref={(r) => (this.expressionRef = r)}
          key={`expression-${this.NEW_NOTIFICATION_MODAL_ID}`}
          onChange={this.onExpressionChange}
          enableQueryValidation={this.props.enableQueryValidation}
          expression={_get(
            this.props.currentDataAlert,
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
          themeConfig={getThemeConfig(this.props.themeConfig)}
          ref={(r) => (this.scheduleBuilderRef = r)}
          key={`schedule-${this.NEW_NOTIFICATION_MODAL_ID}`}
          dataAlert={this.props.currentDataAlert}
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
          className="react-autoql-notification-display-name-input"
          icon="react-autoql-bubbles-outlined"
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
          <div className="expression-term-validation-error">
            <Icon type="warning-triangle" /> That query is invalid. Try entering
            a different query.
          </div>
        )}
        <p>Send the following message:</p>
        <Input
          className="react-autoql-notification-message-input"
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

  onDataAlertDelete = () => {
    const dataAlertId = _get(this.props.currentDataAlert, 'id')
    if (dataAlertId) {
      this.setState({
        isDeletingDataAlert: true,
      })

      deleteDataAlert({
        dataAlertId,
        ...getAuthentication(this.props.authentication),
      })
        .then(() => {
          this.props.onDelete(dataAlertId)
          this.setState({
            isDeletingDataAlert: false,
            isConfirmDeleteModalVisible: false,
          })
        })
        .catch((error) => {
          console.error(error)
          this.props.onErrorCallback(error)
          this.setState({
            isDeletingDataAlert: false,
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
        title: 'Set Up Your Alert',
        content: this.renderSetUpDataAlertStep(),
        complete: this.state.isFirstSectionComplete,
        error:
          this.state.isExpressionSectionComplete &&
          !this.state.isExpressionSectionValid,
      },
      {
        title: 'Select Alert Interval',
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
          themeConfig={getThemeConfig(this.props.themeConfig)}
          title={this.props.title}
          ref={(r) => (this.modalRef = r)}
          isVisible={this.props.isVisible}
          onClose={this.props.onClose}
          confirmOnClose={true}
          enableBodyScroll
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {this.props.currentDataAlert && this.props.allowDelete && (
                  <Button
                    type="danger"
                    onClick={() => {
                      this.setState({ isConfirmDeleteModalVisible: true })
                    }}
                    loading={this.state.isDeletingDataAlert}
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
                  loading={this.state.isSavingDataAlert}
                  onClick={this.onDataAlertSave}
                  disabled={this.isSaveButtonDisabled(steps)}
                >
                  Save
                </Button>
              </div>
            </div>
          }
        >
          <div className="notification-modal-content">
            <Steps
              themeConfig={getThemeConfig(this.props.themeConfig)}
              ref={(r) => (this.stepsRef = r)}
              steps={steps}
            />
          </div>
        </Modal>
        <ConfirmModal
          isVisible={this.state.isConfirmDeleteModalVisible}
          onConfirm={this.onDataAlertDelete}
          confirmLoading={this.state.isDeletingDataAlert}
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
