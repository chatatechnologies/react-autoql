import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import {
  ReactTabulator,
  // reactFormatter
} from 'react-tabulator'

import { setCSSVars } from '../../js/Util'

// import DateEditor from 'react-tabulator/lib/editors/DateEditor'
// import MultiValueFormatter from 'react-tabulator/lib/formatters/MultiValueFormatter'
// import MultiSelectEditor from 'react-tabulator/lib/editors/MultiSelectEditor'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
import './ChataTable.scss'
import { themeConfigType } from '../../props/types'
import { themeConfigDefault, getThemeConfig } from '../../props/defaults'

export default class ChataTable extends React.Component {
  firstRender = true
  ref = null

  static propTypes = {
    themeConfig: themeConfigType,
    data: PropTypes.arrayOf(PropTypes.array),
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    onRowClick: PropTypes.func,
    onFilterCallback: PropTypes.func,
    setFilterTagsCallback: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    data: undefined,
    columns: undefined,
    setFilterTagsCallback: () => {},
    onFilterCallback: () => {},
    onRowClick: () => {},
    onCellClick: () => {},
  }

  state = {
    columns: this.props.columns,
  }

  componentDidMount = () => {
    this.firstRender = false
    this.TABLE_CONTAINER_ID = uuid.v4()
    this.setInitialHeaderFilters()
    setCSSVars(getThemeConfig(this.props.themeConfig))

    setTimeout(this.props.setFilterTagsCallback, 100)
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    // Tabulator takes care of updates in these cases
    // No need to re-render after filter changes
    const thisPropsFiltered = {
      ...this.props,
      data: undefined,
      headerFilters: undefined,
    }
    const nextPropsFiltered = {
      ...nextProps,
      data: undefined,
      headerFilters: undefined,
    }

    if (!_isEqual(thisPropsFiltered, nextPropsFiltered)) {
      return true
    } else if (!_isEqual(this.state, nextState)) {
      return true
    }
    return false
  }

  componentDidUpdate = (prevProps) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
  }

  setInitialHeaderFilters = () => {
    if (_get(this.props, 'headerFilters.length') && this.ref) {
      this.props.headerFilters.forEach((filter) => {
        this.ref.table.setHeaderFilterValue(filter.field, filter.value)
      })
    }
  }

  cellClick = (e, cell) => {
    // e.preventDefault()
    // e.stopPropagation()
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
        delimeter: ',',
      })
    }
  }

  getBase64Data = () => {
    if (this.ref && this.ref.table) {
      const data = this.ref.table.getData()
      const columns = this.ref.table.getColumnDefinitions()
      const columnNames = columns.map((col) => col.title)
      data.unshift(columnNames)

      const csvContent =
        // We may want to specify this information in the future
        // "data:text/csv;charset=utf-8," +
        data.map((row) => row.join(',')).join('\n')
      const encodedContent = btoa(csvContent)
      return Promise.resolve(encodedContent)
    }

    return Promise.reject()
  }

  render = () => {
    const options = {
      // layout: 'fitDataStretch',
      layout: 'fitDataFill',
      textSize: '9px',
      movableColumns: true,
      progressiveRender: true,
      progressiveRenderSize: 5,
      progressiveRenderMargin: 100,
      downloadConfig: {
        columnGroups: false,
        rowGroups: false,
        columnCalcs: false,
      },
      dataFiltering: (filters) => {
        // The filters provided to this function don't include header filters
        // We only use header filters so we have to use the function below
        if (this.ref && !this.firstRender) {
          this.props.onFilterCallback(this.ref.table.getHeaderFilters())
        }
      },
      downloadDataFormatter: (data) => data,
      downloadReady: (fileContents, blob) => blob,
    }

    return (
      <div
        id={`react-autoql-table-container-${this.TABLE_CONTAINER_ID}`}
        data-test="react-autoql-table"
        className="react-autoql-table-container"
        style={this.props.style}
      >
        {this.props.data && this.props.columns && (
          <ReactTabulator
            ref={(ref) => (this.ref = ref)}
            columns={this.state.columns}
            data={this.props.data}
            cellClick={this.cellClick}
            options={options}
            data-custom-attr="test-custom-attribute"
            className="react-autoql-table"
            height="100%"
            clipboard
            download
          />
        )}
      </div>
    )
  }
}
