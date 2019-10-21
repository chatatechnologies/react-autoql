import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'

import {
  ReactTabulator
  // reactFormatter
} from 'react-tabulator'

// import DateEditor from 'react-tabulator/lib/editors/DateEditor'
// import MultiValueFormatter from 'react-tabulator/lib/formatters/MultiValueFormatter'
// import MultiSelectEditor from 'react-tabulator/lib/editors/MultiSelectEditor'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
// import { getGroupBysFromTable, getGroupBysFromPivotTable } from '../../js/Util'

export default class ChataTable extends React.Component {
  ref = null

  static propTypes = {
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    onRowClick: PropTypes.func,
    data: PropTypes.arrayOf(PropTypes.array).isRequired,
    borderColor: PropTypes.string,
    hoverColor: PropTypes.string
  }

  static defaultProps = {
    borderColor: '#ddd',
    // hoverColor: '#5a5a5a',
    hoverColor: '#ececec',
    onRowClick: () => {}
  }

  state = {
    columns: this.props.columns
  }

  componentDidMount = () => {
    this.TABLE_CONTAINER_ID = uuid.v4()
    this.setStyles()
  }

  componentDidUpdate = prevProps => {
    if (
      this.props.borderColor &&
      this.props.borderColor !== prevProps.borderColor
    ) {
      this.setStyles()
    }
  }

  setStyles = () => {
    document.documentElement.style.setProperty(
      '--chata-table-border-color',
      this.props.borderColor
    )
    document.documentElement.style.setProperty(
      '--chata-table-hover-color',
      this.props.hoverColor
    )
  }

  rowClick = (e, row) => {
    e.preventDefault()
    e.stopPropagation()
    this.props.onRowClick(row.getData(), this.props.columns)
  }

  cellClick = (e, cell) => {
    e.preventDefault()
    e.stopPropagation()
    this.props.onCellClick(cell)
  }

  copyToClipboard = () => {
    if (this.ref && this.ref.table) {
      this.ref.table.copyToClipboard('active', true)
    }
  }

  saveAsCSV = () => {
    if (this.ref && this.ref.table) {
      this.ref.table.download('csv', 'table.csv', {
        delimeter: ','
      })
    }
  }

  render = () => {
    const options = {
      layout: 'fitDataFill',
      textSize: '9px',
      movableColumns: true,
      progressiveRender: true,
      progressiveRenderSize: 5,
      progressiveRenderMargin: 100,
      downloadConfig: {
        columnGroups: false,
        rowGroups: false,
        columnCalcs: false
      },
      downloadDataFormatter: data => data,
      downloadReady: (fileContents, blob) => blob
    }

    return (
      <div
        id={`chata-table-container-${this.TABLE_CONTAINER_ID}`}
        className="chata-table-container"
      >
        <ReactTabulator
          ref={ref => (this.ref = ref)}
          columns={this.state.columns}
          data={this.props.data}
          // rowClick={this.rowClick}
          cellClick={this.cellClick}
          options={options}
          data-custom-attr="test-custom-attribute"
          className="chata-table"
          // selectable
          height="100%"
          // style={{
          //   height: showFilteredDataWarning
          //     ? 'calc(100% - 50px) !important'
          //     : '100%'
          // }}
          clipboard
          download
        />
      </div>
    )
  }
}
