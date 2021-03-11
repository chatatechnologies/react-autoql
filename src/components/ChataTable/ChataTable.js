import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { ReactTabulator } from 'react-tabulator'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { setCSSVars, isAggregation } from '../../js/Util'
import { themeConfigType } from '../../props/types'
import { themeConfigDefault, getThemeConfig } from '../../props/defaults'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
import './ChataTable.scss'

export default class ChataTable extends React.Component {
  firstRender = true
  ref = null

  static propTypes = {
    themeConfig: themeConfigType,
    data: PropTypes.arrayOf(PropTypes.array),
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    onFilterCallback: PropTypes.func,
    setFilterTagsCallback: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    data: undefined,
    columns: undefined,
    setFilterTagsCallback: () => {},
    onFilterCallback: () => {},
    onCellClick: () => {},
  }

  state = {
    columns: this.props.columns,
  }

  componentDidMount = () => {
    this.firstRender = false
    this.TABLE_CONTAINER_ID = uuid.v4()

    setCSSVars(getThemeConfig(this.props.themeConfig))
    setTimeout(() => {
      this.setInitialHeaderFilters()
      this.props.setFilterTagsCallback()
    }, 100)
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
    if (_get(this.props, 'headerFilters.length') && _get(this.ref, 'table')) {
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
        delimiter: '\t',
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
      downloadReady: (fileContents, blob) => blob,
    }

    const supportsDrilldown = isAggregation(this.props.columns)

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-table-container-${this.TABLE_CONTAINER_ID}`}
          data-test="react-autoql-table"
          className={`react-autoql-table-container 
          ${supportsDrilldown ? 'supports-drilldown' : ''}`}
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
      </ErrorBoundary>
    )
  }
}
