import React from 'react'
import PropTypes from 'prop-types'
import { ReactTabulator } from 'react-tabulator'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)

export default class TableWrapper extends React.Component {
  static propTypes = {
    tableKey: PropTypes.string,
  }

  static defaultProps = {
    tableKey: undefined,
  }

  // shouldComponentUpdate = () => {
  //   return false
  // }

  render = () => {
    return (
      <ReactTabulator
        {...this.props}
        ref={(r) => (this.tableRef = r)}
        className={`table-condensed ${this.props.className}`}
        id={`react-tabulator-id-${this.props.tableKey}`}
        key={this.props.tableKey}
      />
    )
  }
}
