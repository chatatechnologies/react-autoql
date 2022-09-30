import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'

import TableWrapper from './TableWrapper'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { responseErrors } from '../../js/errorMessages'
import { getAuthentication } from '../../props/defaults'
import { getTableParams } from './tableHelpers'
import { Spinner } from '../Spinner'
import {
  runQueryOnly,
  runQueryNewPage,
  runDrilldown,
} from '../../js/queryService'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
import './ChataTable.scss'

export default class ChataTable extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()
    this.hasSetInitialData = false
    this.currentPage = 1
    this.filterTagElements = []
    this.headerFilters = props.initialParams?.filters || []
    this.queryID = props.queryID
    this.supportsInfiniteScroll = props.useInfiniteScroll && !!props.pageSize
    this.previousTableParams = props.initialParams

    this.tableOptions = {
      dataLoadError: (error) => console.error(error),
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
      initialSort: props.initialParams?.sorters,
      initialFilter: props.initialParams?.filters,
      dataSorting: (sorters) => {
        if (!this.supportsInfiniteScroll && this._isMounted) {
          this.isUpdating = true
          this.setState({ loading: true })
        }
      },
      dataSorted: (sorters, rows) => {
        if (!this.supportsInfiniteScroll && this.ref) {
          this.clearLoadingIndicators()
          props.onSorterCallback(sorters)
        }
      },
      dataFiltering: (filters) => {
        if (!this.supportsInfiniteScroll && this._isMounted) {
          this.isUpdating = true
          this.setState({ loading: true })

          if (this.ref) {
            const data = this.ref.table?.getData()
            if (data?.length) {
              this.data = data
            }
          }
        }
      },
      dataFiltered: (filters, rows) => {
        if (!this.supportsInfiniteScroll) {
          this.clearLoadingIndicators()

          const tableFilters = this.ref?.table?.getHeaderFilters()
          if (!_isEqual(tableFilters, this.headerFilters)) {
            // The filters provided to this function don't include header filters
            // We only use header filters so we have to use the function below
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
      this.tableOptions.ajaxRequestFunc = (url, config, params) =>
        this.ajaxRequestFunc(props, params)
      this.tableOptions.ajaxResponse = (url, params, response) =>
        this.ajaxResponseFunc(props, response)
      this.tableOptions.ajaxError = (error) => {
        console.error(error)
      }
    }

    this.state = {
      isFilteringTable: false,
      loading: false,
      pageLoading: false,
      scrollLoading: false,
      isLastPage: false,
      ref: null,
    }
  }

  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.array),
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    onFilterCallback: PropTypes.func,
    onSorterCallback: PropTypes.func,
    onTableParamsChange: PropTypes.func,
    isResizing: PropTypes.bool,
    pageSize: PropTypes.number,
    useInfiniteScroll: PropTypes.bool,
  }

  static defaultProps = {
    queryRequestData: {},
    data: undefined,
    columns: undefined,
    isResizing: false,
    pageSize: 0,
    useInfiniteScroll: true,
    source: [],
    onFilterCallback: () => {},
    onSorterCallback: () => {},
    onTableParamsChange: () => {},
    onCellClick: () => {},
    onErrorCallback: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (
      (this.state.scrollLoading && nextState.scrollLoading) ||
      (this.state.pageLoading && nextState.pageLoading) ||
      (this.state.loading && nextState.loading)
    ) {
      return false
    }

    return true
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (prevProps.isResizing && this.props.isResizing) {
      this.isUpdating = true
    } else if (
      !this.state.loading &&
      !this.state.pageLoading &&
      !this.state.scrollLoading
    ) {
      this.isUpdating = false
    }

    if (
      this.ref &&
      !this.state.loading &&
      !this.state.pageLoading &&
      !this.state.scrollLoading
    ) {
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
        this.setFilterTags()
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
    this.cancelCurrentRequest()
    this.resetFilterTags()
    this.existingFilterTag = undefined
    this.filterTagElements = undefined
  }

  onTabulatorMount = (tableRef) => {
    this.ref = tableRef
    this.setInitialParams(tableRef)
    this.setFilterTags(tableRef)
  }

  cancelCurrentRequest = () => {
    this.axiosSource?.cancel(responseErrors.CANCELLED)
  }

  ajaxRequestFunc = async (props, params) => {
    try {
      const prevTableParams = getTableParams(this.previousTableParams, this.ref)
      const tableParams = getTableParams(params, this.ref)
      if (_isEqual(prevTableParams, tableParams)) {
        return Promise.resolve()
      }

      if (!this.hasSetInitialData) {
        this.hasSetInitialData = true
        return Promise.resolve({ rows: this.props.data, page: 1 })
      }

      this.previousTableParams = params

      if (!props.queryRequestData) {
        console.warn(
          'Original request data was not provided to ChataTable, unable to filter or sort table'
        )
        return Promise.resolve()
      }

      // To avoid scroll jumping, use fixed height until next render
      this.isUpdating = true

      this.cancelCurrentRequest()
      this.axiosSource = axios.CancelToken.source()

      let response
      if (params?.page > 1) {
        this.setState({ scrollLoading: true })
        response = await this.getNewPage(props, tableParams)
        this.props.onNewPage(response?.rows)
      } else {
        this.setState({ pageLoading: true })
        const responseWrapper = await this.sortOrFilterData(props, tableParams)
        this.queryID = responseWrapper?.data?.data?.query_id
        response = { ..._get(responseWrapper, 'data.data', {}), page: 1 }
        this.props.onTableParamsChange(params)
        this.props.onNewData(responseWrapper)
      }

      this.clearLoadingIndicators()
      return response
    } catch (error) {
      if (error?.data?.message === responseErrors.CANCELLED) {
        return Promise.resolve()
      }

      console.error(error)
      this.clearLoadingIndicators()
      // Send empty promise so data doesn't change
      return Promise.resolve()
    }
  }

  clearLoadingIndicators = () => {
    /* The height of the table temporarily goes to 0 when new rows
    are added, which causes the scrollbar to jump up in DM.
    
    When loading indicators are visible, the height of the table 
    is fixed to the previous height in px. We need to wait until
    current event loop finishes so the table doesn't jump after
    the new rows are added */
    setTimeout(() => {
      if (this._isMounted) {
        this.setState({
          loading: false,
          scrollLoading: false,
          pageLoading: false,
        })
      }
    }, 0)
  }

  getNewPage = (props, tableParams) => {
    return runQueryNewPage({
      ...getAuthentication(props.authentication),
      ...tableParams,
      queryId: this.queryID,
      cancelToken: this.axiosSource.token,
    })
  }

  sortOrFilterData = (props, tableParams) => {
    if (props.isDrilldown) {
      return runDrilldown({
        ...getAuthentication(props.authentication),
        source: props.queryRequestData?.source,
        debug: props.queryRequestData?.translation === 'include',
        formattedUserSelection: props.queryRequestData?.user_selection,
        filters: props.queryRequestData?.session_filter_locks,
        test: props.queryRequestData?.test,
        groupBys: props.queryRequestData?.columns,
        queryID: props.originalQueryID, // todo: get original query ID from drillown response
        orders: tableParams?.sorters,
        tableFilters: tableParams?.filters,
        cancelToken: this.axiosSource.token,
      })
    } else {
      return runQueryOnly({
        ...getAuthentication(props.authentication),
        query: props.queryRequestData?.text,
        source: props.queryRequestData?.source,
        debug: props.queryRequestData?.translation === 'include',
        formattedUserSelection: props.queryRequestData?.user_selection,
        filters: props.queryRequestData?.session_filter_locks,
        test: props.queryRequestData?.test,
        pageSize: props.queryRequestData?.page_size,
        orders: tableParams?.sorters,
        tableFilters: tableParams?.filters,
        cancelToken: this.axiosSource.token,
      })
    }
  }

  ajaxResponseFunc = (props, response) => {
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

  setInitialParams = (ref) => {
    const filters = _cloneDeep(this.props.initialParams?.filters)

    if (filters?.length && ref?.table) {
      filters.forEach((filter) => {
        ref.table.setHeaderFilterValue(filter.field, filter.value)
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

  setFilterTags = (ref) => {
    this.resetFilterTags()

    let filterValues
    if (this._isMounted && ref?.table) {
      filterValues = ref.table.getHeaderFilters()
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

    return 'auto'
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
              this.state.scrollLoading ||
              this.state.loading ||
              this.isUpdating
                ? height
                : 'auto',
          }}
        >
          {this.props.data && this.props.columns && (
            <TableWrapper
              // tableRef={(ref) => this.setState({ ref })}
              tableKey={`react-autoql-table-${this.TABLE_ID}`}
              id={`react-autoql-table-${this.TABLE_ID}`}
              key={`react-autoql-table-wrapper-${this.TABLE_ID}`}
              data-test="autoql-tabulator-table"
              columns={this.props.columns}
              data={this.supportsInfiniteScroll ? [] : this.props.data}
              onTableMount={this.onTabulatorMount}
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
