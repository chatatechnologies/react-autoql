import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import { CONTINUOUS_TYPE, PERIODIC_TYPE, SCHEDULED_TYPE, authenticationDefault } from 'autoql-fe-utils'

import { Select } from '../../Select'
import AppearanceSection from './AppearanceSection/AppearanceSection'
import { ScheduleBuilder } from '../ScheduleBuilder'
import { ConditionBuilder } from '../ConditionBuilder'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { authenticationType } from '../../../props/types'

import './DataAlertSettings.scss'
import AlphaAlertsSettings from './AlphaAlertsSettings'
import CollapsableSection from '../../Card/CollapsableSection'

const SettingSection = ({ title, children } = {}) => {
  return (
    <div className='react-autoql-data-alert-setting-section'>
      {title ? <div className='react-autoql-data-alert-setting-section-title'>{title}</div> : null}
      {children}
    </div>
  )
}

const Settings = ({ children, className } = {}) => {
  return (
    <div className={`react-autoql-flex-table-container ${className ?? ''}`} role='table'>
      {children ?? null}
    </div>
  )
}

const Divider = ({ horizontal, vertical }) => {
  return (
    <div
      className={`react-autoql-settings-vertical-divider ${
        vertical
          ? 'react-autoql-settings-vertical-divider-vertical'
          : 'react-autoql-settings-vertical-divider-horizontal'
      }`}
    />
  )
}

const SettingGroup = ({ children, flex, flexSize }) => {
  if (!children) {
    return null
  }

  return (
    <div className='react-autoql-data-alert-setting-group' style={{ flex: flexSize, display: flex ? 'flex' : 'block' }}>
      {children}
    </div>
  )
}

const Setting = ({ children, flex, flexSize }) => {
  if (!children) {
    return null
  }

  return (
    <div className='react-autoql-data-alert-setting' style={{ flex: flexSize, display: flex ? 'flex' : 'block' }}>
      {children}
    </div>
  )
}

export default class DataAlertSettings extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.isFormComplete = true

    this.state = this.getInitialState(props)
  }

  static propTypes = {
    authentication: authenticationType,
    currentDataAlert: PropTypes.shape({}),
    onErrorCallback: PropTypes.func,
    onExpressionChange: PropTypes.func,
    onCompleteChange: PropTypes.func,
    enableAlphaAlertSettings: PropTypes.bool,
    categories: PropTypes.arrayOf(PropTypes.shape({})),
  }

  static defaultProps = {
    authentication: authenticationDefault,
    currentDataAlert: undefined,
    onErrorCallback: () => {},
    onExpressionChange: () => {},
    onCompleteChange: () => {},
    enableAlphaAlertSettings: false,
    categories: [],
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.isCompleteChanged()) {
      this.props.onCompleteChange(this.isFormComplete)
    }
  }

  getInitialState = (initialProps) => {
    const props = initialProps ?? this.props
    const { currentDataAlert } = props

    if (!currentDataAlert) {
      return {}
    }

    let notificationType = currentDataAlert?.notification_type
    if (notificationType === PERIODIC_TYPE) {
      notificationType = CONTINUOUS_TYPE
    }

    const state = {
      titleInput: currentDataAlert.title ?? '',
      messageInput: currentDataAlert.message ?? '',
      notificationType,
      evaluationFrequencySelectValue: currentDataAlert.reset_period,
      isConfirmDeleteModalVisible: false,
      expressionKey: uuid(),
      filters: currentDataAlert.filters,
      expression: currentDataAlert.expression,
      billingUnitsInput: currentDataAlert.billing_units,
      descriptionInput: currentDataAlert.description,
      categoryId: currentDataAlert.label?.id ?? '',
    }

    return state
  }

  isCompleteChanged = () => {
    const isFormComplete = this.isComplete()
    if (isFormComplete !== this.isFormComplete) {
      this.isFormComplete = isFormComplete
      return true
    }

    return false
  }

  getData = () => {
    const scheduleData = this.scheduleBuilderRef?.getData() ?? {}

    let notificationType = this.state.notificationType
    if (scheduleData?.resetPeriod && notificationType === CONTINUOUS_TYPE) {
      notificationType = PERIODIC_TYPE
    }

    return {
      id: this.props.currentDataAlert?.id,
      title: this.state.titleInput,
      message: this.state.messageInput,
      expression: _cloneDeep(this.state.expression),
      notification_type: notificationType,
      reset_period: scheduleData.resetPeriod,
      time_zone: scheduleData.timezone,
      schedules: scheduleData.schedules,
      evaluation_frequency: scheduleData.evaluationFrequency,
      billing_units: this.state.billingUnitsInput,
      description: this.state.descriptionInput,
      categoryId: this.state.categoryId,
    }
  }

  initializeFields = (props) => {
    this.setState(this.getInitialState(props))
  }

  isComplete = () => {
    return this.state.isConditionSectionComplete && this.state.isScheduleSectionComplete && !!this.state.titleInput
  }

  onExpressionChange = (isConditionSectionComplete, isValid, expression) => {
    this.setState({ expression, isConditionSectionComplete })
  }

  renderAlphaAlertsSettings = () => {
    return (
      <AlphaAlertsSettings
        ref={(r) => (this.alphaAlertsSettingRef = r)}
        onBillingUnitsInputChange={(value) => {
          this.setState({ billingUnitsInput: value })
        }}
        billingUnitsInput={this.state.billingUnitsInput}
      />
    )
  }

  AppearanceSettings = () => {
    return (
      <AppearanceSection
        titleInput={this.state.titleInput}
        messageInput={this.state.messageInput}
        onTitleInputChange={(e) => {
          this.setState({ titleInput: e.target.value })
        }}
        onMessageInputChange={(e) => {
          this.setState({ messageInput: e.target.value })
        }}
        showConditionStatement={false}
        descriptionInput={this.state.descriptionInput}
        selectedCategory={this.state.categoryId}
        onDescriptionInputChange={(e) => {
          this.setState({ descriptionInput: e.target.value })
        }}
        onCategorySelectChange={(value) => {
          this.setState({ categoryId: value })
        }}
        categories={this.props.categories || []}
        enableAlphaAlertSettings={this.props.enableAlphaAlertSettings}
      />
    )
  }

  AlertTypeSetting = () => {
    return (
      <Select
        value={this.state.notificationType}
        onChange={(notificationType) => this.setState({ notificationType })}
        className='react-autoql-alert-type-setting-select'
        label='Alert Type'
        fullWidth
        options={[
          {
            value: CONTINUOUS_TYPE,
            label: 'Live',
            subtitle: 'Get notifications as soon as the conditions are met.',
            icon: 'live',
          },
          {
            value: SCHEDULED_TYPE,
            label: 'Scheduled',
            subtitle: 'Get notifications at specific times.',
            icon: 'calendar',
          },
        ]}
      />
    )
  }

  ScheduleSettings = () => {
    return (
      <ScheduleBuilder
        ref={(r) => (this.scheduleBuilderRef = r)}
        key={`data-alert-settings-schedule-builder-${this.state.notificationType}`}
        tooltipID={this.props.tooltipID}
        dataAlert={this.props.currentDataAlert}
        showTypeSelector={false}
        dataAlertType={this.state.notificationType}
        onErrorCallback={this.props.onErrorCallback}
        frequencyType={this.state.notificationType}
        onCompleteChange={(isScheduleSectionComplete) => this.setState({ isScheduleSectionComplete })}
      />
    )
  }

  ConditionsSettings = () => {
    return (
      <ConditionBuilder
        authentication={this.props.authentication}
        ref={(r) => (this.expressionRef = r)}
        key={`expression-${this.state.expressionKey}`}
        dataAlertType={this.state.notificationType}
        onChange={this.onExpressionChange}
        expression={this.state.expression}
        tooltipID={this.props.tooltipID}
      />
    )
  }

  render = () => {
    if (!this.props.currentDataAlert) {
      return null
    }

    return (
      <ErrorBoundary>
        <Settings className='data-alert-settings-modal-content'>
          <SettingSection title='Conditions'>{this.ConditionsSettings()}</SettingSection>
          <Divider horizontal />
          <SettingSection title='Timing'>
            <SettingGroup flex>
              <Setting flexSize={1}>{this.AlertTypeSetting()}</Setting>
              <SettingGroup flexSize={2}>
                <Setting>{this.ScheduleSettings()}</Setting>
              </SettingGroup>
            </SettingGroup>
          </SettingSection>
          <Divider horizontal />
          <SettingSection title='Appearance'>{this.AppearanceSettings()}</SettingSection>
          {this.props.enableAlphaAlertSettings && (
            <>
              <Divider horizontal />
              <CollapsableSection defaultCollapsed={true} title='Additional Settings' onToggle={() => {}}>
                {this.renderAlphaAlertsSettings()}
              </CollapsableSection>
            </>
          )}
        </Settings>
      </ErrorBoundary>
    )
  }
}
