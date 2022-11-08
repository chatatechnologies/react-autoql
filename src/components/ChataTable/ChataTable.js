import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { Popover } from 'react-tiny-popover'

import TableWrapper from './TableWrapper'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { responseErrors } from '../../js/errorMessages'
import { getAuthentication } from '../../props/defaults'
import { formatTableParams } from './tableHelpers'
import { Spinner } from '../Spinner'
import { runQueryOnly, runQueryNewPage, runDrilldown } from '../../js/queryService'
import { getTableConfigState } from './tableHelpers'
import { DatePicker } from '../DatePicker'

import { currentEventLoopEnd } from '../../js/Util'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)
import './ChataTable.scss'

export default class ChataTable extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()
    this.hasSetInitialData = false
    this.hasSetInitialParams = false
    this.currentPage = 1
    this.lastPage = props.data?.length < props.pageSize ? 1 : 2
    this.filterTagElements = []
    this.queryID = props.queryID
    this.supportsInfiniteScroll = props.useInfiniteScroll && !!props.pageSize
    this.tableParams = _cloneDeep(props.initialParams)

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
      initialSort: !this.supportsInfiniteScroll ? _cloneDeep(props.initialParams?.sorters) : undefined,
      initialFilter: !this.supportsInfiniteScroll ? _cloneDeep(props.initialParams?.filters) : undefined,
      dataSorting: (sorters) => {
        this.lockTableHeight()
        const formattedSorters = sorters.map((sorter) => {
          return {
            dir: sorter.dir,
            field: sorter.field,
          }
        })
        if (this.tableParams?.sorters && !_isEqual(formattedSorters, this.tableParams?.sorters) && this._isMounted) {
          this.isSorting = true
          this.setState({ loading: true })
        }
      },
      dataFiltering: (filters) => {
        this.lockTableHeight()
        const headerFilters = this.ref?.table?.getHeaderFilters()

        if (headerFilters && !_isEqual(headerFilters, this.tableParams?.filters) && this._isMounted) {
          this.isFiltering = true
          this.setState({ loading: true })
        }
      },
      dataSorted: (sorters, rows) => {
        if (this.isSorting) {
          this.isSorting = false
          if (!this.supportsInfiniteScroll && this.ref) {
            props.onSorterCallback(sorters)
          }
          setTimeout(() => {
            this.setState({ loading: false })
          }, 100)
        } else {
          this.unlockTableHeight()
        }
      },
      dataFiltered: (filters, rows) => {
        if (this.isFiltering) {
          this.isFiltering = false

          // The filters provided to this function don't include header filters
          // We only use header filters so we have to use the function below
          const headerFilters = this.ref?.table?.getHeaderFilters()

          if (!this.supportsInfiniteScroll) {
            this.tableParams.filters = _cloneDeep(headerFilters)
            props.onFilterCallback(headerFilters, rows)
          }

          setTimeout(() => {
            this.setState({ loading: false })
          }, 0)
        }
      },
      downloadReady: (fileContents, blob) => blob,
    }

    if (this.supportsInfiniteScroll) {
      this.tableOptions.ajaxProgressiveLoad = this.supportsInfiniteScroll ? 'scroll' : undefined
      this.tableOptions.ajaxProgressiveLoadScrollMargin = 800 // Trigger next ajax load when scroll bar is 800px or less from the bottom of the table.
      this.tableOptions.ajaxURL = 'https://required-placeholder-url.com'
      this.tableOptions.ajaxSorting = true
      this.tableOptions.ajaxFiltering = true
      this.tableOptions.virtualDomHoz = false
      this.tableOptions.progressiveRenderSize = 5
      this.tableOptions.progressiveRenderMargin = 100
      this.tableOptions.ajaxLoader = true
      this.tableOptions.ajaxLoaderLoading = ''
      this.tableOptions.ajaxLoaderError = ''
      this.tableOptions.ajaxRequestFunc = (url, config, params) => this.ajaxRequestFunc(props, params)
      this.tableOptions.ajaxResponse = (url, params, response) => this.ajaxResponseFunc(props, response)
      this.tableOptions.ajaxError = (error) => {
        console.error(error)
      }
    }

    this.state = {
      isFiltering: false,
      loading: false,
      pageLoading: false,
      scrollLoading: false,
      isLastPage: this.lastPage === 1,
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
    onSetTableHeight: PropTypes.func,
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
    onSetTableHeight: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.firstRender = false

    // Enable once calendar GUI feature is complete
    // this.clickListenerTimeout = setTimeout(() => {
    //   this.setDateFilterClickListeners()
    // }, 100)
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (!!this.state.datePickerColumn && !nextState.datePickerColumn) {
      return true
    }

    if (
      (this.state.scrollLoading && nextState.scrollLoading) ||
      (this.state.pageLoading && nextState.pageLoading) // ||
      // (this.state.loading && nextState.loading)
    ) {
      return false
    }

    return true
  }

  componentDidUpdate = (prevProps, prevState) => {
    this.saveCurrentTableHeight()

    if (!this.state.isFiltering && prevState.isFiltering) {
      try {
        this.setFilterTags()
        // Enable once calendar GUI feature is complete
        // this.setDateFilterClickListeners()
      } catch (error) {
        console.error(error)
        this.props.onErrorCallback(error)
      }
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.clickListenerTimeout)
    clearTimeout(this.setDimensionsTimeout)
    clearTimeout(this.setStateTimeout)
    this.cancelCurrentRequest()
    this.resetFilterTags()
    this.existingFilterTag = undefined
    this.filterTagElements = undefined
  }

  lockTableHeight = () => {
    if (
      (this.tableHeight || this.tableContainer?.style) &&
      !this.state.pageLoading &&
      !this.firstRender &&
      !this.props.isResizing
    ) {
      const height = this.tableHeight || getComputedStyle(this.tableContainer)?.height
      this.tableContainer.style.flexBasis = height
    }
  }

  unlockTableHeight = () => {
    setTimeout(() => {
      if (this.tableContainer?.style && !this.state.pageLoading && !this.firstRender && !this.props.isResizing) {
        this.tableContainer.style.flexBasis = 'auto'
      }
    }, 0)
  }

  saveCurrentTableHeight = () => {
    this.setDimensionsTimeout = setTimeout(() => {
      if (this.ref?.ref && !this.props.isResizing && !this.isLoading()) {
        const tableHeight = getComputedStyle(this.tableContainer)?.height

        if (tableHeight) {
          this.tableHeight = tableHeight
          this.props.onSetTableHeight(tableHeight)
        }
      }
    }, 500)
  }

  isLoading = () => {
    return (
      this.state.loading ||
      this.state.pageLoading ||
      this.state.scrollLoading ||
      this.isFiltering ||
      this.isSorting ||
      this.firstRender ||
      !this.hasSetInitialParams
    )
  }

  onTabulatorMount = async (tableRef) => {
    this.ref = tableRef

    await currentEventLoopEnd()

    this.setSorters(tableRef)
    this.setFilters(tableRef)
    this.setFilterTags()
    this.saveCurrentTableHeight()

    this.hasSetInitialParams = true
  }

  cancelCurrentRequest = () => {
    this.axiosSource?.cancel(responseErrors.CANCELLED)
  }

  ajaxRequestFunc = async (props, params) => {
    try {
      if (this.settingFilterInputs || !this.hasSetInitialData) {
        return Promise.resolve()
      }

      const tableParamsFormatted = formatTableParams(this.tableParams, this.ref)
      const nextTableParamsFormatted = formatTableParams(params, this.ref)

      if (_isEqual(tableParamsFormatted, nextTableParamsFormatted)) {
        return Promise.resolve()
      }

      this.tableParams = params

      if (!props.queryRequestData) {
        console.warn('Original request data was not provided to ChataTable, unable to filter or sort table')
        return Promise.resolve()
      }

      this.cancelCurrentRequest()
      this.axiosSource = axios.CancelToken.source()

      let response
      if (params?.page > 1) {
        this.setState({ scrollLoading: true })
        response = await this.getNewPage(props, nextTableParamsFormatted)
        this.props.onNewPage(response?.rows)
      } else {
        this.setState({ pageLoading: true })
        const responseWrapper = await props.queryFn({
          tableFilters: nextTableParamsFormatted?.filters,
          orders: nextTableParamsFormatted?.sorters,
        })
        this.queryID = responseWrapper?.data?.data?.query_id
        response = { ..._get(responseWrapper, 'data.data', {}), page: 1 }

        /* wait for current event loop to end so table is updated
        before callbacks are invoked */
        await currentEventLoopEnd()

        this.props.onTableParamsChange(params, nextTableParamsFormatted)
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

  clearLoadingIndicators = async () => {
    /* The height of the table temporarily goes to 0 when new rows
    are added, which causes the scrollbar to jump up in DM.

    When loading indicators are visible, the height of the table
    is fixed to the previous height in px. We need to wait until
    current event loop finishes so the table doesn't jump after
    the new rows are added */
    await currentEventLoopEnd()

    if (this._isMounted) {
      this.setState({
        loading: false,
        scrollLoading: false,
        pageLoading: false,
      })
    }
  }

  getNewPage = (props, tableParams) => {
    return runQueryNewPage({
      ...getAuthentication(props.authentication),
      ...tableParams,
      queryId: this.queryID,
      cancelToken: this.axiosSource.token,
    })
  }

  ajaxResponseFunc = (props, response) => {
    if (!response || !this.hasSetInitialData) {
      this.hasSetInitialData = true
      return {
        data: props.data,
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

    const modResponse = {}
    modResponse.data = response.rows
    modResponse.last_page = this.lastPage
    return modResponse
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

  debounceSetState = (state) => {
    this.stateToSet = {
      ...this.stateToSet,
      ...state,
    }

    clearTimeout(this.setStateTimeout)
    this.setStateTimeout = setTimeout(() => {
      this.setState(this.stateToSet)
      this.stateToSet = {}
    }, 50)
  }

  setDateFilterClickListeners = () => {
    const columns = this.ref?.table?.getColumnDefinitions()
    if (!columns) {
      return
    }

    columns.forEach((col) => {
      if (col.type === 'DATE' && !col.pivot) {
        const inputElement = document.querySelector(
          `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${col.field}"] .tabulator-col-content input`,
        )

        if (inputElement) {
          inputElement.addEventListener('search', (e) => {
            // When "x" button is clicked in the input box
            this.debounceSetState({
              datePickerColumn: undefined,
            })
          })
          inputElement.addEventListener('click', (e) => {
            const coords = e.target.getBoundingClientRect()
            const tableCoords = this.tableContainer.getBoundingClientRect()
            if (coords?.top && coords?.left) {
              this.debounceSetState({
                datePickerLocation: {
                  top: coords.top - tableCoords.top + coords.height + 5,
                  left: coords.left - tableCoords.left,
                },
                datePickerColumn: col,
              })
            }
          })
        }
      }
    })
  }

  resetFilterTags = () => {
    const filterTagElements = document.querySelectorAll(`#react-autoql-table-container-${this.TABLE_ID} .filter-tag`)

    if (filterTagElements?.length) {
      filterTagElements.forEach((filterTag) => {
        try {
          if (filterTag.parentNode && this._isMounted) {
            filterTag.parentNode.removeChild(filterTag)
          }
        } catch (error) {}
      })
    }
  }

  setFilterTags = () => {
    this.resetFilterTags()

    const filterValues = this.tableParams?.filters

    if (filterValues) {
      filterValues.forEach((filter, i) => {
        try {
          const filterTagEl = document.createElement('span')
          filterTagEl.innerText = 'F'
          filterTagEl.setAttribute('class', 'filter-tag')

          const columnTitleEl = document.querySelector(
            `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${filter.field}"] .tabulator-col-title`,
          )
          columnTitleEl.insertBefore(filterTagEl, columnTitleEl.firstChild)
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
        }
      })
    }
  }

  setFilters = (ref) => {
    const filterValues = this.tableParams?.filters
    this.settingFilterInputs = true

    if (filterValues) {
      filterValues.forEach((filter, i) => {
        try {
          ref.table.setHeaderFilterValue(filter.field, filter.value)
          if (!this.supportsInfiniteScroll) {
            ref.table.setFilter(filter.field, filter.type, filter.value)
          }
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
        }
      })
    }

    this.settingFilterInputs = false
  }

  onDateRangeSelection = (dateRangeSelection) => {
    const { startDate, endDate } = dateRangeSelection

    if (!startDate || !endDate) {
      return
    }

    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)

    const startDateISO8601 = startDateObj.toISOString()
    const endDateISO8601 = endDateObj.toISOString()

    const inputElement = document.querySelector(
      `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${this.state.datePickerColumn.field}"] .tabulator-col-content input`,
    )

    if (inputElement) {
      inputElement.focus()
      inputElement.value = `${startDateISO8601},${endDateISO8601}`
    }
  }

  setSorters = (ref) => {
    const sorterValues = this.tableParams?.sorters
    this.settingSorters = true

    if (sorterValues) {
      sorterValues.forEach((sorter, i) => {
        try {
          ref.table.setSort(sorter.field, sorter.dir)
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
        }
      })
    }

    this.settingSorters = false
  }

  toggleIsFiltering = () => {
    this.setState({ isFiltering: !this.state.isFiltering })
  }

  getTableHeight = () => {
    if (this.tableHeight) {
      return this.tableHeight
    } else if (this.props.height) {
      return this.props.height
    }

    return undefined
  }

  renderPageLoader = () => {
    return (
      <div className='table-loader table-page-loader'>
        <Spinner />
      </div>
    )
  }

  renderScrollLoader = () => {
    return (
      <div className='table-loader table-scroll-loader'>
        <Spinner />
      </div>
    )
  }

  renderDatePickerPopover = () => {
    if (!this.state.datePickerColumn) {
      return null
    }

    return (
      <Popover
        isOpen={!!this.state.datePickerColumn}
        align='start'
        positions={['bottom', 'right']}
        onClickOutside={(e) => {
          e.stopPropagation()
          this.setState({
            datePickerColumn: undefined,
          })
        }}
        content={
          <div className='react-autoql-table-date-picker'>
            <h3>{this.state.datePickerColumn?.display_name}</h3>
            <DatePicker onSelection={this.onDateRangeSelection} />
          </div>
        }
      >
        <div
          style={{
            position: 'absolute',
            top: this.state.datePickerLocation?.top,
            left: this.state.datePickerLocation?.left,
          }}
        />
      </Popover>
    )
  }

  render = () => {
    const height = this.getTableHeight()

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-table-container-${this.TABLE_ID}`}
          ref={(ref) => (this.tableContainer = ref)}
          data-test='react-autoql-table'
          className={`react-autoql-table-container 
          ${this.props.supportsDrilldowns ? 'supports-drilldown' : ''}
          ${this.state.isFiltering ? 'filtering' : ''}
          ${this.props.isResizing ? 'resizing' : ''}
          ${this.supportsInfiniteScroll ? 'infinite' : 'limited'}
          ${this.supportsInfiniteScroll && this.state.isLastPage ? 'last-page' : ''}
          ${this.props.pivot ? 'pivot' : ''}`}
          style={{
            ...this.props.style,
            flexBasis: this.props.isResizing || this.isLoading() ? height : 'auto',
          }}
        >
          {this.props.data && this.props.columns && (
            <TableWrapper
              tableKey={`react-autoql-table-${this.TABLE_ID}`}
              id={`react-autoql-table-${this.TABLE_ID}`}
              key={`react-autoql-table-wrapper-${this.TABLE_ID}`}
              data-test='autoql-tabulator-table'
              columns={this.props.columns}
              data={this.supportsInfiniteScroll ? [] : this.props.data}
              onTableMount={this.onTabulatorMount}
              cellClick={this.cellClick}
              options={this.tableOptions}
              data-custom-attr='test-custom-attribute'
              className='react-autoql-table'
              clipboard
              download
            />
          )}
          {this.state.pageLoading && this.renderPageLoader()}
          {this.state.scrollLoading && this.renderScrollLoader()}
          {this.renderDatePickerPopover()}
        </div>
      </ErrorBoundary>
    )
  }
}
