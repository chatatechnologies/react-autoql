import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import _get from 'lodash.get'
import uuid from 'uuid'

import { Modal } from '../../Modal'
import { Steps } from '../../Steps'
import { Input } from '../../Input'
import { Icon } from '../../Icon'
import { Select } from '../../Select'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { WeekSelect } from '../../DateSelect/WeekSelect'
import { MonthSelect } from '../../DateSelect/MonthSelect'
import { YearSelect } from '../../DateSelect/YearSelect'

import { getScheduleDescription } from '../helpers'
import {
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './ScheduleBuilder.scss'

export default class ScheduleBuilder extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    initialData: PropTypes.shape({}),
    onChange: PropTypes.func,
    onCompletedChange: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    initialData: undefined,
    onChange: () => {},
    onCompletedChange: () => {},
    onErrorCallback: () => {},
  }

  state = {
    frequencyCategorySelectValue: undefined,
    frequencySelectValue: 'MONTH',
    weekSelectValue: [2],
    monthSelectValue: [1],
    yearSelectValue: [1],
    everyCheckboxValue: false,
  }

  componentDidMount = () => {
    this.props.onCompletedChange(this.isComplete())
    if (this.props.initialData) {
      const { initialData } = this.props

      this.setState({
        frequencyCategorySelectValue: initialData.notification_type,
        frequencySelectValue: initialData.reset_period || undefined,
        everyCheckboxValue:
          initialData.notification_type === 'SINGLE_EVENT' &&
          !!initialData.reset_period,

        // weekSelectValue: [2],
        // monthSelectValue: [1],
        // yearSelectValue: [1],
      })
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.isComplete() !== this.isComplete(prevState)) {
      this.props.onCompletedChange(this.isComplete())
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

  isComplete = state => {
    if (!state) {
      return !!this.state.frequencyCategorySelectValue
    }
    return !!state.frequencyCategorySelectValue
  }

  getData = () => {
    const {
      frequencyCategorySelectValue,
      everyCheckboxValue,
      frequencySelectValue,
    } = this.state
    return {
      frequencyCategorySelectValue,
      everyCheckboxValue,
      frequencySelectValue,
    }
  }

  renderRepeatCheckbox = label => {
    return (
      <Checkbox
        label={label}
        className="frequency-repeat-checkbox"
        checked={this.state.everyCheckboxValue}
        onChange={e => {
          this.setState({ everyCheckboxValue: e.target.checked })
        }}
      />
    )
  }

  renderFrequencySelector = options => {
    return (
      <Select
        options={options}
        className="notification-frequency-select"
        value={this.state.frequencySelectValue}
        onChange={value => this.setState({ frequencySelectValue: value })}
      />
    )
  }

  renderWeekSelector = () => (
    <WeekSelect
      multiSelect
      value={this.state.weekSelectValue}
      onChange={value => this.setState({ weekSelectValue: value })}
    />
  )

  renderMonthSelector = () => (
    <MonthSelect
      multiSelect
      value={this.state.monthSelectValue}
      onChange={value => this.setState({ monthSelectValue: value })}
    />
  )

  renderYearSelector = () => (
    <YearSelect
      multiSelect
      value={this.state.yearSelectValue}
      onChange={value => this.setState({ yearSelectValue: value })}
    />
  )

  renderDateSelector = type => {
    let selector
    switch (type) {
      case 'WEEK': {
        selector = this.renderWeekSelector()
        break
      }
      case 'MONTH': {
        selector = this.renderMonthSelector()
        break
      }
      case 'YEAR': {
        selector = this.renderYearSelector()
        break
      }
      default: {
        return null
      }
    }

    return <div className="frequency-date-select-container">{selector}</div>
  }

  renderFrequencyDescription = () => {
    if (!this.isComplete()) {
      return null
    }

    let selection
    if (this.state.frequencySelectValue === 'WEEK') {
      selection = this.state.weekSelectValue
    } else if (this.state.frequencySelectValue === 'MONTH') {
      selection = this.state.monthSelectValue
    } else if (this.state.frequencySelectValue === 'YEAR') {
      selection = this.state.yearSelectValue
    }

    const description = getScheduleDescription(
      this.state.frequencyCategorySelectValue,
      this.state.frequencySelectValue,
      this.state.everyCheckboxValue,
      selection
    )

    return (
      <div className="frequency-description-box">
        <div className="frequency-description-title">Description:</div>
        {description}
      </div>
    )
  }

  render = () => {
    return (
      <div className="notification-frequency-step" data-test="schedule-builder">
        <div className="frequency-settings-container">
          Notify me{' '}
          <Select
            options={[
              { value: 'SINGLE_EVENT', label: 'Once, when this happens' },
              { value: 'REPEAT_EVENT', label: 'Every time this happens' },
              // Commenting out for MVP
              // { value: 'SCHEDULE', label: 'On a schedule' }
            ]}
            selectionPlaceholder="Select a frequency"
            value={this.state.frequencyCategorySelectValue}
            onChange={value =>
              this.setState({ frequencyCategorySelectValue: value })
            }
          />
          {this.state.frequencyCategorySelectValue === 'SINGLE_EVENT' && (
            <div className="frequency-category-select">
              {this.renderRepeatCheckbox('Repeat')}
              {this.state.everyCheckboxValue && (
                <Fragment>
                  {this.renderFrequencySelector([
                    { value: 'DAY', label: 'Daily' },
                    { value: 'WEEK', label: 'Weekly' },
                    { value: 'MONTH', label: 'Monthly' },
                    // Commenting out for MVP
                    // { value: 'YEAR', label: 'Yearly' }
                  ])}
                  {
                    // Commenting out for MVP
                    // {this.state.frequencySelectValue !== 'DAY' && (
                    //   <span className="frequency-repeat-follow-text"> on:</span>
                    // )}
                    // {this.renderDateSelector(this.state.frequencySelectValue)}
                  }
                </Fragment>
              )}
            </div>
          )}
          {
            // Commenting out for MVP
            //   this.state.frequencyCategorySelectValue === 'REPEAT_EVENT' && (
            //   <div className="frequency-category-select">
            //     {this.renderRepeatCheckbox('Only on')}
            //     {this.state.everyCheckboxValue && (
            //       <Fragment>
            //         {this.renderFrequencySelector([
            //           { value: 'WEEK', label: 'Certain days of the week' },
            //           { value: 'MONTH', label: 'Certain days of the month' },
            //           { value: 'YEAR', label: 'Certain months of the year' }
            //         ])}
            //         {this.state.frequencySelectValue !== 'DAY' &&
            //           this.renderDateSelector(this.state.frequencySelectValue)}
            //       </Fragment>
            //     )}
            //   </div>
            // )
          }
        </div>
        <div className="frequency-description-box-container">
          {this.renderFrequencyDescription()}
        </div>
      </div>
    )
  }
}
