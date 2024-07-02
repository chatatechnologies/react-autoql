import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEmpty from 'lodash.isempty'
import _cloneDeep from 'lodash.clonedeep'

import {
  EXISTS_TYPE,
  COMPARE_TYPE,
  QUERY_TERM_TYPE,
  createDataAlert,
  updateDataAlert,
  getAuthentication,
  dataFormattingDefault,
  authenticationDefault,
  getSupportedConditionTypes,
  CONTINUOUS_TYPE,
  SCHEDULED_TYPE,
  createManagementDataAlert,
  updateManagementDataAlert,
  autoQLConfigDefault,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { Modal } from '../../Modal'
import { Button } from '../../Button'
import { Tooltip } from '../../Tooltip'
import { StepsHoz } from '../../StepsHoz'
import { ScheduleBuilder } from '../ScheduleBuilder'
import { ConditionBuilder } from '../ConditionBuilder'
import { MultilineButton } from '../../MultilineButton'
import { CustomScrollbars } from '../../CustomScrollbars'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { DataAlertDeleteDialog } from '../DataAlertDeleteDialog'
import AppearanceSection from '../DataAlertSettings/AppearanceSection'
import DataAlertSettings from '../DataAlertSettings/DataAlertSettings'

import { withTheme } from '../../../theme'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'

import './DataAlertModal.scss'
import AlphaAlertsSettings from '../DataAlertSettings/AlphaAlertsSettings'
import { CollapsableSection } from '../../Card'

class DataAlertModal extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.TOOLTIP_ID = `react-autoql-data-alert-modal-tooltip-${this.COMPONENT_KEY}`
    this.CONDITIONS_STEP = 'CONDITIONS'
    this.FREQUENCY_STEP = 'FREQUENCY'
    this.MESSAGE_STEP = 'MESSAGE'
    this.TYPE_STEP = 'TYPE'

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
    onSuccessAlert: PropTypes.func,
    enableQueryValidation: PropTypes.bool,
    onClosed: PropTypes.func,
    onOpened: PropTypes.func,
    dataFormatting: dataFormattingType,
    autoQLConfig: autoQLConfigType,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onSave: () => {},
    onErrorCallback: () => {},
    currentDataAlert: undefined,
    dataAlertType: CONTINUOUS_TYPE,
    isVisible: false,
    allowDelete: true,
    onClose: () => {},
    onSuccessAlert: () => {},
    onClosed: () => {},
    onOpened: () => {},
    enableQueryValidation: true,
    dataFormatting: dataFormattingDefault,
    autoQLConfig: autoQLConfigDefault,
    enableAlphaAlertSettings: false,
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
          this.appearanceSectionRef?.focusTitleInput()
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

  showConditionsStep = () => {
    return this.conditionsEditable() || this.hasFilters()
  }

  getFilters = (props = this.props) => {
    let lockedFilters = []
    let tableFilters = []

    if (!props.queryResponse) {
      lockedFilters = props.initialData[0]?.session_filter_locks ?? []
      tableFilters = props.initialData[0]?.filters ?? []
    } else {
      const persistentFilters = props.queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
      const sessionFilters = props.queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
      lockedFilters = [...persistentFilters, ...sessionFilters] ?? []
      tableFilters = props.filters ?? []
    }

    const tableFiltersFormatted =
      tableFilters.map((filter) => ({
        ...filter,
        value: filter?.displayValue ?? filter?.value,
        type: 'table',
      })) ?? []

    const lockedFiltersFormatted = lockedFilters.map((filter) => ({
      ...filter,
      type: 'locked',
    }))

    const allFilters = [...tableFiltersFormatted, ...lockedFiltersFormatted]

    return allFilters
  }

  getSteps = (initialProps = this.props) => {
    const props = initialProps ?? this.props
    this.SUPPORTED_CONDITION_TYPES = getSupportedConditionTypes(props.currentDataAlert?.expression, props.queryResponse)

    const steps = [
      { title: 'Choose Alert Type', value: this.TYPE_STEP },
      { title: 'Set Up Conditions', value: this.CONDITIONS_STEP },
      { title: 'Configure Timing', value: this.FREQUENCY_STEP },
      { title: 'Customize Appearance', value: this.MESSAGE_STEP },
    ]

    return steps
  }

  getInitialState = (initialProps) => {
    const props = initialProps ?? this.props

    const steps = this.getSteps(initialProps)

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
      dataAlertType: CONTINUOUS_TYPE,
      isSettingsFormComplete: true,
      billingUnitsInput: '',
      descriptionInput: '',
    }

    if (props.currentDataAlert) {
      const { currentDataAlert } = props
      state.titleInput = currentDataAlert.title ?? ''
      state.messageInput = currentDataAlert.message ?? ''
      state.selectedConditionType = currentDataAlert.expression?.[0]?.condition ?? this.SUPPORTED_CONDITION_TYPES?.[0]
      state.activeStep = 0
      state.completedSections = steps.map(() => true)
      state.expressionJSON = currentDataAlert?.expression
      state.billingUnitsInput = currentDataAlert?.billing_units
      state.descriptionInput = currentDataAlert?.description
    }

    return state
  }

  initializeFields = (props) => {
    this.setState(this.getInitialState(props))
  }

  getDataAlertData = () => {
    try {
      const { currentDataAlert, queryResponse } = this.props
      const { titleInput, messageInput, billingUnitsInput, descriptionInput } = this.state

      if (!!this.props.currentDataAlert?.id) {
        return this.settingsViewRef?.getData()
      } else {
        let expressionJSON = _cloneDeep(this.state.expressionJSON)

        if (this.expressionRef) {
          expressionJSON = this.expressionRef.getJSON()
        } else if (currentDataAlert) {
          expressionJSON = currentDataAlert.expression
        } else {
          const query = queryResponse?.data?.data?.text
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

        const newDataAlert = {
          title: titleInput,
          message: messageInput,
          expression: expressionJSON,
          notification_type: scheduleData.notificationType,
          reset_period: scheduleData.resetPeriod,
          time_zone: scheduleData.timezone,
          schedules: scheduleData.schedules,
          evaluation_frequency: scheduleData.evaluationFrequency,
          billing_units: billingUnitsInput,
          description: descriptionInput,
        }

        return newDataAlert
      }
    } catch (error) {
      console.error(error)
    }
  }

  onExpressionChange = (isComplete, isValid, expressionJSON) => {
    const selectedConditionType = expressionJSON?.[0]?.condition === EXISTS_TYPE ? EXISTS_TYPE : COMPARE_TYPE
    this.setState({ expressionJSON, selectedConditionType })
  }

  isConditionSectionReady = () => {
    if (this.conditionsEditable() && this.expressionRef?._isMounted) {
      return this.expressionRef?.isComplete()
    }

    return true
  }

  onDataAlertCreateOrEditSuccess = (dataAlertResponse) => {
    this.props.onSave(dataAlertResponse)
    this.props.onSuccessAlert('Data Alert updated!')

    this.setState({
      isSavingDataAlert: false,
    })
  }

  onDataAlertCreateOrEditError = (error) => {
    console.error(error)
    this.props.onErrorCallback(error?.message)
    this.setState({
      isSavingDataAlert: false,
    })
  }

  onDataAlertSave = () => {
    this.setState({
      isSavingDataAlert: true,
    })

    const newDataAlert = !!this.props.currentDataAlert?.id ? this.settingsViewRef?.getData() : this.getDataAlertData()

    const requestParams = {
      dataAlert: newDataAlert,
      ...getAuthentication(this.props.authentication),
    }

    if (this.props?.autoQLConfig?.projectId) {
      if (newDataAlert.id) {
        updateManagementDataAlert({
          ...requestParams,
          projectId: this.props?.autoQLConfig?.projectId,
        })
          .then((dataAlertResponse) => {
            this.onDataAlertCreateOrEditSuccess(dataAlertResponse)
          })
          .catch((error) => {
            this.onDataAlertCreateOrEditError(error)
          })
      } else {
        createManagementDataAlert({
          ...requestParams,
          projectId: this.props?.autoQLConfig?.projectId,
        })
          .then((dataAlertResponse) => {
            this.onDataAlertCreateOrEditSuccess(dataAlertResponse)
          })
          .catch((error) => {
            this.onDataAlertCreateOrEditError(error)
          })
      }
    } else if (newDataAlert.id) {
      updateDataAlert({
        ...requestParams,
      })
        .then((dataAlertResponse) => {
          this.onDataAlertCreateOrEditSuccess(dataAlertResponse)
        })
        .catch((error) => {
          this.onDataAlertCreateOrEditError(error)
        })
    } else {
      createDataAlert({
        ...requestParams,
      })
        .then((dataAlertResponse) => {
          this.onDataAlertCreateOrEditSuccess(dataAlertResponse)
        })
        .catch((error) => {
          this.onDataAlertCreateOrEditError(error)
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
    if (!!this.props.currentDataAlert?.id) {
      return !this.state.isSettingsFormComplete
    }

    const steps = this.getSteps()

    const lastStep = steps.length - 1
    const hasUnfinishedStep = !!steps.find((s, i) => {
      if (i === lastStep) {
        return false
      }
      return !this.state.completedSections[i]
    })

    const isLastStepReady = this.isStepReady(lastStep)

    return hasUnfinishedStep || !isLastStepReady
  }

  renderNextBtn = () => {
    if (!!this.props.currentDataAlert?.id) {
      return (
        <Button
          type='primary'
          loading={this.state.isSavingDataAlert}
          onClick={this.onDataAlertSave}
          disabled={this.isFinishBtnDisabled()}
          tooltipID={this.TOOLTIP_ID}
        >
          Save Changes
        </Button>
      )
    }

    const steps = this.getSteps()

    const isLastStep = this.state.activeStep === steps.length - 1
    if (isLastStep) {
      return (
        <Button
          type='primary'
          loading={this.state.isSavingDataAlert}
          onClick={this.onDataAlertSave}
          disabled={this.isFinishBtnDisabled()}
          tooltipID={this.TOOLTIP_ID}
        >
          Finish & Save
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
      <div className='data-alert-modal-footer-container'>
        {this.renderQuerySummary()}
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
      </div>
    )
  }

  renderTypeStep = (active) => {
    return (
      <div className={`react-autoql-data-alert-modal-step ${active ? '' : 'hidden'}`}>
        <div style={{ display: 'flex' }}>
          <div className='react-autoql-data-alert-type-step'>
            <MultilineButton
              title='Live Alert'
              icon='live'
              subtitle='Get notifications when the data for this query meets certain conditions.'
              onClick={() => this.setState({ dataAlertType: CONTINUOUS_TYPE })}
              isActive={this.state.dataAlertType === CONTINUOUS_TYPE}
            />
            <MultilineButton
              title='Scheduled Alert'
              icon='calendar'
              subtitle='Get notifications with the result of this query at specific times.'
              onClick={() => this.setState({ dataAlertType: SCHEDULED_TYPE })}
              isActive={this.state.dataAlertType === SCHEDULED_TYPE}
            />
          </div>
        </div>
      </div>
    )
  }

  renderConditionsStep = (active) => {
    return (
      <div className={`react-autoql-data-alert-modal-step ${active ? '' : 'hidden'}`}>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, width: '100%' }}>
            <ConditionBuilder
              authentication={this.props.authentication}
              dataFormatting={this.props.dataFormatting}
              ref={(r) => (this.expressionRef = r)}
              key={`expression-${this.state.expressionKey}`}
              onChange={this.onExpressionChange}
              expression={this.state.expressionJSON}
              queryResponse={this.props.queryResponse}
              tooltipID={this.TOOLTIP_ID}
              onLastInputEnterPress={this.nextStep}
              filters={this.props.filters}
              dataAlertType={this.state.dataAlertType}
            />
          </div>
        </div>
      </div>
    )
  }

  getConditionStatement = () => {
    return this.conditionsEditable() ? 'the Data Alert conditions are met' : 'new data is detected for your query'
  }

  renderFrequencyStep = (active) => {
    return (
      <div className={`react-autoql-data-alert-modal-step ${active ? '' : 'hidden'}`}>
        <ScheduleBuilder
          ref={(r) => (this.scheduleBuilderRef = r)}
          key={`schedule-${this.COMPONENT_KEY}`}
          dataAlert={this.props.currentDataAlert}
          onCompleteChange={(isComplete) => this.setState({ isFrequencySectionReady: isComplete })}
          onErrorCallback={this.props.onErrorCallback}
          conditionType={this.state.selectedConditionType}
          conditionStatement={this.getConditionStatement()}
          queryResponse={this.props.queryResponse}
          expressionRef={this.expressionRef}
          dataAlertType={this.state.dataAlertType}
          tooltipID={this.TOOLTIP_ID}
        />
      </div>
    )
  }

  renderAlphaAlertsSettings = () => {
    return (
      <CollapsableSection title='Additional Settings' defaultCollapsed={true}>
        <AlphaAlertsSettings
          ref={(r) => (this.alphaAlertsSettingRef = r)}
          descriptionInput={this.state.descriptionInput}
          onDescriptionInputChange={(e) => {
            this.setState({ descriptionInput: e.target.value })
          }}
        />
      </CollapsableSection>
    )
  }

  renderComposeMessageStep = (active) => {
    return (
      <div className={`react-autoql-data-alert-modal-step ${active ? '' : 'hidden'}`}>
        <AppearanceSection
          ref={(r) => (this.appearanceSectionRef = r)}
          titleInput={this.state.titleInput}
          messageInput={this.state.messageInput}
          onTitleInputChange={(e) => this.setState({ titleInput: e.target.value })}
          onMessageInputChange={(e) => this.setState({ messageInput: e.target.value })}
          showConditionStatement
          conditionStatement={this.getConditionStatement()}
        />
        {this.props.enableAlphaAlertSettings && this.renderAlphaAlertsSettings()}
      </div>
    )
  }

  getStepNumber = (stepValue) => {
    const steps = this.getSteps()
    const stepNumber = steps.findIndex((step) => step.value && stepValue && step.value === stepValue)
    return stepNumber
  }

  onDataAlertDelete = () => {
    const dataAlertId = this.props.currentDataAlert?.id
    if (dataAlertId) {
      this.setState({ isConfirmDeleteModalVisible: false })
      this.props.onDelete(dataAlertId)
    }
  }

  renderStepContent = () => {
    const { activeStep } = this.state

    return (
      <>
        {this.renderTypeStep(activeStep === this.getStepNumber(this.TYPE_STEP))}
        {this.renderConditionsStep(activeStep === this.getStepNumber(this.CONDITIONS_STEP))}
        {this.renderFrequencyStep(activeStep === this.getStepNumber(this.FREQUENCY_STEP))}
        {this.renderComposeMessageStep(activeStep === this.getStepNumber(this.MESSAGE_STEP))}
      </>
    )
  }

  hasFilters = () => {
    return (
      !!this.props.filters?.length ||
      !!this.props.queryResponse?.data?.data?.fe_req?.session_filter_locks?.length ||
      !!this.props.queryResponse?.data?.data?.fe_req?.persistent_filter_locks?.length ||
      !!this.props.currentDataAlert?.expression?.[0]?.session_filter_locks?.length ||
      !!this.props.currentDataAlert?.expression?.[0]?.filters?.length
    )
  }

  conditionsEditable = () => {
    return this.SUPPORTED_CONDITION_TYPES?.includes(COMPARE_TYPE)
  }

  onSettingsCompleteChange = (isSettingsFormComplete) => {
    this.setState({ isSettingsFormComplete })
  }

  renderQuerySummary = () => {
    if (!!this.props.currentDataAlert?.id) {
      return null
    }
    const formattedQueryText = this.expressionRef?.getFormattedQueryText({
      sentenceCase: false,
      withFilters: true,
    })
    return (
      <div className='data-alert-modal-query-summary-container'>
        <div className='data-alert-modal-query-summary-background' />
        <div className='data-alert-modal-query-summary'>
          <span>
            <strong>Your query:</strong> "{formattedQueryText}"
          </span>
        </div>
      </div>
    )
  }

  renderContent = () => {
    if (!this.props.isVisible) {
      return null
    }

    const steps = this.getSteps()

    if (!!this.props.currentDataAlert?.id) {
      return (
        <CustomScrollbars className='data-alert-modal-settings-scroll-container'>
          <DataAlertSettings
            ref={(r) => (this.settingsViewRef = r)}
            authentication={this.props.authentication}
            currentDataAlert={this.props.currentDataAlert}
            enableQueryValidation={this.props.enableQueryValidation}
            supportedConditionTypes={this.SUPPORTED_CONDITION_TYPES}
            onErrorCallback={this.props.onErrorCallback}
            onCompleteChange={this.onSettingsCompleteChange}
            tooltipID={this.TOOLTIP_ID}
          />
        </CustomScrollbars>
      )
    }

    return (
      <>
        <StepsHoz
          activeStep={this.state.activeStep}
          onStepChange={this.setStep}
          steps={steps.map((step, i) => {
            return {
              title: step.title,
              complete: this.state.completedSections[i],
            }
          })}
        />
        <div className='data-alert-modal-step-content-container'>{this.renderStepContent()}</div>
      </>
    )
  }

  isStepReady = () => {
    const { activeStep } = this.state

    const steps = this.getSteps()
    const stepName = steps?.[activeStep]?.value

    switch (stepName) {
      case this.TYPE_STEP: {
        return !!this.state.dataAlertType
      }
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
      return <Icon key={`title-icon-${this.COMPONENT_KEY}`} type='settings' />
    }

    return <span key={`title-icon-${this.COMPONENT_KEY}`} />
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Modal
          contentClassName='react-autoql-data-alert-creation-modal'
          bodyClassName='react-autoql-data-alert-modal-body'
          overlayStyle={{ zIndex: '9998' }}
          title={!!this.props.currentDataAlert?.id ? 'Edit Data Alert Settings' : 'Create Data Alert'}
          titleIcon={this.getTitleIcon()}
          ref={(r) => (this.modalRef = r)}
          isVisible={this.props.isVisible}
          onClose={this.props.onClose}
          confirmOnClose={true}
          enableBodyScroll
          width='1200px'
          footer={this.renderFooter()}
          onOpened={this.props.onOpened}
          onClosed={this.props.onClosed}
        >
          {/* We must render a new <Tooltip/> inside of modals */}
          <Tooltip tooltipId={this.TOOLTIP_ID} delayShow={500} />
          <div
            key={`data-alert-modal-content-${this.COMPONENT_KEY}`}
            ref={(r) => (this.contentRef = r)}
            className='react-autoql-data-alert-modal-content'
          >
            {this.renderContent()}
          </div>
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
