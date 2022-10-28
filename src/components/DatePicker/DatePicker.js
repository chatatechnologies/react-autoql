import React from 'react'
import { DateRange } from 'react-date-range'
import { getThemeValue } from '../../theme/configureTheme'

import 'react-date-range/dist/styles.css' // main style file
import 'react-date-range/dist/theme/default.css' // theme css file
import './DatePicker.scss'

export default class DatePicker extends React.Component {
  static propTypes = {}

  static defaultProps = {}

  state = {
    ranges: [
      {
        startDate: new Date(),
        endDate: new Date(),
        key: 'selection',
      },
    ],
  }

  handleSelect = (ranges) => {
    this.setState({ ranges: [ranges.selection] })
    this.props.onSelection(ranges.selection)
  }

  render = () => {
    const accentColor = getThemeValue('accent-color')

    return (
      <div className='react-autoql-date-picker'>
        <DateRange
          ranges={this.state.ranges}
          onChange={this.handleSelect}
          // className=""
          // locale={}
          // months={1} // Number: rendered month count
          // showMonthAndYearPickers={false} //show select tags for month and year on calendar top, if false it will just display the month and year
          rangeColors={[accentColor]} // defines color for selection preview.
          // shownDate={} // initial focus date
          // minDate
          // maxDate
          // direction="vertical"
          scroll={
            {
              // enabled: true,
              // monthHeight: 300,
              // longMonthHeight: PropTypes.number, // some months has 1 more row than others
              // monthWidth: 300, // just used when direction="horizontal"
              // calendarWidth: 300, // defaults monthWidth * months
              // calendarHeight: 300, // defaults monthHeight * months
            }
          } // infinite scroll behaviour configuration. Check out Infinite Scroll section
          // showMonthArrow
          // navigatorRenderer={() => {}} //renderer for focused date navigation area. fn(currentFocusedDate: Date, changeShownDate: func, props: object)
        />
      </div>
    )
  }
}
