import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { ScheduleBuilder } from '../ScheduleBuilder'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ConditionBuilder } from '../ConditionBuilder'
import { Select } from '../../Select'
import AppearanceSection from './AppearanceSection'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'
import { CONTINUOUS_TYPE, PERIODIC_TYPE, SCHEDULED_TYPE } from '../DataAlertConstants'

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
  }

  static defaultProps = {
    authentication: authenticationDefault,
    currentDataAlert: undefined,
    enableQueryValidation: true,
    supportedConditionTypes: [],
    onErrorCallback: () => {},
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
      checkFrequencySelectValue: currentDataAlert?.reset_period,
      expressionJSON: currentDataAlert?.expression ?? [],
      isConfirmDeleteModalVisible: false,
      selectedConditionType: currentDataAlert.expression?.[0]?.condition ?? this.props.supportedConditionTypes?.[0],
      expressionKey: uuid(),
    }

    return state
  }

  getData = () => {
    return {
      ...this.props.currentDataAlert,
      title: this.state.titleInput,
      message: this.state.messageInput,
      notification_type: this.state.notificationType,
      reset_period: this.state.resetPeriodSelectValue,
    }
  }

  initializeFields = (props) => {
    this.setState(this.getInitialState(props))
  }

  onExpressionChange = (isComplete, isValid, expressionJSON) => {
    this.setState({
      expressionJSON,
    })
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
        key={`dta-alert-settings-schedule-builder-${this.state.notificationType}`}
        conditionType={this.state.notificationType}
        tooltipID={this.props.tooltipID}
        dataAlert={this.getData()}
        showTypeSelector={false}
      />
    )
  }

  ConditionsSettings = () => {
    return (
      <ConditionBuilder
        authentication={this.props.authentication}
        ref={(r) => (this.expressionRef = r)}
        key={`expression-${this.state.expressionKey}`}
        onChange={this.onExpressionChange}
        expression={this.state.expressionJSON}
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
