import React from 'react'
import PropTypes from 'prop-types'
import { DateRange } from 'react-date-range'
import MonthRange from './MonthRangePicker'
import YearRange from './YearRangePicker'
import { getThemeValue } from '../../theme/configureTheme'
import { PRECISION_TYPES } from '../../js/Constants'

import 'react-date-range/dist/styles.css' // main style file
import 'react-date-range/dist/theme/default.css' // theme css file
import './DatePicker.scss'

export default class DatePicker extends React.Component {
  constructor(props) {
    super(props)

    this.accentColor = getThemeValue('accent-color')

    this.state = {
      selectedRange: {
        startDate: props.initialRange?.startDate ?? props.validRange?.startDate ?? new Date(),
        endDate: props.initialRange?.endDate ?? props.validRange?.endDate ?? new Date(),
        key: 'selection',
      },
    }
  }

  static propTypes = {
    initialRange: PropTypes.shape({}),
    validRange: PropTypes.shape({}),
    type: PropTypes.string,
  }

  static defaultProps = {
    initialRange: undefined,
    validRange: undefined,
    type: PRECISION_TYPES.DAY,
  }

  handleSelect = (ranges) => {
    this.setState({ selectedRange: ranges.selection }, () => {
      this.props.onSelection(ranges.selection)
    })
  }

  renderDatePicker = () => {
    switch (this.props.type) {
      case PRECISION_TYPES.MONTH || PRECISION_TYPES.QUARTER: {
        return (
          <MonthRange
            onRangeSelection={(selection) => this.props.onSelection(selection)}
            minDate={this.props.validRange?.startDate}
            maxDate={this.props.validRange?.endDate}
            initialRange={this.state.selectedRange}
          />
        )
      }
      case PRECISION_TYPES.YEAR: {
        return (
          <YearRange
            onRangeSelection={(selection) => this.props.onSelection(selection)}
            minDate={this.props.validRange?.startDate}
            maxDate={this.props.validRange?.endDate}
            initialRange={this.state.selectedRange}
          />
        )
      }
      default: {
        // "DAY", "WEEK"
        return (
          <DateRange
            ref={(r) => (this.datePicker = r)}
            ranges={[this.state.selectedRange]}
            onChange={this.handleSelect}
            minDate={this.props.validRange?.startDate}
            maxDate={this.props.validRange?.endDate}
            dragSelectionEnabled={false}
            rangeColors={[this.accentColor]}
            showMonthAndYearPickers={true}
          />
        )
      }
    }
  }

  render = () => {
    return <div className='react-autoql-date-picker'>{this.renderDatePicker()}</div>
  }
}
