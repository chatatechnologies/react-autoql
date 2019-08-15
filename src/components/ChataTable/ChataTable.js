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
    data: PropTypes.arrayOf(PropTypes.array).isRequired,
    borderColor: PropTypes.string,
    hoverColor: PropTypes.string
  }

  static defaultProps = {
    borderColor: '#ddd',
    // hoverColor: '#5a5a5a',
    hoverColor: '#ececec',
    onRowDblClick: () => {}
  }

  state = {}

  componentDidMount = () => {
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
    this.props.onRowDblClick(row.getData(), this.props.columns)
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
      downloadConfig: {
        columnGroups: false,
        rowGroups: false,
        columnCalcs: false
      },
      downloadDataFormatter: data => data,
      downloadReady: (fileContents, blob) => blob
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
          progressiveRenderMargin={10}
          height="100%"
          // selectable
          clipboard
          download
        />
      </div>
    )
  }
}
