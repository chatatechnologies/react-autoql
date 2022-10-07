import React from 'react'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { ReactTabulator } from 'react-tabulator'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
import './ChataTable.scss'

export default class TableWrapper extends React.Component {
  constructor(props) {
    super(props)

    this.isTableMounted = false

    this.state = {}
  }

  static defaultProps = {
    onTableMount: () => {},
  }

  shouldComponentUpdate = () => {
    return !this.ref
  }

  render = () => {
    return (
      <ReactTabulator
        {...this.props}
        className={`table-condensed ${this.props.className}`}
        id={`react-tabulator-id-${this.props.tableKey}`}
        key={this.props.tableKey}
        ref={(ref) => {
          // Wait for event loop to finish so table is rendered in DOM
          setTimeout(() => {
            if (ref?.table && !this.ref) {
              this.props.onTableMount(ref)
              this.ref = ref
            }
          }, 0)
        }}
      />
    )
  }
}
