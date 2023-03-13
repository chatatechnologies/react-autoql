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
import { DATA_ALERT_CONDITION_TYPES } from '../../../js/Constants'

import './DataAlertModalV2.scss'

class DataAlertModalV2 extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.NEW_NOTIFICATION_MODAL_ID = uuid()
    this.TOOLTIP_ID = `react-autoql-data-alert-modal-tooltip-${this.COMPONENT_KEY}`
    this.CONDITIONS_STEP = 'CONDITIONS'
    this.FREQUENCY_STEP = 'FREQUENCY'
    this.MESSAGE_STEP = 'MESSAGE'
    this.COMPARE_TYPE = 'COMPARE'
    this.EXISTS_TYPE = 'EXISTS'

    this.SUPPORTED_CONDITION_TYPES = this.getSupportedConditionTypes(props.queryResponse)

    this.steps = [
      { title: 'Configure Timing', value: this.FREQUENCY_STEP },
      { title: 'Compose Message', value: this.MESSAGE_STEP },
    ]

    if (this.SUPPORTED_CONDITION_TYPES?.includes(this.COMPARE_TYPE)) {
      this.steps.unshift({ title: 'Set Up Conditions', value: this.CONDITIONS_STEP })
    }

    this.state = {
      titleInput: '',
      messageInput: '',
      expressionJSON: [],
      isDataReturnDirty: false,
      isConfirmDeleteModalVisible: false,
      selectedConditionType: this.SUPPORTED_CONDITION_TYPES?.[0],
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

    if (this.state.activeStep !== prevState.activeStep) {
      if (this.state.activeStep === this.getStepNumber(this.MESSAGE_STEP)) {
        this.alertTitleInput?.focus()
      }
    }

    if (!this.state.isFrequencySectionReady && prevState.isFrequencySectionReady) {
      // If condition step changed and it affected the frequency step
      // Then set frequency section back to incomplete
      const frequencyStepNumber = this.getStepNumber(this.FREQUENCY_STEP)
      const newCompletedSections = [...this.state.completedSections]
      newCompletedSections[frequencyStepNumber] = false
      this.setState({ completedSections: newCompletedSections })
    }

    if (
      this.props.initialQuery !== prevProps.initialQuery ||
      this.props.queryResponse?.data?.data?.text !== prevProps.queryResponse?.data?.data?.text
    ) {
      this.resetFields()
      const expressionJSON = this.createExpressionJSONFromQuery(this.props.initialQuery, this.props.userSelection)
      this.setState({
        expressionJSON,
      })
    }
  }

  resetFields = () => {
    this.conditionSectionReady = false
    this.messageSectionReady = false

    this.setState({
      activeStep: 0,
      isFrequencySectionReady: false,
      expressionJSON: [],
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
                condition: this.EXISTS_TYPE,
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
    try {
      // 1. EXISTS - When new data is detected for the query
      // 2. COMPARE - When a certain condition is met

      if (isSingleValueResponse(queryResponse) || isAggregation(queryResponse?.data?.data?.columns)) {
        return [this.COMPARE_TYPE]
      }

      return [this.EXISTS_TYPE]
    } catch (error) {
      console.error(error)
      return []
    }
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
    if (this.SUPPORTED_CONDITION_TYPES?.includes(this.COMPARE_TYPE) && this.expressionRef?._isMounted) {
      return this.expressionRef?.isComplete()
    }

    return true
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
    if (!this.isStepReady()) {
      return
    }

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
    const isLastStep = this.state.activeStep === this.steps.length - 1
    if (isLastStep) {
      return (
        <Button
          type='primary'
          loading={this.state.isSavingDataAlert}
          onClick={this.onDataAlertSave}
          disabled={!!this.steps.find((s, i) => !this.state.completedSections[i])}
          tooltipID={this.TOOLTIP_ID}
        >
          {'Finish & Save'}
        </Button>
      )
    }

    return (
      <Button
        className='react-autoql-data-alert-next-btn'
        onClick={this.nextStep}
        disabled={!this.isStepReady()}
        type='primary'
        tooltipID={this.TOOLTIP_ID}
      >
        Continue
      </Button>
    )
  }

  renderBackBtn = (className) => {
    if (this.state.activeStep === 0) {
      return null
    }

    return (
      <Button className={className} tooltipID={this.TOOLTIP_ID} onClick={this.previousStep}>
        Back
      </Button>
    )
  }

  renderCancelBtn = () => {
    return (
      <Button
        tooltipID={this.TOOLTIP_ID}
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
    )
  }

  renderDeleteBtn = () => {
    return (
      <Button
        type='danger'
        onClick={() => {
          this.setState({ isConfirmDeleteModalVisible: true })
        }}
        loading={this.state.isDeletingDataAlert}
        tooltipID={this.TOOLTIP_ID}
      >
        Delete Data Alert
      </Button>
    )
  }

  renderFooter = () => {
    return (
      <div ref={(r) => (this.footerElement = r)} className='react-autoql-data-alert-modal-footer'>
        <div>{this.props.currentDataAlert && this.props.allowDelete && this.renderDeleteBtn()}</div>
        <div>
          {this.renderCancelBtn()}
          {this.renderBackBtn()}
          {this.renderNextBtn()}
        </div>
      </div>
    )
  }

  renderDataAlertNameInput = () => {
    return (
      <div className='data-alert-name-input-section'>
        <div className='react-autoql-input-label'>
          <span>
            Notification title{' '}
            <Icon
              className='react-autoql-data-alert-modal-tooltip-icon'
              data-for={this.TOOLTIP_ID}
              data-tip='This will be visible to anyone who gets notified when this Alert is triggered.'
              type='info'
            />
          </span>
        </div>
        <Input
          ref={(r) => (this.alertTitleInput = r)}
          className='react-autoql-notification-display-name-input'
          placeholder='Add an Alert Title'
          icon='title'
          maxLength='50'
          value={this.state.titleInput}
          onChange={(e) => {
            this.setState({ titleInput: e.target.value })
          }}
        />
      </div>
    )
  }

  renderDataAlertMessageInput = () => {
    return (
      <>
        <div className='react-autoql-input-label'>Notification message (optional)</div>
        <Input
          className='react-autoql-notification-message-input'
          placeholder='This message will be visible when a notification is sent.'
          area
          maxLength='200'
          value={this.state.messageInput}
          onChange={(e) => this.setState({ messageInput: e.target.value })}
        />
      </>
    )
  }

  renderConditionTypeSelector = () => {
    const options = this.SUPPORTED_CONDITION_TYPES?.map((type) => {
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
    if (this.state.selectedConditionType === this.EXISTS_TYPE) {
      return 'Description: Notification will be triggered when new data is detected'
    }

    return null
  }

  renderConditionsStep = (active) => {
    return (
      <div className={`react-autoql-data-alert-modal-step ${active ? '' : 'hidden'}`}>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>
            {/* <p className='data-alert-modal-condition-title'>
              Trigger the Data Alert when the following conditions are met:
            </p> */}
            {this.SUPPORTED_CONDITION_TYPES?.includes(this.COMPARE_TYPE) && (
              <ExpressionBuilderSimpleV2
                authentication={this.props.authentication}
                ref={(r) => (this.expressionRef = r)}
                key={`expression-${this.NEW_NOTIFICATION_MODAL_ID}`}
                onChange={this.onExpressionChange}
                expression={this.props.currentDataAlert?.expression ?? this.state.expressionJSON}
                queryResponse={this.props.queryResponse}
                tooltipID={this.TOOLTIP_ID}
                onLastInputEnterPress={this.nextStep}
              />
            )}
          </div>
          {/* <div style={{ width: '20%', marginLeft: 10, marginTop: 35, flex: 0 }}>
            <Icon
              className='react-autoql-data-alert-modal-tooltip-icon'
              data-for={this.props.tooltipID ?? 'react-autoql-data-alert-modal-tooltip'}
              data-tip='Your query should describe the result you wish to be alerted about.'
              type='info'
              size={24}
            />
          </div> */}
        </div>
        <div>
          {this.SUPPORTED_CONDITION_TYPES?.length > 1
            ? this.renderConditionTypeSelector()
            : this.renderConditionTypeDescription()}
        </div>
      </div>
    )
  }

  renderFrequencyStep = (active) => {
    return (
      <div className={`react-autoql-data-alert-modal-step ${active ? '' : 'hidden'}`}>
        <ScheduleBuilderV2
          ref={(r) => (this.scheduleBuilderRef = r)}
          key={`schedule-${this.NEW_NOTIFICATION_MODAL_ID}`}
          dataAlert={this.props.currentDataAlert}
          onCompletedChange={(isComplete) => this.setState({ isFrequencySectionReady: isComplete })}
          onErrorCallback={this.props.onErrorCallback}
          conditionType={this.state.selectedConditionType}
          queryResponse={this.props.queryResponse}
        />
      </div>
    )
  }

  renderComposeMessageStep = (active) => {
    return (
      <div className={`react-autoql-data-alert-modal-step ${active ? '' : 'hidden'}`}>
        {this.renderDataAlertNameInput()}
        {this.renderDataAlertMessageInput()}
      </div>
    )
  }

  getStepNumber = (stepValue) => {
    const stepNumber = this.steps.findIndex((step) => step.value && stepValue && step.value === stepValue)
    return stepNumber
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

    return (
      <>
        {this.renderConditionsStep(activeStep === this.getStepNumber(this.CONDITIONS_STEP))}
        {this.renderFrequencyStep(activeStep === this.getStepNumber(this.FREQUENCY_STEP))}
        {this.renderComposeMessageStep(activeStep === this.getStepNumber(this.MESSAGE_STEP))}
      </>
    )
  }

  isStepReady = () => {
    const { activeStep } = this.state
    const stepName = this.steps?.[activeStep]?.value

    switch (stepName) {
      case this.CONDITIONS_STEP: {
        return this.isConditionSectionReady()
      }
      case this.FREQUENCY_STEP: {
        return this.state.isFrequencySectionReady
      }
      case this.MESSAGE_STEP: {
        return !!this.state.titleInput
      }
      default: {
        return false
      }
    }
  }

  getTitleIcon = () => {
    if (!_isEmpty(this.props.currentDataAlert)) {
      return <Icon key={`title-icon-${this.COMPONENT_KEY}`} type='edit' />
    }

    return <span key={`title-icon-${this.COMPONENT_KEY}`} />
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Modal
          contentClassName='react-autoql-data-alert-creation-modal'
          overlayStyle={{ zIndex: '9998' }}
          title={this.props.title}
          titleIcon={this.getTitleIcon()}
          ref={(r) => (this.modalRef = r)}
          isVisible={this.props.isVisible}
          onClose={this.props.onClose}
          confirmOnClose={true}
          enableBodyScroll
          width='850px'
          footer={this.renderFooter()}
        >
          {/* We must render a new <Tooltip/> inside of modals */}
          <Tooltip className='react-autoql-tooltip' id={this.TOOLTIP_ID} effect='solid' delayShow={500} place='top' />
          {this.props.isVisible && (
            <div className='react-autoql-data-alert-modal-content'>
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
