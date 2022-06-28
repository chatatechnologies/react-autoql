import React from 'react'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { ReactTabulator } from 'react-tabulator'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
import './ChataTable.scss'

export default class TableWrapper extends React.Component {
  static defaultProps = {}

  shouldComponentUpdate = () => {
    return false
  }

  render = () => {
    return (
      <ReactTabulator
        {...this.props}
        key={this.props.tableKey}
        ref={this.props.tableRef}
      />
    )
  }
}
