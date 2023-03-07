import React from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import _isEmpty from 'lodash.isempty'
import { v4 as uuid } from 'uuid'

import { Modal } from '../../Modal'
import { ConfirmModal } from '../../ConfirmModal'
import { Input } from '../../Input'
import { Button } from '../../Button'
import { Icon } from '../../Icon'
import { Tooltip } from '../../Tooltip'
import { ScheduleBuilderV2 } from '../ScheduleBuilderV2'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { StepsHoz } from '../../StepsHoz'
import { ExpressionBuilderSimpleV2 } from '../ExpressionBuilderSimpleV2'
import { Select } from '../../Select'

import { createDataAlert, updateDataAlert, deleteDataAlert } from '../../../js/notificationService'
import { isSingleValueResponse } from '../../../js/Util'
import { isAggregation } from '../../QueryOutput/columnHelpers'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'
import { withTheme } from '../../../theme'
import { constructRTArray } from '../../../js/reverseTranslationHelpers'
import { DATA_ALERT_CONDITION_TYPES } from '../../../js/Constants'

import './DataAlertModalV2.scss'

class DataAlertModalV2 extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.NEW_NOTIFICATION_MODAL_ID = uuid()

    this.supportedConditionTypes = this.getSupportedConditionTypes(props.queryResponse)

    this.steps = [
      { title: 'Set Up Your Alert' },
      { title: 'Set Notification Preferences' },
      { title: 'Compose Notification Message' },
    ]

    this.state = {
      titleInput: '',
      messageInput: '',
      expressionJSON: [],
      isScheduleSectionComplete: false,
      isDataReturnDirty: false,
      isConfirmDeleteModalVisible: false,
      selectedConditionType: this.supportedConditionTypes?.[0],
      activeStep: 0,
      completedSections: [],
    }
  }

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSave: PropTypes.func,
    initialQuery: PropTypes.string,
    queryResponse: PropTypes.shape({}),
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
        expressionJSON: this.props.currentDataAlert?.expression,
      })
    } else if (this.props.initialQuery && typeof this.props.initialQuery === 'string') {
      const expressionJSON = this.createExpressionJSONFromQuery(this.props.initialQuery, this.props.userSelection)
      this.setState({
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

  getSupportedConditionTypes = (queryResponse) => {
    // 1. when new data is detected
    // 2. when a certain condition is met
    if (isSingleValueResponse(queryResponse) || isAggregation(queryResponse?.data?.data?.columns)) {
      return ['COMPARE']
    }

    return ['EXISTS']
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
        id: this.props.currentDataAlert?.id,
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
      expressionJSON,
    })
  }

  isConditionSectionReady = () => {
    // console.log('is rule complete?', this.expressionRef?.isComplete())
    if (this.state.activeStep === 0) {
      this.conditionSectionReady = this.expressionRef?.isComplete()
    }

    return this.conditionSectionReady
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

  nextStep = () => {
    const completedSections = [...this.state.completedSections]
    completedSections[this.state.activeStep] = true

    this.setState({
      activeStep: this.state.activeStep + 1,
      completedSections,
    })
  }

  previousStep = () => {
    if (this.state.activeStep > 0) {
      this.setState({
        activeStep: this.state.activeStep - 1,
      })
    }
  }

  setStep = (step) => {
    const state = { activeStep: step }

    if (step === 2) {
      state.isThirdSectionDirty = true
    }

    this.setState(state)
  }

  renderNextBtn = () => {
    return (
      <Button
        className='react-autoql-data-alert-next-btn'
        onClick={this.nextStep}
        disabled={!this.isStepReady(this.state.activeStep)}
        type='primary'
        tooltipID={this.props.tooltipID}
      >
        Continue
      </Button>
    )
  }

  renderBackBtn = (className) => {
    return (
      <Button className={className} tooltipID={this.props.tooltipID} onClick={this.previousStep}>
        Back
      </Button>
    )
  }

  renderDataAlertNameInput = () => {
    return (
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
              this.setState({ titleInput: e.target.value })
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
    )
  }

  renderDataAlertMessageInput = () => {
    return (
      <p>
        Optional:
        <Input
          className='react-autoql-notification-message-input'
          placeholder='This message will be visible when a notification is sent.'
          type='multi'
          maxLength='200'
          value={this.state.messageInput}
          onChange={(e) => this.setState({ messageInput: e.target.value })}
        />
      </p>
    )
  }

  renderChunkedInterpretation = () => {
    const parsedRT = this.props.queryResponse?.data?.data?.parsed_interpretation
    const rtArray = constructRTArray(parsedRT)

    console.log({ rtArray })

    if (!parsedRT?.length) {
      return this.props.queryResponse?.data?.data?.text
    }

    return rtArray.map((chunk, i) => {
      let text = chunk.eng
      const type = chunk.c_type

      if (!text || !type) {
        return null
      }

      if (i === 0) {
        text = text[0].toUpperCase() + text.substring(1)
      }

      if (type === 'VL_SUFFIX' || type === 'DELIM') {
        return null
      }

      return (
        <span key={`data-alert-chunked-rt-${this.COMPONENT_KEY}-${i}`} className={`data-alert-chunked-rt ${type}`}>
          {text}{' '}
        </span>
      )
    })
  }

  renderConditionTypeSelector = () => {
    const options = this.supportedConditionTypes?.map((type) => {
      const conditionObj = DATA_ALERT_CONDITION_TYPES[type]
      return {
        value: type,
        label: conditionObj.displayName,
      }
    })

    return (
      <Select
        style={{ width: '100%' }}
        options={options}
        value={this.state.selectedConditionType}
        className='react-autoql-rule-condition-type-select'
        onChange={(value) => {
          this.setState({ selectedConditionType: value })
        }}
      />
    )
  }

  renderConditionTypeDescription = () => {
    if (this.state.selectedConditionType === 'EXISTS') {
      return 'Desciption: Notification will be triggered when new data is detected'
    }

    return null
  }

  renderSetUpDataAlertStep = () => {
    return (
      <div>
        <div>
          <p>
            Query:
            <br />
            {this.renderChunkedInterpretation()}
            {/* <strong>{this.props.queryResponse?.data?.data?.text}</strong> */}
          </p>
        </div>
        <div>
          {this.supportedConditionTypes?.length > 1
            ? this.renderConditionTypeSelector()
            : this.renderConditionTypeDescription()}
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>
            <p>Notify me when:</p>
            <ExpressionBuilderSimpleV2
              authentication={this.props.authentication}
              ref={(r) => (this.expressionRef = r)}
              key={`expression-${this.NEW_NOTIFICATION_MODAL_ID}`}
              onChange={this.onExpressionChange}
              expression={this.props.currentDataAlert?.expression ?? this.state.expressionJSON}
              queryResponse={this.props.queryResponse}
            />
          </div>
          {/* <div style={{ width: '20%', marginLeft: 10, marginTop: 35, flex: 0 }}>
            <Icon
              className='react-autoql-data-alert-query-name-tooltip-icon'
              data-for={this.props.tooltipID ?? 'react-autoql-data-alert-query-name-tooltip'}
              data-tip='Your query should describe the result you wish to be alerted about.'
              type='info'
              size={24}
            />
          </div> */}
        </div>
      </div>
    )
  }

  renderFrequencyStep = () => {
    return (
      <div>
        <ScheduleBuilderV2
          ref={(r) => (this.scheduleBuilderRef = r)}
          key={`schedule-${this.NEW_NOTIFICATION_MODAL_ID}`}
          dataAlert={this.props.currentDataAlert}
          onCompletedChange={(isComplete) => {
            this.setState({ isScheduleSectionComplete: isComplete })
          }}
          onErrorCallback={this.props.onErrorCallback}
        />
        {/* <div className='step-btn-container'> */}
        {/* {this.renderBackBtn('second-step-back-btn')} */}
        {/* {this.renderNextBtn('second-step-next-btn', !this.state.isScheduleSectionComplete, () =>
            this.setState({ isThirdSectionDirty: true }),
          )} */}
        {/* </div> */}
      </div>
    )
  }

  renderAlertPreferencesStep = () => {
    return (
      <div>
        {this.renderDataAlertNameInput()}
        {this.renderDataAlertMessageInput()}
      </div>
    )
  }

  onDataAlertDelete = () => {
    const dataAlertId = this.props.currentDataAlert?.id
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

  renderContent = () => {
    const { activeStep } = this.state
    switch (activeStep) {
      case 0: {
        return this.renderSetUpDataAlertStep()
      }
      case 1: {
        return this.renderFrequencyStep()
      }
      case 2: {
        return this.renderAlertPreferencesStep()
      }
      default: {
        return null
      }
    }
  }

  isStepReady = (step) => {
    switch (step) {
      case 0: {
        return this.isConditionSectionReady()
      }
      default: {
        return false
      }
      // case 1: {
      //   return this.state.isScheduleSectionComplete
      // }
      // case 2: {
      //   return this.state.isThirdSectionDirty || !!this.props.currentDataAlert
      // }
    }
  }

  isSaveButtonDisabled = () => {
    return !!this.steps.find((step, i) => !this.state.completedSections[i])
  }

  render = () => {
    console.log('is first step ready:', this.isConditionSectionReady())

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
                  border={false}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (this.modalRef) {
                      this.modalRef.onClose()
                    }
                  }}
                >
                  Cancel
                </Button>
                {this.state.activeStep !== 0 && this.renderBackBtn()}
                {this.state.activeStep === this.steps.length - 1 ? (
                  <Button
                    type='primary'
                    loading={this.state.isSavingDataAlert}
                    onClick={this.onDataAlertSave}
                    disabled={this.isSaveButtonDisabled()}
                    tooltipID={this.props.tooltipID}
                  >
                    {'Finish & Save'}
                  </Button>
                ) : (
                  this.renderNextBtn()
                )}
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
            <div className='notification-modal-content'>
              <StepsHoz
                activeStep={this.state.activeStep}
                onStepChange={this.setStep}
                steps={this.steps.map((step, i) => {
                  return {
                    title: step.title,
                    complete: this.state.completedSections[i],
                  }
                })}
              />
              {this.renderContent()}
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
          backText='Go back'
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

export default withTheme(DataAlertModalV2)
