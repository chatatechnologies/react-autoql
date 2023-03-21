import React from 'react'
import PropTypes from 'prop-types'
import dayjs from '../../js/dayjsWithPlugins'
import { v4 as uuid } from 'uuid'

import './MonthRangePicker.scss'

export default class MonthRangePicker extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    const now = dayjs()

    let visibleYear = now.year()
    let selectedStart = now.startOf('month')
    let selectedEnd = now.endOf('month')

    if (props.initialRange) {
      selectedStart = dayjs(this.props.initialRange.startDate).startOf('month')
      selectedEnd = dayjs(this.props.initialRange.endDate).endOf('month')
      visibleYear = selectedEnd.year()
    } else if (
      props.minDate &&
      props.maxDate &&
      (now.isBefore(dayjs(props.minDate)) || now.isAfter(dayjs(props.maxDate)))
    ) {
      selectedStart = dayjs(props.minDate).startOf('month')
      selectedEnd = dayjs(props.maxDate).endOf('month')
    }

    this.state = {
      selectedRange: this.props.initialRange,
      visibleYear,
      selectedStart,
      selectedEnd,
      previewStart: undefined,
      previewEnd: undefined,
      focusedDateDisplay: 'start',
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

  selectedRangeIncludesMonth = (timestamp) => {
    if (this.state.selectedStart && this.state.selectedEnd) {
      return timestamp.isBetween(this.state.selectedStart, this.state.selectedEnd, 'month')
    }
    return false
  }

  handleMonthHover = (timestamp) => {
    const { selectedStart } = this.state
    let previewStart = timestamp.startOf('month')
    let previewEnd = timestamp.endOf('month')

    if (selectedStart && this.state.focusedDateDisplay === 'end') {
      if (previewEnd.isBefore(selectedStart)) {
        previewEnd = selectedStart.endOf('month')
      } else if (selectedStart.isBefore(previewStart)) {
        previewStart = selectedStart.startOf('month')
      }
    }

    this.setState({ previewStart, previewEnd })
  }

  handleMonthClick = (timestamp) => {
    if (this.state.focusedDateDisplay === 'start') {
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
    this.setState({ selectedStart: timestamp.startOf('month'), selectedEnd: undefined, focusedDateDisplay: 'end' })
    const selectedStart = timestamp.startOf('month')
    const rangeSelection = [selectedStart, timestamp]
    const selectedStartMonthStart = rangeSelection[0].startOf('month')
    const selectedEndMonthEnd = rangeSelection[1].endOf('month')
    this.props.onRangeSelection({
      startDate: selectedStartMonthStart.toDate(),
      endDate: selectedEndMonthEnd.toDate(),
    })
  }

  onMonthEndSelection = (timestamp) => {
    try {
      const { selectedStart } = this.state
      if (!selectedStart) {
        this.setState({ selectedEnd: timestamp, focusedDateDisplay: 'start' })
      }

      const rangeSelection = [selectedStart, timestamp]
      if (selectedStart.isAfter(timestamp)) {
        rangeSelection.reverse()
      }

      const selectedStartMonthStart = rangeSelection[0].startOf('month')
      const selectedEndMonthEnd = rangeSelection[1].endOf('month')

      this.setState({ selectedStart: selectedStartMonthStart, selectedEnd: selectedEndMonthEnd })

      this.props.onRangeSelection({
        startDate: selectedStartMonthStart.toDate(),
        endDate: selectedEndMonthEnd.toDate(),
      })
    } catch (error) {
      console.error(error)
    }
  }

  renderDateDisplay = () => {
    const startDateText = this.state.selectedStart?.startOf('month').format('MMM YYYY') ?? ''
    const endDateText = this.state.selectedEnd?.startOf('month').format('MMM YYYY') ?? startDateText ?? ''

    return (
      <div className='rdrDateDisplayWrapper'>
        <div className='rdrDateDisplay'>
          <span
            className={`rdrDatePickerInput rdrDateDisplayItem
              ${this.state.focusedDateDisplay === 'start' ? 'rdrDateDisplayItemActive' : ''}`}
          >
            <input
              readOnly
              placeholder='Early'
              value={startDateText}
              onClick={() => this.setState({ focusedDateDisplay: 'start' })}
            />
          </span>
          <span
            className={`rdrDatePickerInput rdrDateDisplayItem ${
              this.state.focusedDateDisplay === 'end' ? 'rdrDateDisplayItemActive' : ''
            }`}
          >
            <input
              readOnly
              placeholder='Continuous'
              value={endDateText}
              onClick={() => this.setState({ focusedDateDisplay: 'end' })}
            />
          </span>
        </div>
      </div>
    )
  }

  renderYearPicker = () => {
    const lowerYearLimit = this.props.minDate
      ? dayjs(this.props.minDate).year()
      : dayjs(new Date()).add(-100, 'year').year()
    const upperYearLimit = this.props.maxDate
      ? dayjs(this.props.maxDate).year()
      : dayjs(new Date()).add(20, 'year').year()

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

  isSelected = (timestamp) => {
    const { selectedStart, selectedEnd } = this.state
    const isSelectedStart = timestamp.startOf('month').isSame(selectedStart?.startOf('month'))
    const isSelectedEnd =
      (isSelectedStart && !selectedEnd) || timestamp.endOf('month').isSame(selectedEnd?.endOf('month'))
    const isSelected = isSelectedStart || isSelectedEnd || this.selectedRangeIncludesMonth(timestamp)

    return {
      isSelected,
      isSelectedStart,
      isSelectedEnd,
    }
  }

  isPreview = (timestamp) => {
    const { previewStart, previewEnd } = this.state
    const isPreviewStart = timestamp.startOf('month').isSame(previewStart)
    const isPreviewEnd = timestamp.endOf('month').isSame(previewEnd)
    const isPreview = isPreviewStart || isPreviewEnd || timestamp.isBetween(previewStart, previewEnd, 'month')

    return {
      isPreview,
      isPreviewStart,
      isPreviewEnd,
    }
  }

  isDisabled = (timestamp) => {
    const isBeforeMinDate = this.props.minDate && timestamp.isBefore(dayjs(this.props.minDate).startOf('month'))
    const isAfterMaxDate = this.props.maxDate && timestamp.isAfter(dayjs(this.props.maxDate).endOf('month'))
    return isBeforeMinDate || isAfterMaxDate
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
                const timestamp = dayjs(`${this.state.visibleYear}-${month + 1}-15`)
                const monthName = dayjs(`2021-${month + 1}-15`).format('MMM')

                const { isSelected, isSelectedStart, isSelectedEnd } = this.isSelected(timestamp)
                const { isPreview, isPreviewStart, isPreviewEnd } = this.isPreview(timestamp)
                const isDisabled = this.isDisabled(timestamp)
                const isThisMonth = month === dayjs().month() && this.state.visibleYear == dayjs().year()

                return (
                  <div
                    key={month}
                    className={`month-picker-month
                            ${isThisMonth ? ' current-month' : ''}
                            ${isSelectedStart ? ' selection-start' : ''}
                            ${isSelectedEnd ? ' selection-end' : ''}
                            ${isSelected ? ' active' : ''}
                            ${isPreviewStart ? ' preview-start' : ''}
                            ${isPreviewEnd ? ' preview-end' : ''}
                            ${isPreview ? ' preview' : ''}
                            ${isDisabled ? ' rdrDayDisabled' : ''}`}
                    onClick={() => this.handleMonthClick(timestamp)}
                    onMouseEnter={() => !isDisabled && this.handleMonthHover(timestamp)}
                    onMouseLeave={() =>
                      !isDisabled && this.setState({ previewStart: undefined, previewEnd: undefined })
                    }
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
