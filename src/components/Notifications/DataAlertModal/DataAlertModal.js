import React from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import _isEmpty from 'lodash.isempty'
import { v4 as uuid } from 'uuid'

import { Modal } from '../../Modal'
import { Input } from '../../Input'
import { Button } from '../../Button'
import { Icon } from '../../Icon'
import { Tooltip } from '../../Tooltip'
import { ScheduleBuilder } from '../ScheduleBuilder'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { StepsHoz } from '../../StepsHoz'
import { ConditionBuilder } from '../ConditionBuilder'
import { Select } from '../../Select'
import { DataAlertDeleteDialog } from '../DataAlertDeleteDialog'
import NotificationItem from '../NotificationItem/NotificationItem'

import { createDataAlert, updateDataAlert } from '../../../js/notificationService'
import { isSingleValueResponse } from '../../../js/Util'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'
import { withTheme } from '../../../theme'
import { DATA_ALERT_CONDITION_TYPES, COMPARE_TYPE, EXISTS_TYPE, QUERY_TERM_TYPE } from '../DataAlertConstants'

import './DataAlertModal.scss'

class DataAlertModal extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.COMPONENT_KEY = uuid()
    this.SAMPLE_CREATED_AT = new Date()
    this.TOOLTIP_ID = `react-autoql-data-alert-modal-tooltip-${this.COMPONENT_KEY}`
    this.CONDITIONS_STEP = 'CONDITIONS'
    this.FREQUENCY_STEP = 'FREQUENCY'
    this.MESSAGE_STEP = 'MESSAGE'

    this.steps = this.getSteps(props)
    this.state = this.getInitialState(props)
  }

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSave: PropTypes.func,
    queryResponse: PropTypes.shape({}),
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
    editView: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onSave: () => {},
    onErrorCallback: () => {},
    currentDataAlert: undefined,
    isVisible: false,
    allowDelete: true,
    onClose: () => {},
    isManagement: false,
    onManagementCreateDataAlert: () => {},
    onManagementDeleteDataAlert: () => {},
    onClosed: () => {},
    onOpened: () => {},
    titleIcon: undefined,
    enableQueryValidation: true,
    onValidate: undefined,
    editView: false,
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!this.props.isVisible && prevProps.isVisible) {
      setTimeout(this.initializeFields, 500)
      this.props.onClosed()
    }

    if (this.props.isVisible && !prevProps.isVisible) {
      this.initializeFields()
    } else if (this.props.isVisible) {
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
    }
  }

  getSteps = (initialProps) => {
    const props = initialProps ?? this.props
    this.SUPPORTED_CONDITION_TYPES = this.getSupportedConditionTypes(props)
    const needsConditions = this.SUPPORTED_CONDITION_TYPES?.includes(COMPARE_TYPE)

    let steps = [
      { title: 'Configure Timing', value: this.FREQUENCY_STEP },
      { title: 'Customize Appearance', value: this.MESSAGE_STEP },
    ]

    if (needsConditions) {
      steps.unshift({ title: 'Set Up Conditions', value: this.CONDITIONS_STEP })
    }

    return steps
  }

  getInitialState = (initialProps) => {
    const props = initialProps ?? this.props

    const state = {
      titleInput: '',
      messageInput: '',
      expressionJSON: [],
      isConfirmDeleteModalVisible: false,
      selectedConditionType: this.SUPPORTED_CONDITION_TYPES?.[0],
      activeStep: 0,
      completedSections: [],
      expressionKey: uuid(),
      isMounted: false,
    }

    if (props.currentDataAlert) {
      const { currentDataAlert } = props
      state.titleInput = currentDataAlert.title ?? ''
      state.messageInput = currentDataAlert.message ?? ''
      state.selectedConditionType = currentDataAlert.expression?.[0]?.condition ?? this.SUPPORTED_CONDITION_TYPES?.[0]
      state.activeStep = 0
      state.completedSections = this.steps.map(() => true)
      state.expressionJSON = currentDataAlert?.expression
    }

    return state
  }

  initializeFields = (props) => {
    this.steps = this.getSteps(props)
    this.setState(this.getInitialState(props))
  }

  getSupportedConditionTypes = (props) => {
    try {
      // 1. EXISTS - When new data is detected for the query
      // 2. COMPARE - When a certain condition is met

      if (props.currentDataAlert) {
        const firstCondition = props.currentDataAlert?.expression?.[0]?.condition
        if (firstCondition && firstCondition === EXISTS_TYPE) {
          return [EXISTS_TYPE]
        }

        return [COMPARE_TYPE]
      }

      // Currently single value response queries are the only
      // queries that support custom conditions
      if (isSingleValueResponse(props.queryResponse)) {
        return [COMPARE_TYPE]
      }

      return [EXISTS_TYPE]
    } catch (error) {
      console.error(error)
      return []
    }
  }

  getDataAlertData = () => {
    try {
      const { currentDataAlert, queryResponse } = this.props
      const { titleInput, messageInput } = this.state

      let dataReturnQuery
      let expressionJSON = _cloneDeep(this.state.expressionJSON)

      if (this.expressionRef) {
        dataReturnQuery = this.expressionRef.getFirstQuery()
        expressionJSON = this.expressionRef.getJSON()
      } else if (currentDataAlert) {
        dataReturnQuery = currentDataAlert.data_return_query
        expressionJSON = currentDataAlert.expression
      } else {
        const query = queryResponse?.data?.data?.text

        dataReturnQuery = query
        expressionJSON = [
          {
            id: uuid(),
            term_type: QUERY_TERM_TYPE,
            condition: EXISTS_TYPE,
            term_value: query,
            user_selection: queryResponse?.data?.data?.fe_req?.disambiguation,
          },
        ]
      }

      let scheduleData = {}
      if (this.scheduleBuilderRef) {
        scheduleData = this.scheduleBuilderRef.getData()
      }

      const filters = currentDataAlert?.filters ?? [
        ...(queryResponse?.data?.data?.persistent_locked_conditions ?? []),
        ...(queryResponse?.data?.data?.session_locked_conditions ?? []),
      ]

      const newDataAlert = {
        id: currentDataAlert?.id,
        title: titleInput,
        data_return_query: dataReturnQuery,
        message: messageInput,
        expression: expressionJSON,
        notification_type: scheduleData.notificationType,
        reset_period: scheduleData.resetPeriod,
        time_zone: scheduleData.timezone,
        schedules: scheduleData.schedules,
        filters,
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
    if (this.SUPPORTED_CONDITION_TYPES?.includes(COMPARE_TYPE) && this.expressionRef?._isMounted) {
      return this.expressionRef?.isComplete()
    }

    return true
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
    this.setState({ activeStep: step })
  }

  isFinishBtnDisabled = () => {
    const lastStep = this.steps.length - 1
    const hasUnfinishedStep = !!this.steps.find((s, i) => {
      if (i === lastStep) {
        return false
      }
      return !this.state.completedSections[i]
    })

    const isLastStepReady = this.isStepReady(lastStep)

    return hasUnfinishedStep || !isLastStepReady
  }

  renderNextBtn = () => {
    const isLastStep = this.state.activeStep === this.steps.length - 1
    if (isLastStep) {
      return (
        <Button
          type='primary'
          loading={this.state.isSavingDataAlert}
          onClick={this.onDataAlertSave}
          disabled={this.isFinishBtnDisabled()}
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
        Next
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
        tooltipID={this.TOOLTIP_ID}
      >
        Delete Data Alert
      </Button>
    )
  }

  renderFooter = () => {
    return (
      <div ref={(r) => (this.footerElement = r)} className='react-autoql-data-alert-modal-footer'>
        <div className='modal-footer-button-container'>
          {this.props.currentDataAlert && this.props.allowDelete && this.renderDeleteBtn()}
        </div>
        <div className='modal-footer-button-container'>
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
        <div className='react-autoql-input-label'>Title</div>
        <Input
          ref={(r) => (this.alertTitleInput = r)}
          className='react-autoql-notification-display-name-input'
          placeholder='eg. "Budget alert!"'
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
        <div className='react-autoql-input-label'>Message (optional)</div>
        <Input
          className='react-autoql-notification-message-input'
          placeholder='eg. "You have spent 80% of your budget for the month."'
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
    if (this.state.selectedConditionType === EXISTS_TYPE) {
      return 'Description: Notification will be triggered when new data is detected'
    }

    return null
  }

  renderConditionsStep = (active) => {
    return (
      <div className={`react-autoql-data-alert-modal-step ${active ? '' : 'hidden'}`}>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>
            {this.SUPPORTED_CONDITION_TYPES?.includes(COMPARE_TYPE) && (
              <ConditionBuilder
                authentication={this.props.authentication}
                ref={(r) => (this.expressionRef = r)}
                key={`expression-${this.state.expressionKey}`}
                onChange={this.onExpressionChange}
                expression={this.props.currentDataAlert?.expression ?? this.state.expressionJSON}
                queryResponse={this.props.queryResponse}
                tooltipID={this.TOOLTIP_ID}
                onLastInputEnterPress={this.nextStep}
              />
            )}
          </div>
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
        <ScheduleBuilder
          ref={(r) => (this.scheduleBuilderRef = r)}
          key={`schedule-${this.COMPONENT_KEY}`}
          dataAlert={this.props.currentDataAlert}
          onCompletedChange={(isComplete) => this.setState({ isFrequencySectionReady: isComplete })}
          onErrorCallback={this.props.onErrorCallback}
          conditionType={this.state.selectedConditionType}
          queryResponse={this.props.queryResponse}
          expressionRef={this.expressionRef}
          tooltipID={this.TOOLTIP_ID}
        />
      </div>
    )
  }

  renderDataAlertPreview = () => {
    return (
      <div className='data-alert-preview'>
        <NotificationItem
          authentication={this.props.authentication}
          notification={{
            id: `preview-${this.COMPONENT_KEY}`,
            title: this.state.titleInput || (
              <span>
                <em>{'[Title]'}</em>
              </span>
            ),
            message: this.state.messageInput,
            created_at: this.SAMPLE_CREATED_AT.toISOString(),
            state: 'UNACKNOWLEDGED',
            data_return_query: this.props.queryResponse?.data?.data?.text,
            expanded: false, // this.state.isPreviewExpanded,
          }}
        />
      </div>
    )
  }

  getConditionStatement = () => {
    let conditions = this.expressionRef?.getConditionStatement()
    if (!conditions) {
      conditions = `new data is detected for "${this.props.queryResponse?.data?.data?.text}"`
    }

    return conditions
  }

  renderComposeMessageStep = (active) => {
    const conditionStatement = this.getConditionStatement()

    return (
      <div className={`react-autoql-data-alert-modal-step ${active ? '' : 'hidden'}`}>
        {conditionStatement ? (
          <span>
            If <em>{conditionStatement}</em>, you'll receive a notification with this{' '}
            <strong>title and message:</strong>
          </span>
        ) : null}
        <div className='compose-message-section'>
          <div className='form-section'>
            {this.renderDataAlertNameInput()}
            {this.renderDataAlertMessageInput()}
          </div>
          <div className='preview-section'>
            <div className='react-autoql-input-label'>Preview</div>
            {this.renderDataAlertPreview()}
          </div>
        </div>
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
      this.setState({ isConfirmDeleteModalVisible: false })
      this.props.onDelete(dataAlertId)
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
    const query = this.props.queryResponse?.data?.data?.text
    return (
      <ErrorBoundary>
        <Modal
          contentClassName='react-autoql-data-alert-creation-modal'
          overlayStyle={{ zIndex: '9998' }}
          title={this.props.editView ? 'Data Alert Settings' : 'Create Data Alert'}
          titleIcon={this.getTitleIcon()}
          subtitle={query ? `"${query}"` : undefined}
          ref={(r) => (this.modalRef = r)}
          isVisible={this.props.isVisible}
          onClose={this.props.onClose}
          confirmOnClose={true}
          enableBodyScroll
          width='1000px'
          footer={this.renderFooter()}
          onOpened={this.props.onOpened}
          onClosed={this.props.onClosed}
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
        <DataAlertDeleteDialog
          authentication={this.props.authentication}
          dataAlertId={this.props.currentDataAlert?.id}
          isVisible={this.state.isConfirmDeleteModalVisible}
          onDelete={this.onDataAlertDelete}
          onClose={() => this.setState({ isConfirmDeleteModalVisible: false })}
          onErrorCallback={this.props.onErrorCallback}
          onSuccessAlert={this.props.onSuccessAlert}
        />
      </ErrorBoundary>
    )
  }
}

export default withTheme(DataAlertModal)
