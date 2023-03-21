import React from 'react'
import PropTypes from 'prop-types'
import { Calendar } from 'react-date-range'

import 'react-date-range/dist/styles.css' // main style file
import 'react-date-range/dist/theme/default.css' // theme css file
import './DatePicker.scss'

export default class DatePicker extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      date: props.initialDate,
    }
  }

  static propTypes = {
    initialDate: PropTypes.date,
  }

  static defaultProps = {
    initialDate: undefined,
  }

  handleSelect = (date) => {
    console.log({ date })
    this.setState({ date }, () => {
      this.props.onSelection(date)
    })
  }

  render = () => {
    return (
      <div className='react-autoql-date-picker react-autoql-date-picker-single'>
        <Calendar
          ref={(r) => (this.datePicker = r)}
          date={this.state.date}
          onChange={this.handleSelect}
          showMonthAndYearPickers={true}
        />
      </div>
    )
  }
}
