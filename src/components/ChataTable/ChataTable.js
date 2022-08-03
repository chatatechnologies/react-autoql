import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'

import TableWrapper from './TableWrapper'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { themeConfigType } from '../../props/types'
import { themeConfigDefault, getAuthentication } from '../../props/defaults'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
import './ChataTable.scss'
import { runQueryOnly, runQueryNewPage } from '../../js/queryService'
import { getTableConfigState } from './tableHelpers'
import { Spinner } from '../Spinner'
import { removeFromDOM } from '../../js/Util'

export default class ChataTable extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()
    this.firstRender = true
    this.hasSetInitialData = false
    this.ref = null
    this.currentPage = 1
    this.filterTagElements = []
    this.headerFilters = []
    this.queryID = props.queryID
    this.supportsInfiniteScroll = props.useInfiniteScroll && !!props.pageSize

    this.tableOptions = {
      dataLoadError: (error) => {
        console.error(error)
      },
      selectableCheck: () => false,
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
      dataFiltering: () => {
        const data = this.ref?.table?.getData()
        if (data?.length) {
          this.data = data
        }
      },
      dataFiltered: (filters, rows) => {
        const tableFilters = this.ref?.table?.getHeaderFilters()

        if (this.supportsInfiniteScroll) {
          props.onFilterCallback(tableFilters, rows)
          return
        }

        // The filters provided to this function don't include header filters
        // We only use header filters so we have to use the function below
        if (
          !this.supportsInfiniteScroll &&
          this._isMounted &&
          this.ref &&
          !this.firstRender
        ) {
          if (!_isEqual(tableFilters, this.headerFilters)) {
            this.headerFilters = tableFilters
            props.onFilterCallback(tableFilters, rows)
          }
        }
      },
      downloadReady: (fileContents, blob) => blob,
    }

    if (this.supportsInfiniteScroll) {
      this.tableOptions.ajaxProgressiveLoad = this.supportsInfiniteScroll
        ? 'scroll'
        : undefined
      this.tableOptions.ajaxProgressiveLoadScrollMargin = 800 // Trigger next ajax load when scroll bar is 800px or less from the bottom of the table.
      this.tableOptions.ajaxURL = 'https://required-placeholder-url.com'
      this.tableOptions.ajaxSorting = true
      this.tableOptions.ajaxFiltering = true
      this.tableOptions.virtualDomHoz = true
      this.tableOptions.progressiveRenderSize = 5
      this.tableOptions.progressiveRenderMargin = 100
      this.tableOptions.ajaxLoader = true
      this.tableOptions.ajaxLoaderLoading = ''
      this.tableOptions.ajaxLoaderError = ''
      this.tableOptions.ajaxRequestFunc = async (url, config, params) => {
        try {
          const tableConfigState = getTableConfigState(params, this.ref)
          if (_isEqual(this.previousTableConfigState, tableConfigState)) {
            return Promise.resolve()
          }

          this.previousTableConfigState = tableConfigState

          if (!this.hasSetInitialData) {
            this.hasSetInitialData = true
            return Promise.resolve({ rows: this.props.data, page: 1 })
          }

          let response
          if (params?.page > 1) {
            this.setState({ scrollLoading: true })
            response = await runQueryNewPage({
              ...getAuthentication(props.authentication),
              ...tableConfigState,
              queryId: this.queryID,
            })
            this.props.onNewPage(response?.rows)
          } else if (!props.queryRequestData) {
            console.warn(
              'Original request data was not provided to ChataTable, unable to filter or sort table'
            )
          } else {
            this.setState({ pageLoading: true })

            const responseWrapper = await runQueryOnly({
              ...getAuthentication(props.authentication),
              ...props.queryRequestData,
              query: props.queryText,
              pageSize: props.pageSize,
              orders: tableConfigState?.sorters,
              tableFilters: tableConfigState?.filters,
            })
            this.queryID = responseWrapper?.data?.data?.query_id
            response = { ..._get(responseWrapper, 'data.data', {}), page: 1 }
            this.props.onNewData(response?.rows)
          }

          this.setState({ scrollLoading: false, pageLoading: false })
          return response
        } catch (error) {
          this.setState({ scrollLoading: false, pageLoading: false })
          // Send empty promise so data doesn't change
          return Promise.resolve()
        }
      }
      this.tableOptions.ajaxResponse = (url, params, response) => {
        if (!response) {
          return {
            data: this.data,
            last_page: this.lastPage,
          }
        }

        this.currentPage = response.page
        const isLastPage = _get(response, 'rows.length', 0) < props.pageSize
        this.lastPage = isLastPage ? this.currentPage : this.currentPage + 1

        if (isLastPage && !this.state.isLastPage) {
          this.setState({ isLastPage: true })
        } else if (this.state.isLastPage) {
          this.setState({ isLastPage: false })
        }

        let modResponse = {}
        modResponse.data = response.rows
        modResponse.last_page = this.lastPage
        return modResponse
      }
      this.tableOptions.ajaxError = (error) => {
        console.error(error)
      }
    }

    this.state = {
      isFilteringTable: false,
      pageLoading: false,
      scrollLoading: false,
      isLastPage: false,
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
    queryRequestData: {},
    data: undefined,
    columns: undefined,
    isResizing: false,
    pageSize: 0,
    useInfiniteScroll: true,
    source: [],
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

  componentDidUpdate = (prevProps, prevState) => {
    if (prevProps.isResizing && this.props.isResizing) {
      this.justResized = true
    } else {
      this.justResized = false
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

  saveAsCSV = (delay) => {
    try {
      if (this._isMounted && this.ref?.table) {
        let tableClone = _cloneDeep(this.ref.table)
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            tableClone.download('csv', 'export.csv', {
              delimiter: ',',
            })
            tableClone = undefined
            resolve()
          }, delay)
        })
      }
    } catch (error) {
      console.error(error)
    }
    return Promise.reject()
  }

  resetFilterTags = () => {
    if (this.filterTagElements?.length) {
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
    } else if (_get(this.props, 'style.height')) {
      return `${this.props.style.height}px`
    }

    return undefined
  }

  renderPageLoader = () => {
    return (
      <div className="table-loader table-page-loader">
        <Spinner />
      </div>
    )
  }

  renderScrollLoader = () => {
    return (
      <div className="table-loader table-scroll-loader">
        <Spinner />
      </div>
    )
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
          ${this.props.supportsDrilldowns ? 'supports-drilldown' : ''}
          ${this.state.isFilteringTable ? 'filtering' : ''}
          ${this.props.isResizing ? 'resizing' : ''}
          ${this.supportsInfiniteScroll ? 'infinite' : 'limited'}
          ${this.state.isLastPage ? 'last-page' : ''}
          ${this.props.pivot ? 'pivot' : ''}`}
          style={{
            ...this.props.style,
            flexBasis:
              this.props.isResizing ||
              this.state.pageLoading ||
              this.justResized
                ? height
                : 'auto',
          }}
        >
          {this.props.data && this.props.columns && (
            <TableWrapper
              tableRef={(ref) => (this.ref = ref)}
              tableKey={`react-autoql-table-${this.TABLE_ID}`}
              id={`react-autoql-table-${this.TABLE_ID}`}
              key={`react-autoql-table-wrapper-${this.TABLE_ID}`}
              data-test="autoql-tabulator-table"
              columns={this.props.columns}
              data={this.supportsInfiniteScroll ? [] : this.props.data}
              cellClick={this.cellClick}
              options={this.tableOptions}
              data-custom-attr="test-custom-attribute"
              className="react-autoql-table"
              clipboard
              download
            />
          )}
          {this.state.pageLoading && this.renderPageLoader()}
          {this.state.scrollLoading && this.renderScrollLoader()}
        </div>
      </ErrorBoundary>
    )
  }
}
