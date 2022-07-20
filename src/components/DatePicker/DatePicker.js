import React from 'react'
import { DateRange } from 'react-date-range'

import { getThemeConfig, themeConfigDefault } from '../../props/defaults'
import { themeConfigType } from '../../props/types'

import './DatePicker.scss'
import 'react-date-range/dist/styles.css' // main style file
import 'react-date-range/dist/theme/default.css' // theme css file

export default class DatePicker extends React.Component {
  static propTypes = {
    themeConfig: themeConfigType,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
  }

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
    console.log('ranges:', ranges)
    this.setState({ ranges: [ranges.selection] })
  }

  render = () => {
    const { accentColor } = getThemeConfig(this.props.themeConfig)

    return (
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
    )
  }
}
