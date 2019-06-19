import React from 'react'

import PropTypes from 'prop-types'

import {
  ReactTabulator
  // reactFormatter
} from 'react-tabulator'

// import DateEditor from 'react-tabulator/lib/editors/DateEditor'
// import MultiValueFormatter from 'react-tabulator/lib/formatters/MultiValueFormatter'
// import MultiSelectEditor from 'react-tabulator/lib/editors/MultiSelectEditor'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)

export default class ChataTable extends React.Component {
  ref = null

  static propTypes = {
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    onRowDblClick: PropTypes.func,
    data: PropTypes.arrayOf(PropTypes.array).isRequired
  }

  static defaultProps = {
    onRowDblClick: () => {}
  }

  state = {}

  rowClick = (e, row) => {
    e.preventDefault()
    e.stopPropagation()
    this.props.onRowDblClick(row, this.props.columns)
  }

  render = () => {
    const options = {
      layout: 'fitDataFill',
      textSize: '9px'
    }
    return (
      <div className="chata-table-container">
        <ReactTabulator
          ref={ref => (this.ref = ref)}
          columns={this.props.columns}
          data={this.props.data}
          // rowClick={this.rowClick}
          rowDblClick={this.rowClick}
          options={options}
          data-custom-attr="test-custom-attribute"
          className="chata-table"
          progressiveRender={true}
          progressiveRenderSize={5}
          progressiveRenderMargin={100}
          height="100%"
        />
      </div>
    )
  }
}
