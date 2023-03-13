import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'
import _isEmpty from 'lodash.isempty'
import { v4 as uuid } from 'uuid'

import { Modal } from '../../Modal'
import { ConfirmModal } from '../../ConfirmModal'
import { Steps } from '../../Steps'
import { Input } from '../../Input'
import { Button } from '../../Button'
import { Icon } from '../../Icon'
import { Tooltip } from '../../Tooltip'
import { ExpressionBuilderSimple } from '../ExpressionBuilderSimple'
import { ScheduleBuilder } from '../ScheduleBuilder'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { createDataAlert, updateDataAlert, deleteDataAlert, validateExpression } from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'

import './DataAlertModal.scss'
import { withTheme } from '../../../theme'

class DataAlertModal extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.NEW_NOTIFICATION_MODAL_ID = uuid()

    this.state = {
      titleInput: '',
      messageInput: '',
      isExpressionSectionComplete: false,
      expressionJSON: [],
      isExpressionValidated: false,
      isScheduleSectionComplete: false,
      isDataReturnDirty: false,
      isConfirmDeleteModalVisible: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSave: PropTypes.func,
    initialQuery: PropTypes.string,
    userSelection: PropTypes.array,
    currentDataAlert: PropTypes.shape({}),
    isVisible: PropTypes.bool,
    allowDelete: PropTypes.bool,
    onClose: PropTypes.func,
    isManagement: PropTypes.bool,
    onManagementCreateDataAlert: PropTypes.func,
    onManagementDeleteDataAlert: PropTypes.func,
    title: PropTypes.string,
    titleIcon: PropTypes.oneOfType([PropTypes.element, PropTypes.instanceOf(Icon)]),
    enableQueryValidation: PropTypes.bool,
    onValidate: PropTypes.func,
    onClosed: PropTypes.func,
    onOpened: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onSave: () => {},
    onErrorCallback: () => {},
    initialQuery: undefined,
    userSelection: undefined,
    currentDataAlert: undefined,
    isVisible: false,
    allowDelete: true,
    onClose: () => {},
    isManagement: false,
    onManagementCreateDataAlert: () => {},
    onManagementDeleteDataAlert: () => {},
    onClosed: () => {},
    onOpened: () => {},
    title: 'Create Data Alert',
    titleIcon: undefined,
    enableQueryValidation: true,
    onValidate: undefined,
  }

  componentDidMount = () => {
    this.initializeFields()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!this.props.isVisible && prevProps.isVisible) {
      setTimeout(this.resetFields, 500)
      this.props.onClosed()
    }
    if (this.props.isVisible && !prevProps.isVisible) {
      this.initializeFields()
      this.props.onOpened()
    }

    if (this.props.initialQuery && this.props.initialQuery !== prevProps.initialQuery) {
      this.resetFields()
      const expressionJSON = this.createExpressionJSONFromQuery(this.props.initialQuery, this.props.userSelection)
      this.setState({
        isExpressionSectionComplete: true,
        expressionJSON,
      })
    }

    if (this.state.frequencyCategorySelectValue !== prevState.frequencyCategorySelectValue) {
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

  initializeFields = () => {
    // If we are editing an existing notification
    // Fill the fields with the current settings
    if (!_isEmpty(this.props.currentDataAlert)) {
      const notification = this.props.currentDataAlert
      this.setState({
        titleInput: notification.title,
        messageInput: notification.message,
        dataReturnQuery: notification.data_return_query,
        isDataReturnDirty: true,
        expressionJSON: _get(this.props.currentDataAlert, 'expression'),
      })
    } else if (this.props.initialQuery && typeof this.props.initialQuery === 'string') {
      const expressionJSON = this.createExpressionJSONFromQuery(this.props.initialQuery, this.props.userSelection)
      this.setState({
        isExpressionSectionComplete: true,
        expressionJSON,
      })
    }
  }

  createExpressionJSONFromQuery = (query, userSelection) => {
    return [
      {
        condition: 'TERMINATOR',
        id: uuid(),
        term_type: 'group',
        term_value: [
          {
            id: uuid(),
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                id: uuid(),
                condition: 'EXISTS',
                term_type: 'query',
                term_value: query,
                user_selection: userSelection,
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
      isFirstSectionComplete: this.isFirstSectionComplete(),
      isExpressionValidated: false,
      expressionJSON,
    })
  }

  isFirstSectionComplete = () => {
    let isExpressionComplete = false
    if (this.expressionRef) {
      isExpressionComplete = this.expressionRef.isComplete()
    }

    if (!this.props.enableQueryValidation) {
      return isExpressionComplete && !!this.state.titleInput
    }

    return (
      isExpressionComplete &&
      !!this.state.titleInput &&
      this.state.isExpressionValidated &&
      this.state.isExpressionValid
    )
  }

  onDataAlertSave = () => {
    this.setState({
      isSavingDataAlert: true,
    })

    const newDataAlert = {
      ...this.getDataAlertData(),
      project_id: this.props.selectedDemoProjectId,
    }

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

  validateFn = this.props.onValidate || validateExpression

  validateExpression = () => {
    try {
      this.setState({ isValidating: true, isExpressionValidated: false })

      if (this.expressionRef) {
        const expression = this.expressionRef.getJSON()

        this.validateFn({
          ...this.props.authentication,
          expression,
        })
          .then(() => {
            this.setState({
              isValidating: false,
              isExpressionValid: true,
              isExpressionValidated: true,
            })
            if (this.stepsRef) {
              setTimeout(() => this.stepsRef.nextStep(), 500)
            }
          })
          .catch((error) => {
            this.setState({
              isValidating: false,
              isExpressionValid: false,
              isExpressionValidated: true,
              expressionError: _get(error, 'message'),
            })
          })
      } else {
        this.setState({
          isValidating: false,
          isExpressionValid: false,
          isExpressionValidated: true,
        })
      }
    } catch (error) {
      console.error(error)
      this.setState({
        isValidating: false,
        isExpressionValid: false,
        isExpressionValidated: true,
      })
    }
  }

  renderValidateBtn = () => {
    if (this.expressionRef && this.expressionRef.state.expressionError) {
      // If expression is unable to be displayed because it is too old
      // User must reset conditions before they are able to validate
      return null
    }

    return (
      <Fragment>
        {this.state.isExpressionValidated && this.state.isExpressionValid && (
          <span
            style={{
              display: 'inline-block',
              position: 'absolute',
              right: '210px',
            }}
          >
            <Icon
              className='expression-valid-checkmark'
              type='check'
              data-for='react-autoql-data-alert-modal-tooltip'
              data-tip='Expression is valid'
            />
          </span>
        )}
        {this.state.isExpressionValidated && !this.state.isExpressionValid && !!this.state.expressionError && (
          <div className='expression-invalid-message-container'>
            <span className='expression-invalid-message'>
              <Icon type='warning-triangle' />
            </span>{' '}
            <p className='expression-invalid-message' style={{ maxWidth: '80%', marginTop: 0, marginRight: 0 }}>
              {this.state.expressionError}
            </p>
          </div>
        )}
        <Button
          onClick={this.validateExpression}
          loading={this.state.isValidating}
          tooltipID={this.props.tooltipID}
          type='primary'
          disabled={
            !this.state.titleInput || !_get(this.expressionRef, 'state.expression[0].term_value') // only checking for empty state of the first input value
          }
          style={{ position: 'absolute', right: 0 }}
        >
          {'Check Alert & continue'}
        </Button>
      </Fragment>
    )
  }

  setStep = (step) => {
    if (this.stepsRef) {
      this.stepsRef.setStep(step)
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
        type='primary'
        tooltipID={this.props.tooltipID}
      >
        {text || 'Continue'}
      </Button>
    )
  }

  renderBackBtn = (className) => {
    return (
      <Button
        className={className}
        tooltipID={this.props.tooltipID}
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
        <div style={{ display: 'flex' }}>
          <div style={{ width: '80%' }}>
            <p>Name your Data Alert:</p>
            <Input
              className='react-autoql-notification-display-name-input'
              placeholder='Add an Alert Name'
              icon='title'
              maxLength='50'
              value={this.state.titleInput}
              onChange={(e) => {
                const isFirstSectionComplete = this.state.isExpressionSectionComplete && !!e.target.value
                this.setState({
                  titleInput: e.target.value,
                  isFirstSectionComplete,
                })
              }}
            />
          </div>
          <div style={{ width: '20%', marginLeft: 10, marginTop: 35 }}>
            <Icon
              className='react-autoql-data-alert-query-name-tooltip-icon'
              data-for={this.props.tooltipID ?? 'react-autoql-data-alert-query-name-tooltip'}
              data-tip='This will be visible to anyone who gets notified when this Alert is triggered.'
              type='info'
              size={24}
            />
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ width: '80%' }}>
            <p>Notify me when:</p>
            <ExpressionBuilderSimple
              authentication={this.props.authentication}
              ref={(r) => (this.expressionRef = r)}
              key={`expression-${this.NEW_NOTIFICATION_MODAL_ID}`}
              onChange={this.onExpressionChange}
              enableQueryValidation={this.props.enableQueryValidation}
              expression={_get(this.props.currentDataAlert, 'expression', this.state.expressionJSON)}
            />
          </div>
          <div style={{ width: '20%', marginLeft: 10, marginTop: 35 }}>
            <Icon
              className='react-autoql-data-alert-query-name-tooltip-icon'
              data-for={this.props.tooltipID ?? 'react-autoql-data-alert-query-name-tooltip'}
              data-tip='Your query should describe the result you wish to be alerted about.'
              type='info'
              size={24}
            />
          </div>
        </div>
        <div className='step-btn-container'>
          {this.props.enableQueryValidation
            ? this.renderValidateBtn()
            : this.renderNextBtn(
                'first-step-next-btn',
                this.props.enableQueryValidation &&
                  (!this.state.isExpressionValidated || !this.state.isExpressionValid),
              )}
        </div>
      </div>
    )
  }

  renderFrequencyStep = () => {
    return (
      <div>
        <ScheduleBuilder
          ref={(r) => (this.scheduleBuilderRef = r)}
          key={`schedule-${this.NEW_NOTIFICATION_MODAL_ID}`}
          dataAlert={this.props.currentDataAlert}
          onCompletedChange={(isComplete) => {
            this.setState({ isScheduleSectionComplete: isComplete })
          }}
          onErrorCallback={this.props.onErrorCallback}
        />
        <div className='step-btn-container'>
          {this.renderBackBtn('second-step-back-btn')}
          {this.renderNextBtn('second-step-next-btn', !this.state.isScheduleSectionComplete, () =>
            this.setState({ isThirdSectionDirty: true }),
          )}
        </div>
      </div>
    )
  }

  renderAlertPreferencesStep = () => {
    return (
      <div>
        <p>Optional:</p>
        <Input
          className='react-autoql-notification-message-input'
          placeholder='This message will be visible when a notification is sent.'
          area
          maxLength='200'
          value={this.state.messageInput}
          onChange={(e) => this.setState({ messageInput: e.target.value })}
        />
        <div className='step-btn-container'>{this.renderBackBtn('second-step-back-btn')}</div>
      </div>
    )
  }

  onDataAlertDelete = () => {
    const dataAlertId = _get(this.props.currentDataAlert, 'id')
    if (dataAlertId) {
      this.setState({
        isDeletingDataAlert: true,
      })
      deleteDataAlert(dataAlertId, getAuthentication(this.props.authentication))
        .then(() => {
          this.setState({
            isDeletingDataAlert: false,
            isConfirmDeleteModalVisible: false,
          })
          this.props.onDelete(dataAlertId)
          this.props.onClose(false)
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
        complete: this.isFirstSectionComplete(),
        error: this.props.enableQueryValidation && this.state.isExpressionValidated && !this.state.isExpressionValid,
      },
      {
        title: 'Set Notification Preferences',
        content: this.renderFrequencyStep(),
        complete: this.state.isScheduleSectionComplete,
      },
      {
        title: 'Compose Notification Message',
        content: this.renderAlertPreferencesStep(),
        complete: this.state.isThirdSectionDirty || !!this.props.currentDataAlert,
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
          overlayStyle={{ zIndex: '9998' }}
          title={this.props.title}
          titleIcon={
            !_isEmpty(this.props.currentDataAlert) ? (
              <Icon key={`title-icon-${this.COMPONENT_KEY}`} type='edit' />
            ) : (
              <span key={`title-icon-${this.COMPONENT_KEY}`} />
            )
          }
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
                    type='danger'
                    onClick={() => {
                      this.setState({ isConfirmDeleteModalVisible: true })
                    }}
                    loading={this.state.isDeletingDataAlert}
                    tooltipID={this.props.tooltipID}
                  >
                    Delete Data Alert
                  </Button>
                )}
              </div>
              <div>
                <Button
                  tooltipID={this.props.tooltipID}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (this.modalRef) {
                      this.modalRef.onClose()
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type='primary'
                  loading={this.state.isSavingDataAlert}
                  onClick={this.onDataAlertSave}
                  disabled={this.isSaveButtonDisabled(steps)}
                  tooltipID={this.props.tooltipID}
                >
                  {'Finish & Save'}
                </Button>
              </div>
            </div>
          }
        >
          {!this.props.tooltipID && (
            <Tooltip
              className='react-autoql-tooltip'
              id='react-autoql-data-alert-query-name-tooltip'
              effect='solid'
              delayShow={500}
              place='top'
            />
          )}
          {this.props.isVisible && (
            <div className='react-autoql-data-alert-modal-content'>
              <Steps ref={(r) => (this.stepsRef = r)} steps={steps} isEditMode={!!this.props?.currentDataAlert?.id} />
            </div>
          )}
        </Modal>
        <ConfirmModal
          isVisible={this.state.isConfirmDeleteModalVisible}
          onConfirm={this.onDataAlertDelete}
          confirmLoading={this.state.isDeletingDataAlert}
          onClose={() => {
            this.setState({ isConfirmDeleteModalVisible: false })
          }}
          confirmText='Delete'
          width='450px'
        >
          <h3>Are you sure you want to delete this Data Alert?</h3>
          <p>You will no longer be notified about these changes in your data.</p>
        </ConfirmModal>
      </ErrorBoundary>
    )
  }
}

export default withTheme(DataAlertModal)
