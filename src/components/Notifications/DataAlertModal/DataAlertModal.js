import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'
import uuid from 'uuid'

import { Modal } from '../../Modal'
import { ConfirmModal } from '../../ConfirmModal'
import { Steps } from '../../Steps'
import { Input } from '../../Input'
import { Button } from '../../Button'
import { ExpressionBuilderSimple } from '../ExpressionBuilderSimple'
import { ScheduleBuilder } from '../ScheduleBuilder'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import {
  createDataAlert,
  updateDataAlert,
  deleteDataAlert,
} from '../../../js/notificationService'

import { authenticationType, themeConfigType } from '../../../props/types'
import {
  authenticationDefault,
  themeConfigDefault,
  getAuthentication,
  getThemeConfig,
} from '../../../props/defaults'

import './DataAlertModal.scss'

export default class DataAlertModal extends React.Component {
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
    isExpressionValidated: false,
    isScheduleSectionComplete: false,
    isDataReturnDirty: false,
    isConfirmDeleteModalVisible: false,
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!this.props.isVisible && prevProps.isVisible) {
      setTimeout(this.resetFields, 500)
    }
    if (this.props.isVisible && !prevProps.isVisible) {
      console.log('is visible prop changed to true')
      // If we are editing an existing notification
      // Fill the fields with the current settings
      if (this.props.currentDataAlert) {
        console.log(
          'current data alert was provided so didnt use initial query',
          this.props.currentDataAlert
        )
        const notification = this.props.currentDataAlert
        this.setState({
          titleInput: notification.title,
          messageInput: notification.message,
          dataReturnQuery: notification.data_return_query,
          isDataReturnDirty: true,
          expressionJSON: _get(this.props.currentDataAlert, 'expression'),
        })
        if (this.props.currentDataAlert.status !== 'ERROR')
          setTimeout(() => {
            // If its an existing data alert and not in an error state, its already been validated
            this.setState({ isExpressionValidated: true })
          }, 500)
      } else if (
        this.props.initialQuery &&
        typeof this.props.initialQuery === 'string'
      ) {
        const expressionJSON = this.createExpressionJSONFromQuery(
          this.props.initialQuery
        )
        console.log(
          'component updated and initial query changed! setting new expression json now',
          expressionJSON
        )
        this.setState({
          isExpressionSectionComplete: true,
          expressionJSON,
        })
      } else {
        console.log('none of the conditions applied?')
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
      console.log(
        'initial query changed! updating expression json now',
        expressionJSON
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
    try {
      const { titleInput, messageInput } = this.state

      let dataReturnQuery
      let expressionJSON = _cloneDeep(this.state.expressionJSON)
      if (this.expressionRef) {
        expressionJSON = this.expressionRef.getJSON()
        dataReturnQuery = this.expressionRef.getFirstQuery()
      }

      let scheduleData = {}
      if (this.scheduleBuilderRef) {
        scheduleData = this.scheduleBuilderRef.getData()
      }

      const newDataAlert = {
        id: _get(this.props.currentDataAlert, 'id'),
        title: titleInput,
        data_return_query: dataReturnQuery,
        message: messageInput,
        expression: expressionJSON,
        notification_type: scheduleData.notificationType,
        reset_period: scheduleData.resetPeriod,
        time_zone: scheduleData.timezone,
      }

      return newDataAlert
    } catch (error) {
      console.error(error)
    }
  }

  onExpressionChange = (isComplete, isValid, expressionJSON) => {
    this.setState({
      isExpressionSectionComplete: isComplete,
      isFirstSectionComplete: isComplete && !!this.state.titleInput,
      isExpressionSectionValid: isValid,
      isExpressionValidated: false,
      expressionJSON,
    })
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

  validateAndNext = () => {
    // Step 1: validate expression
    // Step 2: move on to next step if valid,
    // show warning message if not valid
    if (this.stepsRef) {
      this.stepsRef.nextStep()
    }
  }

  renderNextBtn = (className, disabled, onclick = () => {}, text) => {
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
        {text || 'Next'}
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
        <ExpressionBuilderSimple
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
        <div className="step-btn-container">
          {this.renderNextBtn(
            'first-step-next-btn',
            !this.state.isFirstSectionComplete,
            this.validateAndNext,
            'Validate and Next'
          )}
        </div>
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
            !this.state.isScheduleSectionComplete
          )}
        </div>
      </div>
    )
  }

  renderAlertPreferencesStep = () => {
    return (
      <div>
        <p>When this Alert is triggered, send the following message:</p>
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
        content: this.renderAlertPreferencesStep(),
        complete:
          this.state.isThirdSectionDirty || !!this.props.currentDataAlert,
        onClick: () => {
          this.setState({ isThirdSectionDirty: true })
        },
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
      <ErrorBoundary>
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
      </ErrorBoundary>
    )
  }
}
