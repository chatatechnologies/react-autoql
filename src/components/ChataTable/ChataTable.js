import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { Popover } from 'react-tiny-popover'
import dayjs from '../../js/dayjsWithPlugins'

import TableWrapper from './TableWrapper'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { responseErrors } from '../../js/errorMessages'
import { getAuthentication, getDataFormatting } from '../../props/defaults'
import { formatTableParams } from './tableHelpers'
import { Spinner } from '../Spinner'
import { runQueryNewPage } from '../../js/queryService'
import { DatePicker } from '../DatePicker'
import { getFilterPrecision } from '../../js/dateUtils'
import { DAYJS_PRECISION_FORMATS } from '../../js/Constants'
import { currentEventLoopEnd, deepEqual, difference } from '../../js/Util'
import { columnOptionsList } from './tabulatorConstants'
import { Button } from '../Button'

import 'tabulator-tables/dist/css/tabulator.min.css' //import Tabulator stylesheet
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
    this.isFiltering = false
    this.isSorting = false

    this.tableParams = _cloneDeep(props.initialParams) ?? {
      filter: [],
      sort: [],
    }

    this.tableOptions = {
      selectableCheck: () => false,
      initialSort: !this.supportsInfiniteScroll ? this.tableParams?.sort : undefined,
      initialFilter: !this.supportsInfiniteScroll ? this.tableParams?.filter : undefined,
      progressiveLoadScrollMargin: 100, // Trigger next ajax load when scroll bar is 800px or less from the bottom of the table.
      // renderHorizontal: 'virtual', // v4: virtualDomHoz = false
      downloadEncoder: function (fileContents, mimeType) {
        //fileContents - the unencoded contents of the file
        //mimeType - the suggested mime type for the output

        //custom action to send blob to server could be included here

        return new Blob([fileContents], { type: mimeType }) //must return a blob to proceed with the download, return false to abort download
      },
    }

    if (this.supportsInfiniteScroll) {
      this.tableOptions.sortMode = 'remote' // v4: ajaxSorting = true
      this.tableOptions.filterMode = 'remote' // v4: ajaxFiltering = true
      this.tableOptions.paginationMode = 'remote'
      this.tableOptions.progressiveLoad = 'scroll' // v4: ajaxProgressiveLoad
      this.tableOptions.ajaxURL = 'https://required-placeholder-url.com'
      this.tableOptions.paginationSize = props.pageSize
      this.tableOptions.paginationInitialPage = 1
      this.tableOptions.ajaxRequesting = (url, params) => this.ajaxRequesting(props, params)
      this.tableOptions.ajaxRequestFunc = (url, config, params) => this.ajaxRequestFunc(props, params)
      this.tableOptions.ajaxResponse = (url, params, response) => this.ajaxResponseFunc(props, response)
    }

    this.state = {
      isFiltering: false,
      isSorting: false,
      loading: false,
      pageLoading: false,
      scrollLoading: false,
      isLastPage: this.lastPage === 1,
      ref: null,
      subscribedData: undefined,
      firstRender: true,
    }
  }

  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.array),
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    shouldRender: PropTypes.bool,
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
    pageSize: undefined,
    useInfiniteScroll: true,
    source: null,
    shouldRender: true,
    autoHeight: true,
    onFilterCallback: () => {},
    onSorterCallback: () => {},
    onTableParamsChange: () => {},
    onCellClick: () => {},
    onErrorCallback: () => {},
    onSetTableHeight: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    if (!this.props.autoHeight) {
      this.initialTableHeight = this.tabulatorContainer?.clientHeight
      this.lockedTableHeight = this.initialTableHeight
    }

    this.setState({
      firstRender: false,
    })
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (!this.state.tabulatorMounted && nextState.tabulatorMounted) {
      return true
    }

    if (this.props.rowChangeCount !== nextProps.rowChangeCount) {
      return true
    }

    if (this.props.isAnimating && !nextProps.isAnimating) {
      return true
    }

    if (!!this.state.datePickerColumn && !nextState.datePickerColumn) {
      return true
    }

    if (
      (this.props.hidden && !nextProps.hidden) ||
      (!this.props.hidden && !deepEqual(this.props.columns, nextProps.columns))
    ) {
      return true
    }

    if (
      (this.props.hidden && nextProps.hidden) ||
      (this.state.scrollLoading && nextState.scrollLoading) ||
      (this.state.pageLoading && nextState.pageLoading) ||
      (this.props.isResizing && nextProps.isResizing) ||
      (this.props.isAnimating && nextProps.isAnimating)
    ) {
      return false
    }

    const propsOrStateNotEqual = !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
    return propsOrStateNotEqual
  }

  getSnapshotBeforeUpdate = (prevProps, prevState) => {
    let newTableHeight
    let shouldSetTableHeight
    if (
      (!this.props.isResizing && prevProps.isResizing) ||
      (!this.props.isAnimating && prevProps.isAnimating) ||
      (!this.state.firstRender && prevState.firstRender) ||
      (!this.props.hidden && prevProps.hidden && !this.hasSetTableHeight)
    ) {
      shouldSetTableHeight = true
    }

    if (this.props.isResizing && !prevProps.isResizing) {
      shouldSetTableHeight = true
      newTableHeight = '100%'
    }

    return { shouldSetTableHeight, newTableHeight }
  }

  componentDidUpdate = (prevProps, prevState, { shouldSetTableHeight, newTableHeight }) => {
    if (shouldSetTableHeight) {
      this.setTableHeight(newTableHeight)
    }

    if (!this.props.hidden && prevProps.hidden) {
      if (this.state.subscribedData) {
        this.updateData(this.state.subscribedData)
        this.setState({ subscribedData: undefined })
      } else {
        this.ref?.restoreRedraw()
      }
    }

    if (this.props.columns && !deepEqual(this.props.columns, prevProps.columns)) {
      this.ref?.tabulator?.setColumns(this.getFilteredTabulatorColumnDefinitions())
      this.setHeaderInputClickListeners()
    }

    if (this.state.tabulatorMounted && !prevState.tabulatorMounted) {
      this.setFilterTags()
      this.setHeaderInputClickListeners()
      if (!this.props.hidden) {
        this.setTableHeight()
      }

      this.hasSetInitialParams = true
    }

    if (!this.state.isFiltering && prevState.isFiltering) {
      try {
        this.setFilterTags()
      } catch (error) {
        console.error(error)
        this.props.onErrorCallback(error)
      }
    }
  }

  componentWillUnmount = () => {
    try {
      this._isMounted = false
      clearTimeout(this.clickListenerTimeout)
      clearTimeout(this.setDimensionsTimeout)
      clearTimeout(this.setStateTimeout)
      this.cancelCurrentRequest()
      this.resetFilterTags()
      this.existingFilterTag = undefined
      this.filterTagElements = undefined
    } catch (error) {
      console.error(error)
    }
  }

  updateData = (data) => {
    this.ref?.updateData(data)
  }

  onDataSorting = (sorters) => {
    if (this._isMounted) {
      const formattedSorters = sorters.map((sorter) => {
        return {
          dir: sorter.dir,
          field: sorter.field,
        }
      })

      if (this.tableParams?.sort && !_isEqual(formattedSorters, this.tableParams?.sort)) {
        this.isSorting = true
        this.setLoading(true)
      }
    }
  }

  onDataSorted = (sorters, rows) => {
    if (this.isSorting) {
      this.isSorting = false
      if (!this.supportsInfiniteScroll && this.ref) {
        this.props.onSorterCallback(sorters)
      }
      this.setLoading(false)
    }
  }

  onDataFiltering = () => {
    if (this._isMounted && this.state.tabulatorMounted) {
      const headerFilters = this.ref?.tabulator?.getHeaderFilters()

      if (headerFilters && !_isEqual(headerFilters, this.tableParams?.filter)) {
        this.isFiltering = true
        this.setLoading(true)
      }
    }
  }

  onDataFiltered = (filters, rows) => {
    if (this.isFiltering && this.state.tabulatorMounted) {
      this.isFiltering = false

      // The filters provided to this function don't include header filters
      // We only use header filters so we have to use the function below
      const headerFilters = this.ref?.tabulator?.getHeaderFilters()

      if (!this.supportsInfiniteScroll) {
        this.tableParams.filter = _cloneDeep(headerFilters)
        this.props.onFilterCallback(headerFilters, rows)
      }

      setTimeout(() => {
        this.setState({ loading: false })
      }, 0)
    }
  }

  setLoading = (loading) => {
    // Don't update state unnecessarily
    if (loading !== this.state.loading) {
      this.setState({ loading })
    }
  }

  isLoading = () => {
    return (
      this.state.loading ||
      this.state.firstRender ||
      this.state.pageLoading ||
      this.state.scrollLoading ||
      this.isFiltering ||
      this.isSorting ||
      !this.hasSetInitialParams
    )
  }

  onTableBuilt = async () => {
    this.setState({
      tabulatorMounted: true,
      pageLoading: false,
    })
  }

  setTableHeight = (height) => {
    // The table height and width after initial render should height for the session
    // Doing this avoids the scroll jump when filtering or sorting the data
    // It is also makes tabulator more efficient
    if (
      this.state.tabulatorMounted &&
      this.tabulatorContainer &&
      !this.props.isAnimating &&
      !this.props.isResizing &&
      !this.props.hidden
    ) {
      const tableHeight = height ?? this.tabulatorContainer.clientHeight
      if (tableHeight && tableHeight !== this.lockedTableHeight) {
        this.ref?.tabulator?.setHeight(tableHeight)
        this.lockedTableHeight = tableHeight
        if (height !== '100%') {
          this.hasSetTableHeight = true
        }
      }
    }
  }

  cancelCurrentRequest = () => {
    this.axiosSource?.cancel(responseErrors.CANCELLED)
  }

  ajaxRequesting = (props, params) => {
    // Use this fn to abort a request
  }

  ajaxRequestFunc = async (props, params) => {
    const previousResponseData = this.props.response?.data?.data ?? {}
    const previousData = { ...previousResponseData, page: 1, isPreviousData: true }

    try {
      const requestedNewPageWhileLoadingFilter = params?.page > 1 && this.state.pageLoading
      if (!this.hasSetInitialData) {
        this.hasSetInitialData = true
        return previousData
      }

      if (requestedNewPageWhileLoadingFilter) {
        return previousData
      }

      const tableParamsFormatted = formatTableParams(this.tableParams, this.ref?.tabulator, props.columns)
      const nextTableParamsFormatted = formatTableParams(params, this.ref?.tabulator, props.columns)

      if (_isEqual(tableParamsFormatted, nextTableParamsFormatted)) {
        return previousData
      }

      this.tableParams = params

      if (!props.queryRequestData) {
        console.warn('Original request data was not provided to ChataTable, unable to filter or sort table')
        return previousData
      }

      this.cancelCurrentRequest()
      this.axiosSource = axios.CancelToken?.source()

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
          cancelToken: this.axiosSource.token,
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
        return previousData
      }

      console.error(error)
      this.clearLoadingIndicators()
      // Send empty promise so data doesn't change
      return previousData
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
    if (response) {
      if (!response.isPreviousData) {
        this.ref?.restoreRedraw()
      }

      this.currentPage = response.page
      const isLastPage = _get(response, 'rows.length', 0) < props.pageSize
      this.lastPage = isLastPage ? this.currentPage : this.currentPage + 1

      if (isLastPage && !this.state.isLastPage) {
        this.setState({ isLastPage: true })
      } else if (!isLastPage && this.state.isLastPage) {
        this.setState({ isLastPage: false })
      }

      const modResponse = {}
      modResponse.data = response.rows
      modResponse.last_page = this.lastPage

      return modResponse
    }

    return {
      data: [],
      last_page: this.lastPage,
    }
  }

  cellClick = (e, cell) => {
    this.props.onCellClick(cell)
  }

  copyToClipboard = () => {
    if (this._isMounted && this.ref?.tabulator) {
      this.ref.tabulator.copyToClipboard('active', true)
    }
  }

  saveAsCSV = (delay) => {
    try {
      if (this._isMounted && this.ref?.tabulator) {
        let tableClone = _cloneDeep(this.ref.tabulator)
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

  inputKeydownListener = () => {
    if (!this.supportsInfiniteScroll) {
      this.ref?.restoreRedraw()
    }
  }

  inputSearchListener = () => {
    // When "x" button is clicked in the input box
    if (!this.supportsInfiniteScroll) {
      this.ref?.restoreRedraw()
    }
  }

  inputDateSearchListener = () => {
    this.currentDateRangeSelections = {}
    this.debounceSetState({
      datePickerColumn: undefined,
    })
  }

  inputDateClickListener = (e, col) => {
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
  }

  inputDateKeypressListener = (e) => {
    e.stopPropagation()
    e.preventDefault()
  }

  setHeaderInputClickListeners = () => {
    const columns = this.props.columns
    if (!columns) {
      return
    }

    columns.forEach((col) => {
      const inputElement = document.querySelector(
        `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${col.field}"] .tabulator-col-content input`,
      )

      if (inputElement) {
        inputElement.removeEventListener('keydown', this.inputKeydownListener)
        inputElement.addEventListener('keydown', this.inputKeydownListener)

        inputElement.removeEventListener('search', this.inputSearchListener)
        inputElement.addEventListener('search', this.inputSearchListener)

        if (col.type === 'DATE' && !col.pivot) {
          inputElement.removeEventListener('search', this.inputDateSearchListener)
          inputElement.addEventListener('search', this.inputDateSearchListener)

          // Open Calendar Picker when user clicks on this field
          inputElement.removeEventListener('click', (e) => this.inputDateClickListener(e, col))
          inputElement.addEventListener('click', (e) => this.inputDateClickListener(e, col))

          // Do not allow user to type in this field
          const keyboardEvents = ['keypress', 'keydown', 'keyup']
          keyboardEvents.forEach((evt) => {
            inputElement.removeEventListener(evt, this.inputDateKeypressListener)
            inputElement.addEventListener(evt, this.inputDateKeypressListener)
          })
        }
      }
    })
  }

  resetFilterTags = () => {
    const filterTagElements = this.tableContainer?.querySelectorAll(
      `#react-autoql-table-container-${this.TABLE_ID} .filter-tag`,
    )

    if (filterTagElements?.length) {
      filterTagElements.forEach((filterTag) => {
        try {
          if (filterTag.parentNode && this._isMounted) {
            filterTag.parentNode.removeChild(filterTag)
          }
        } catch (error) {}
      })
    }

    return
  }

  setFilterTags = () => {
    this.resetFilterTags()

    const filterValues = this.tableParams?.filter

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

    return
  }

  setFilters = () => {
    const filterValues = this.tableParams?.filter
    this.settingFilterInputs = true

    if (filterValues) {
      filterValues.forEach((filter, i) => {
        try {
          this.ref?.tabulator?.setHeaderFilterValue(filter.field, filter.value)
          if (!this.supportsInfiniteScroll) {
            this.ref?.tabulator?.setFilter(filter.field, filter.type, filter.value)
          }
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
        }
      })
    }

    this.settingFilterInputs = false
  }
  onDateRangeSelectionApplied = () => {
    this.setState({ datePickerColumn: undefined })
    const column = this.state.datePickerColumn
    if (!this.state.dateRangeSelection) {
      return
    }
    const { startDate, endDate } = this.state.dateRangeSelection

    if (!column) {
      return
    }

    let start = startDate
    let end = endDate
    if (startDate && !endDate) {
      end = start
    } else if (!startDate && endDate) {
      start = end
    }

    const inputElement = document.querySelector(
      `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${column.field}"] .tabulator-col-content input`,
    )

    if (inputElement) {
      const filterPrecision = getFilterPrecision(column)
      const dayJSFormatStr = DAYJS_PRECISION_FORMATS[filterPrecision]

      const startDateStr = dayjs(start).format(dayJSFormatStr)
      const startDateUTC = dayjs.utc(startDateStr).toISOString()
      const formattedStartDate = dayjs(startDateUTC).utc().format(dayJSFormatStr)

      const endDateStr = dayjs(end).format(dayJSFormatStr)
      const endDateUTC = dayjs.utc(endDateStr).toISOString()
      const formattedEndDate = dayjs(endDateUTC).utc().format(dayJSFormatStr)

      let filterInputText = `${formattedStartDate} to ${formattedEndDate}`
      if (formattedStartDate === formattedEndDate) {
        filterInputText = formattedStartDate
      }

      inputElement.focus()
      this.ref?.restoreRedraw()
      inputElement.value = filterInputText
      inputElement.title = filterInputText
      inputElement.blur()
      this.currentDateRangeSelections = {
        [column.field]: this.state.dateRangeSelection,
      }
    }
  }
  onDateRangeSelection = (dateRangeSelection) => {
    this.setState({ dateRangeSelection })
  }

  setSorters = () => {
    const sorterValues = this.tableParams?.sort
    this.settingSorters = true

    if (sorterValues) {
      sorterValues.forEach((sorter, i) => {
        try {
          this.ref?.tabulator?.setSort(sorter.field, sorter.dir)
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
        }
      })
    }

    this.settingSorters = false
  }

  toggleIsFiltering = () => {
    const isFiltering = !this.state.isFiltering
    this.setState({ isFiltering })
    return isFiltering
  }

  renderEmptyPlaceholderText = () => {
    return (
      <div className='table-loader table-page-loader table-placeholder'>
        <div>No results</div>
      </div>
    )
  }

  renderPageLoader = () => {
    return (
      <div className='table-loader table-page-loader'>
        <div className='page-loader-spinner'>
          <Spinner />
        </div>
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
        positions={['bottom', 'right', 'left', 'top']}
        onClickOutside={(e) => {
          e.stopPropagation()
          this.setState({
            datePickerColumn: undefined,
          })
        }}
        content={
          <div className='react-autoql-table-date-picker'>
            <h3>{this.state.datePickerColumn.display_name}</h3>
            <DatePicker
              initialRange={this.currentDateRangeSelections?.[this.state.datePickerColumn.field]}
              onSelection={this.onDateRangeSelection}
              validRange={this.state.datePickerColumn.dateRange}
              type={this.state.datePickerColumn.precision}
            />
            <Button type='primary' onClick={this.onDateRangeSelectionApplied} tooltipID={this.props.tooltipID}>
              Apply
            </Button>
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

  getFilteredTabulatorColumnDefinitions = () => {
    try {
      if (this.props.columns?.length) {
        const filteredColumns = this.props.columns.map((col) => {
          const newCol = {}
          Object.keys(col).forEach((option) => {
            if (columnOptionsList.includes(option)) {
              newCol[option] = col[option]
            }
          })
          return newCol
        })

        return filteredColumns
      }
    } catch (error) {
      console.error(error)
    }

    return []
  }

  renderTableRowCount = () => {
    let currentRowCount = this.props.data?.length
    let totalRowCount = this.props.totalRows
    const shouldRenderTRC = this.props.enableAjaxTableData && totalRowCount && currentRowCount

    if (!shouldRenderTRC) {
      return null
    }

    const tabulatorRowCount = this.getTabulatorRowCount()
    if (!this.props.useInfiniteScroll && tabulatorRowCount !== undefined) {
      currentRowCount = tabulatorRowCount
      totalRowCount = tabulatorRowCount
    }

    return (
      <div className='table-row-count'>
        <span>{`Scrolled ${currentRowCount} / ${totalRowCount} rows`}</span>
      </div>
    )
  }

  getTabulatorRowCount = () => {
    return this.ref?.tabulator?.getDataCount('active')
  }

  isTableEmpty = () => {
    if (this.props.data?.length === 0) {
      return true
    }

    const tabulatorRowCount = this.getTabulatorRowCount()
    if (this.props.rowChangeCount > 0 && this.state.tabulatorMounted && tabulatorRowCount === 0) {
      return true
    }

    return false
  }

  render = () => {
    const isEmpty = this.isTableEmpty()

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-table-container-${this.TABLE_ID}`}
          ref={(ref) => (this.tableContainer = ref)}
          data-test='react-autoql-table'
          style={this.props.style}
          className={`react-autoql-table-container 
           ${this.state.pageLoading || !this.state.tabulatorMounted ? 'loading' : ''}
            ${this.props.supportsDrilldowns ? 'supports-drilldown' : ''}
            ${this.state.isFiltering ? 'filtering' : ''}
            ${this.props.isResizing ? 'resizing' : ''}
            ${this.props.isAnimating ? 'animating' : ''}
            ${this.supportsInfiniteScroll ? 'infinite' : 'limited'}
            ${this.supportsInfiniteScroll && this.state.isLastPage ? 'last-page' : ''}
            ${this.props.pivot ? 'pivot' : ''}
            ${this.props.hidden ? 'hidden' : ''}
            ${isEmpty ? 'empty' : ''}`}
        >
          <div ref={(r) => (this.tabulatorContainer = r)} className='react-autoql-tabulator-container'>
            {!!this.props.data && !!this.props.columns && (this.props.autoHeight || !this.state.firstRender) && (
              <>
                <TableWrapper
                  ref={(r) => (this.ref = r)}
                  height={this.initialTableHeight}
                  tableKey={`react-autoql-table-${this.TABLE_ID}`}
                  id={`react-autoql-table-${this.TABLE_ID}`}
                  key={`react-autoql-table-wrapper-${this.TABLE_ID}`}
                  data-test='autoql-tabulator-table'
                  columns={this.getFilteredTabulatorColumnDefinitions()}
                  data={this.props.data}
                  options={this.tableOptions}
                  hidden={this.props.hidden}
                  data-custom-attr='test-custom-attribute'
                  className='react-autoql-table'
                  onTableBuilt={this.onTableBuilt}
                  onCellClick={this.cellClick}
                  onDataSorting={this.onDataSorting}
                  onDataSorted={this.onDataSorted}
                  onDataFiltering={this.onDataFiltering}
                  onDataFiltered={this.onDataFiltered}
                  pivot={this.props.pivot}
                />
                {isEmpty && this.renderEmptyPlaceholderText()}
                {(this.state.pageLoading || !this.state.tabulatorMounted) && this.renderPageLoader()}
                {this.state.scrollLoading && this.renderScrollLoader()}
              </>
            )}
          </div>
          {this.renderDatePickerPopover()}
          {!isEmpty && this.renderTableRowCount()}
        </div>
      </ErrorBoundary>
    )
  }
}
