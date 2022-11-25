import React from 'react'
import PropTypes from 'prop-types'
import dayjs from '../../js/dayjsWithPlugins'
import { v4 as uuid } from 'uuid'

import './YearRangePicker.scss'

export default class YearRangePicker extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    const now = dayjs()

    let selectedStart = now.startOf('year')
    let selectedEnd = now.endOf('year')

    if (props.initialRange) {
      selectedStart = dayjs(this.props.initialRange.startDate).startOf('year')
      selectedEnd = dayjs(this.props.initialRange.endDate).endOf('year')
    } else if (
      props.minDate &&
      props.maxDate &&
      (now.isBefore(dayjs(props.minDate)) || now.isAfter(dayjs(props.maxDate)))
    ) {
      selectedStart = dayjs(props.minDate).startOf('year')
      selectedEnd = dayjs(props.maxDate).endOf('year')
    }

    this.state = {
      selectedRange: this.props.initialRange,
      selectedStart,
      selectedEnd,
    }
  }

  static propTypes = {
    minDate: PropTypes.instanceOf(Date),
    maxDate: PropTypes.instanceOf(Date),
    initialRange: PropTypes.shape({ startDate: PropTypes.instanceOf(Date), endDate: PropTypes.instanceOf(Date) }),
    onRangeSelection: PropTypes.func,
  }

  static defaultProps = {
    minDate: undefined,
    maxDate: undefined,
    initialRange: undefined,
    onRangeSelection: () => {},
  }

  handleYearStartSelect = (e) => {
    const startYear = Number(e.target.value)
    const selectedStart = dayjs(`${startYear}-11-15`).startOf('year')
    let selectedEnd = this.state.selectedEnd?.year()
    if (!isNaN(selectedEnd) && startYear > selectedEnd) {
      selectedEnd = selectedStart
    }
    this.setState({ selectedStart, selectedEnd })
  }

  handleYearEndSelect = (e) => {
    this.setState({ selectedEnd: Number(e.target.value) })
  }

  render = () => {
    const lowerYearLimit = this.props.minDate
      ? dayjs(this.props.minDate).year()
      : dayjs(new Date()).add(-100, 'year').year()

    const upperYearLimit = this.props.maxDate
      ? dayjs(this.props.maxDate).year()
      : dayjs(new Date()).add(20, 'year').year()

    const yearArray = new Array(upperYearLimit - lowerYearLimit + 1).fill(upperYearLimit).map((val, i) => {
      const year = val - i
      return (
        <option key={year} value={year}>
          {year}
        </option>
      )
    })

    const startYear = this.state.selectedStart?.year()
    const endYear = this.state.selectedEnd?.year()

    return (
      <div className={`react-autoql-month-picker-year`}>
        <button
          className='rdrNextPrevButton rdrPprevButton rdrPrevButton'
          onClick={this.decrementYear}
          disabled={this.state.visibleYear === lowerYearLimit}
        >
          <i></i>
        </button>
        <select className='year-picker' value={startYear} onChange={this.handleYearStartSelect}>
          {yearArray}
        </select>
        <select className='year-picker' value={endYear} onChange={this.handleYearEndSelect}>
          {new Array(upperYearLimit - (startYear ?? lowerYearLimit) + 1).fill(upperYearLimit).map((val, i) => {
            const year = val - i
            return (
              <option key={year} value={year}>
                {year}
              </option>
            )
          })}
        </select>
        <button
          className='rdrNextPrevButton rdrNextButton'
          onClick={this.incrementYear}
          disabled={this.state.visibleYear === upperYearLimit}
        >
          <i></i>
        </button>
      </div>
    )
  }
}
