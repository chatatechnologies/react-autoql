import React from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'

import { ScheduleBuilder } from '../ScheduleBuilder'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ConditionBuilder } from '../ConditionBuilder'
import { Select } from '../../Select'
import AppearanceSection from './AppearanceSection'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'
import { CONTINUOUS_TYPE, EXISTS_TYPE, PERIODIC_TYPE, SCHEDULED_TYPE } from '../DataAlertConstants'

import './DataAlertSettings.scss'

const SettingSection = ({ title, children }) => {
  return (
    <div className='react-autoql-data-alert-setting-section'>
      {title ? <div className='react-autoql-data-alert-setting-section-title'>{title}</div> : null}
      {children}
    </div>
  )
}

const Settings = ({ children }) => {
  return (
    <div className='react-autoql-flex-table-container' role='table'>
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

    this.state = this.getInitialState(props)
  }

  static propTypes = {
    authentication: authenticationType,
    currentDataAlert: PropTypes.shape({}),
    enableQueryValidation: PropTypes.bool,
    supportedConditionTypes: PropTypes.arrayOf(PropTypes.string),
    onErrorCallback: PropTypes.func,
    onExpressionChange: PropTypes.func,
    expression: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.array]), // This is the expression of the existing notification if you are editing one. I should change the name of this at some point
  }

  static defaultProps = {
    authentication: authenticationDefault,
    currentDataAlert: undefined,
    enableQueryValidation: true,
    supportedConditionTypes: [],
    onErrorCallback: () => {},
    onExpressionChange: () => {},
    expression: undefined,
  }

  componentDidUpdate = (prevProps, prevState) => {}

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
      resetPeriodSelectValue: currentDataAlert?.reset_period,
      evaluationFrequencySelectValue: currentDataAlert?.reset_period,
      isConfirmDeleteModalVisible: false,
      expressionKey: uuid(),
      filters: currentDataAlert?.filters,
    }

    return state
  }

  getData = () => {
    let scheduleData = {}
    if (this.scheduleBuilderRef) {
      scheduleData = this.scheduleBuilderRef.getData()
    }

    const expression = _cloneDeep(this.props.expression)

    return {
      id: this.props.currentDataAlert?.id,
      data_return_query: this.props.currentDataAlert?.data_return_query,
      title: this.state.titleInput,
      message: this.state.messageInput,
      expression,
      notification_type: this.state.notificationType,
      reset_period: this.state.resetPeriodSelectValue,
      time_zone: scheduleData.timezone,
      schedules: scheduleData.schedules,
      evaluation_frequency: scheduleData.evaluationFrequency,
    }
  }

  initializeFields = (props) => {
    this.setState(this.getInitialState(props))
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
            value: SCHEDULED_TYPE,
            label: 'Scheduled',
            subtitle: 'Get notifications at specific times.',
            icon: 'calendar',
          },
          {
            value: CONTINUOUS_TYPE,
            label: 'Live',
            subtitle: 'Get notifications as soon as the conditions are met.',
            icon: 'live',
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
        conditionType={this.props.supportedConditionTypes?.[0] ?? EXISTS_TYPE}
        tooltipID={this.props.tooltipID}
        dataAlert={this.props.currentDataAlert}
        showTypeSelector={false}
        onErrorCallback={this.props.onErrorCallback}
        frequencyType={this.state.notificationType}
      />
    )
  }

  ConditionsSettings = () => {
    return (
      <ConditionBuilder
        authentication={this.props.authentication}
        ref={(r) => (this.expressionRef = r)}
        key={`expression-${this.state.expressionKey}`}
        onChange={this.props.onExpressionChange}
        expression={this.props.expression}
        tooltipID={this.props.tooltipID}
      />
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Settings>
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
        </Settings>
      </ErrorBoundary>
    )
  }
}
