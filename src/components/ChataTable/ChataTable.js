import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { ReactTabulator } from 'react-tabulator'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { setCSSVars, isAggregation } from '../../js/Util'
import { themeConfigType } from '../../props/types'
import {
  themeConfigDefault,
  getThemeConfig,
  getAuthentication,
} from '../../props/defaults'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
import './ChataTable.scss'
import { runSubQuery } from '../../js/queryService'
import { formatFiltersForAPI, formatSortersForAPI } from './tableHelpers'

export default class ChataTable extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()
    this.firstRender = true
    this.hasSetInitialData = false
    this.ref = null
    this.currentPage = 1
    this.filterTagElements = []
    this.supportsDrilldown = isAggregation(props.columns)
    this.supportsInfiniteScroll = props.useInfiniteScroll && props.pageSize

    this.tableOptions = {
      ajaxProgressiveLoad: this.supportsInfiniteScroll ? 'scroll' : undefined,
      ajaxProgressiveLoadScrollMargin: 2000, // Trigger next ajax load when scroll bar is 2000px or less from the bottom of the table.
      ajaxURL: 'https://required-placeholder-url.com',
      ajaxSorting: true,
      ajaxFiltering: true,
      ajaxRequestFunc: (url, config, params) => {
        const formattedSorters = formatSortersForAPI(params, this.ref)
        const formattedFilters = formatFiltersForAPI(params, this.ref)

        if (!this.hasSetInitialData) {
          this.hasSetInitialData = true
          return Promise.resolve({ rows: this.props.data, page: 1 })
        }

        return runSubQuery({
          ...getAuthentication(props.authentication),
          queryId: props.queryID,
          page: params.page,
          sorters: formattedSorters,
          filters: formattedFilters,
        })
      },
      ajaxResponse: (url, params, response) => {
        this.currentPage = response.page
        const isLastPage = _get(response, 'rows.length', 0) < props.pageSize
        const lastPage = isLastPage ? this.currentPage : this.currentPage + 1

        let modResponse = {}
        modResponse.data = response.rows
        modResponse.last_page = lastPage
        return modResponse
      },
      ajaxError: (error) => {
        console.error(error)
      },
      dataLoadError: (error) => {
        console.error(error)
      },
      layout: 'fitDataFill',
      textSize: '9px',
      clipboard: true,
      download: true,
      downloadConfig: {
        columnGroups: false,
        rowGroups: false,
        columnCalcs: false,
      },
      cellClick: this.cellClick,
      dataSorting: (sorters) => {},
      dataFiltering: (filters) => {
        // The filters provided to this function don't include header filters
        // We only use header filters so we have to use the function below
        if (this._isMounted && this.ref && !this.firstRender) {
          const tableFilters = this.ref.table.getHeaderFilters()
          props.onFilterCallback(tableFilters, rows)
        }
      },
      downloadReady: (fileContents, blob) => blob,
    }

    setCSSVars(getThemeConfig(props.themeConfig))

    this.state = {
      columns: this.props.columns,
      isFilteringTable: false,
    }
  }

  static propTypes = {
    themeConfig: themeConfigType,
    data: PropTypes.arrayOf(PropTypes.array),
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    onFilterCallback: PropTypes.func,
    isResizing: PropTypes.bool,
    pageSize: PropTypes.number,
    useInfiniteScroll: PropTypes.bool,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    data: undefined,
    columns: undefined,
    isResizing: false,
    pageSize: 0,
    useInfiniteScroll: true,
    onFilterCallback: () => {},
    onCellClick: () => {},
    onErrorCallback: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.firstRender = false
    this.setTableHeaderValues = setTimeout(() => {
      this.setInitialHeaderFilters()
      this.setFilterTags({ isFilteringTable: false })
    }, 100)
  }

  // shouldComponentUpdate = () => {
  //   return false
  // }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }

    if (this.ref) {
      this.setDimensionsTimeout = setTimeout(() => {
        if (this._isMounted) {
          const tableHeight = _get(this.ref, 'ref.offsetHeight')
          if (tableHeight) {
            this.tableHeight = tableHeight
          }
        }
      }, 0)
    }

    if (this.props.isResizing) {
      this.isResizing = true
    }

    if (!this.state.isFilteringTable && prevState.isFilteringTable) {
      try {
        this.setFilterTags({ isFilteringTable: this.state.isFilteringTable })
      } catch (error) {
        console.error(error)
        this.props.onErrorCallback(error)
      }
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.setTableHeaderValues)
    clearTimeout(this.setDimensionsTimeout)
    this.resetFilterTags()
    this.existingFilterTag = undefined
    this.filterTagElements = undefined
  }

  setInitialHeaderFilters = () => {
    if (_get(this.props, 'headerFilters.length') && _get(this.ref, 'table')) {
      this.props.headerFilters.forEach((filter) => {
        this.ref.table.setHeaderFilterValue(filter.field, filter.value)
      })
    }
  }

  cellClick = (e, cell) => {
    this.props.onCellClick(cell)
  }

  copyToClipboard = () => {
    if (this._isMounted && this.ref?.table) {
      this.ref.table.copyToClipboard('active', true)
    }
  }

  saveAsCSV = () => {
    if (this._isMounted && this.ref?.table) {
      this.ref.table.download('csv', 'export.csv', {
        delimiter: ',',
      })
      return Promise.resolve()
    }
    return Promise.reject()
  }

  resetFilterTags = () => {
    if (this.filterTagElements.length) {
      this.filterTagElements.forEach((filterTag) => {
        try {
          if (filterTag.parentNode && this._isMounted)
            filterTag.parentNode.removeChild(filterTag)
        } catch (error) {}
      })
    }
  }

  setFilterTags = () => {
    this.resetFilterTags()

    let filterValues
    if (this._isMounted && this.ref?.table) {
      filterValues = this.ref.table.getHeaderFilters()
    }

    if (filterValues) {
      filterValues.forEach((filter, i) => {
        try {
          const colIndex = filter.field
          this.filterTagElements[colIndex] = document.createElement('span')
          this.filterTagElements[colIndex].innerText = 'F'
          this.filterTagElements[colIndex].setAttribute('class', 'filter-tag')

          this.columnTitleEl = document.querySelector(
            `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${colIndex}"] .tabulator-col-title`
          )
          this.columnTitleEl.insertBefore(
            this.filterTagElements[colIndex],
            this.columnTitleEl.firstChild
          )
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
        }
      })
    }
  }

  toggleTableFilter = ({ isFilteringTable }) => {
    this.setState({ isFilteringTable })
  }

  getTableHeight = () => {
    if (this.tableHeight) {
      return `${this.tableHeight}px`
    }

    return `${_get(this.props, 'style.height')}px`
  }

  render = () => {
    const height = this.getTableHeight()
    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-table-container-${this.TABLE_ID}`}
          ref={(ref) => (this.tableContainer = ref)}
          data-test="react-autoql-table"
          className={`react-autoql-table-container 
          ${this.supportsDrilldown ? 'supports-drilldown' : ''}
          ${this.state.isFilteringTable ? ' filtering' : ''}
          ${this.props.isResizing ? ' resizing' : ''}`}
          style={{
            ...this.props.style,
            flexBasis: height,
          }}
        >
          {this.props.data && this.props.columns && (
            <ReactTabulator
              ref={(ref) => (this.ref = ref)}
              id={`react-autoql-table-${this.TABLE_ID}`}
              columns={this.props.columns}
              data={this.supportsInfiniteScroll ? [] : this.props.data}
              options={this.tableOptions}
              data-custom-attr="test-custom-attribute"
              className="react-autoql-table"
              clipboard
              download
            />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
