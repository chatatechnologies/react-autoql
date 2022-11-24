import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import dayjs from '../../js/dayjsWithPlugins'

import './MonthRangePicker.scss'

export default class MonthRangePicker extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    const now = dayjs()

    let visibleYear = now.year()
    let selectedStart = now
    let selectedEnd = now
    if (this.props.initialRange) {
      const startDateDayJS = dayjs(this.props.initialRange.startDate)
      const endDateDayJS = dayjs(this.props.initialRange.endDate)
      visibleYear = endDateDayJS.year()
      selectedStart = startDateDayJS
      selectedEnd = endDateDayJS
    }

    this.state = {
      selectedRange: this.props.initialRange,
      visibleYear,
      selectedStart,
      selectedEnd,
      previewStart: undefined,
      previewEnd: undefined,
    }
  }

  static propTypes = {
    initialRange: PropTypes.arrayOf(PropTypes.instanceOf(Date)),
    onRangeSelection: PropTypes.func,
  }

  static defaultProps = {
    initialRange: undefined,
    onRangeSelection: () => {},
  }

  selectedRangeIncludesMonth = (timestamp) => {
    if (this.state.selectedStart && this.state.selectedEnd) {
      return timestamp.isBetween(this.state.selectedStart, this.state.selectedEnd, 'month')
    }
    return false
  }

  handleMonthHover = (timestamp) => {
    const { selectedStart } = this.state
    let previewStart = timestamp
    let previewEnd = timestamp
    if (selectedStart && !this.state.selectedEnd) {
      if (timestamp.isBefore(selectedStart)) {
        previewEnd = selectedStart
      } else if (selectedStart.isBefore(timestamp)) {
        previewStart = selectedStart
      }
    }

    this.setState({ previewMonth: timestamp, previewStart, previewEnd })
  }

  handleMonthClick = (timestamp) => {
    if (!this.state.selectedStart || !!this.state.selectedEnd) {
      this.onMonthStartSelection(timestamp)
    } else {
      this.onMonthEndSelection(timestamp)
    }
  }

  incrementYear = () => {
    this.setState({ visibleYear: `${Number(this.state.visibleYear) + 1}` })
  }

  decrementYear = () => {
    this.setState({ visibleYear: `${Number(this.state.visibleYear) - 1}` })
  }

  onMonthStartSelection = (timestamp) => {
    this.setState({ selectedStart: timestamp, selectedEnd: undefined })
  }

  onMonthEndSelection = (timestamp) => {
    try {
      const { selectedStart } = this.state

      const rangeSelection = [selectedStart, timestamp]
      if (selectedStart.isAfter(timestamp)) {
        rangeSelection.reverse()
      }

      this.setState({ selectedStart: rangeSelection[0], selectedEnd: rangeSelection[1] })

      this.props.onRangeSelection({
        startDate: rangeSelection[0].startOf('month').toDate(),
        endDate: rangeSelection[1].endOf('month').toDate(),
      })
    } catch (error) {
      console.error(error)
    }
  }

  renderDateDisplay = () => {
    return (
      <div className='rdrDateDisplayWrapper'>
        <div className='rdrDateDisplay'>
          <span className='rdrDateInput rdrDateDisplayItem'>
            <input readOnly placeholder='Early' value={this.state.selectedStart?.startOf('month').format('MMM YYYY')} />
          </span>
          <span className='rdrDateInput rdrDateDisplayItem'>
            <input
              readOnly
              placeholder='Continuous'
              value={this.state.selectedEnd?.startOf('month').format('MMM YYYY')}
            />
          </span>
        </div>
      </div>
    )
  }

  renderYearPicker = () => {
    const lowerYearLimit = dayjs(new Date()).add(-100, 'year').year()
    const upperYearLimit = dayjs(new Date()).add(20, 'year').year()

    return (
      <div className={`react-autoql-month-picker-year`}>
        <button
          className='rdrNextPrevButton rdrPprevButton rdrPrevButton'
          onClick={this.decrementYear}
          disabled={this.state.visibleYear === lowerYearLimit}
        >
          <i></i>
        </button>
        <select
          className='year-picker'
          value={this.state.visibleYear}
          onChange={(e) => this.setState({ visibleYear: Number(e.target.value) })}
        >
          {new Array(upperYearLimit - lowerYearLimit + 1).fill(upperYearLimit).map((val, i) => {
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

  renderMonthGrid = () => {
    const monthGrid = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ]

    return (
      <div className='react-autoql-month-picker-month-picker'>
        {monthGrid.map((monthRow, i) => {
          return (
            <div className='month-picker-row' key={`month-row-${i}`}>
              {monthRow.map((month) => {
                const { selectedStart, selectedEnd, previewStart, previewEnd } = this.state
                const timestamp = dayjs(`${this.state.visibleYear}-${month + 1}-15`)
                const monthName = dayjs(`2021-${month + 1}-15`).format('MMM')
                const isThisMonth = month === dayjs().month()
                const isStart = timestamp.startOf('month').isSame(selectedStart?.startOf('month'))
                const isEnd = (isStart && !selectedEnd) || timestamp.endOf('month').isSame(selectedEnd?.endOf('month'))
                const isActive = isStart || isEnd || this.selectedRangeIncludesMonth(timestamp)
                const isPreviewStart = timestamp.isSame(previewStart)
                const isPreviewEnd = timestamp.isSame(previewEnd)
                const isPreview =
                  isPreviewStart || isPreviewEnd || timestamp.isBetween(previewStart, previewEnd, 'month')
                return (
                  <div
                    key={month}
                    className={`month-picker-month
                            ${isThisMonth ? ' current-month' : ''}
                            ${isStart ? ' selection-start' : ''}
                            ${isEnd ? ' selection-end' : ''}
                            ${isActive ? ' active' : ''}
                            ${isPreviewStart ? ' preview-start' : ''}
                            ${isPreviewEnd ? ' preview-end' : ''}
                            ${isPreview ? ' preview' : ''}`}
                    onClick={() => this.handleMonthClick(timestamp)}
                    onMouseEnter={() => this.handleMonthHover(timestamp)}
                    onMouseLeave={() => this.setState({ previewStart: undefined, previewEnd: undefined })}
                  >
                    <div className='month-picker-month-text-wrapper'>
                      <div className='month-picker-month-text'>
                        <span>{monthName}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  render = () => {
    return (
      <div className='react-autoql-date-picker react-autoql-month-range-picker'>
        {this.renderDateDisplay()}
        {this.renderYearPicker()}
        {this.renderMonthGrid()}
      </div>
    )
  }
}
