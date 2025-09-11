import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _cloneDeep from 'lodash.clonedeep'
import Autosuggest from 'react-autosuggest'
import SplitterLayout from 'react-splitter-layout'

import {
  runQuery,
  fetchAutocomplete,
  deepEqual,
  isChartType,
  REQUEST_CANCELLED_ERROR,
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAuthentication,
  getAutoQLConfig,
  CustomColumnTypes,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { VizToolbar } from '../../VizToolbar'
import { QueryOutput } from '../../QueryOutput'
import { OptionsToolbar } from '../../OptionsToolbar'
import LoadingDots from '../../LoadingDots/LoadingDots.js'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'

import './DashboardTile.scss'

let autoCompleteArray = []

export class DashboardTile extends React.Component {
  constructor(props) {
    super(props)
    this._isMounted = false
    this.dashboardTileTitleRef = undefined
    this.optionsToolbarRef = undefined
    this.secondOptionsToolbarRef = undefined
    this.COMPONENT_KEY = uuid()
    this.FIRST_QUERY_RESPONSE_KEY = uuid()
    this.SECOND_QUERY_RESPONSE_KEY = uuid()
    this.DEFAULT_AJAX_PAGE_SIZE = 50
    this.autoCompleteTimer = undefined
    this.debounceTime = 50
    this.paramsToSet = {}
    this.callbackArray = []

    const tile = props.tile

    // ----- Required for backwards compatibility after changing the agg types to enums ----
    const newAggConfig = {}
    tile?.aggConfig &&
      Object.keys(tile.aggConfig)?.forEach((column) => {
        if (tile.aggConfig?.[column]) {
          newAggConfig[column] = tile.aggConfig[column].toUpperCase()
        }
      })

    const newSecondAggConfig = {}
    tile?.secondAggConfig &&
      Object.keys(tile.secondAggConfig)?.forEach((column) => {
        if (tile.secondAggConfig?.[column]) {
          newSecondAggConfig[column] = tile.secondAggConfig[column].toUpperCase()
        }
      })

    props.setParamsForTile(
      {
        aggConfig: newAggConfig,
        secondAggConfig: newSecondAggConfig,
      },
      tile.i,
    )
    // -------------------------------------------------------------------------------------

    this.state = {
      tileIdx: tile.i,
      query: tile.query,
      secondQuery: tile.secondQuery || tile.query,
      title: tile.title,
      isTopExecuting: false,
      isBottomExecuting: false,
      suggestions: [],
      isSecondQueryInputOpen: false,
      isTitleOverFlow: false,
      isTopExecuted: !!tile.queryResponse,
      localRTFilterResponse: null,
      isBottomExecuted:
        tile.splitView && (this.areTopAndBottomSameQuery() ? !!tile.queryResponse : !!tile.secondQueryResponse),
      initialFormattedTableParams: {
        filters: tile?.tableFilters,
        sorters: tile?.orders,
        sessionFilters: tile?.filters,
      },
      initialSecondFormattedTableParams: {
        filters: tile?.secondTableFilters,
        sorters: tile?.secondOrders,
        sessionFilters: tile?.filters,
      },
    }
  }

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,

    tile: PropTypes.shape({}).isRequired,
    isEditing: PropTypes.bool,
    deleteTile: PropTypes.func,
    dataPageSize: PropTypes.number,
    queryResponse: PropTypes.shape({}),
    notExecutedText: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    onErrorCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    onPNGDownloadFinish: PropTypes.func,
    cancelQueriesOnUnmount: PropTypes.bool,
    setParamsForTile: PropTypes.func,
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    query: '',
    title: '',
    isEditing: false,
    dataPageSize: undefined,
    queryValidationSelections: undefined,
    defaultSelectedSuggestion: undefined,
    notExecutedText: 'Hit "Execute" to run this dashboard',
    autoChartAggregations: true,
    cancelQueriesOnUnmount: true,
    deleteTile: () => {},
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
    onCSVDownloadStart: () => {},
    onCSVDownloadProgress: () => {},
    onCSVDownloadFinish: () => {},
    onPNGDownloadFinish: () => {},
    onTouchStart: () => {},
    onTouchEnd: () => {},
    setParamsForTile: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (nextProps.isDragging && this.props.isDragging) {
      return false
    }

    const thisPropsFiltered = this.getFilteredProps(this.props)
    const nextPropsFiltered = this.getFilteredProps(nextProps)

    return !deepEqual(thisPropsFiltered, nextPropsFiltered) || !deepEqual(this.state, nextState)
  }

  onUpdateFilterResponse = (localRTFilterResponse) => {
    if (this._isMounted) {
      const filters = localRTFilterResponse?.data?.data?.fe_req?.filters

      // Update both state and formatted params
      this.setState({
        localRTFilterResponse,
        tableFilters: filters,
        initialFormattedTableParams: {
          ...this.state.initialFormattedTableParams,
          filters,
        },
      })
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (prevProps.tile !== this.props.tile) {
      this.setState({ isTitleOverFlow: this.isTitleOverFlow() })
    }

    // If query or title change from props (due to undo for example), update state
    if (this.props.tile?.title !== prevProps.tile?.title) {
      this.setState({ title: this.props.tile?.title })
    }
    if (this.props.tile?.query !== prevProps.tile?.query) {
      this.setState({ query: this.props.tile?.query })
    }
    if (this.props.tile?.secondQuery !== prevProps.tile?.secondQuery) {
      this.setState({ secondQuery: this.props.tile?.secondQuery })
    }
    if (
      this.responseRef?._isMounted &&
      this.props.tile?.displayType &&
      this.props.tile.displayType !== prevProps.tile?.displayType &&
      this.props.tile.displayType !== this.responseRef.state.displayType
    ) {
      this.responseRef.changeDisplayType(this.props.tile.displayType)
    }
  }

  componentWillUnmount = () => {
    try {
      this._isMounted = false

      clearTimeout(this.autoCompleteTimer)
      clearTimeout(this.dragEndTimeout)
      clearTimeout(this.setParamsForTileTimeout)
      clearTimeout(this.queryInputTimer)
      clearTimeout(this.secondQueryInputTimer)

      if (this.props.cancelQueriesOnUnmount) {
        this.cancelAllQueries()
      }
    } catch (error) {
      console.error(error)
    }
  }

  refreshLayout = () => {
    this.state.responseRef?.refreshLayout()
    this.state.secondResponseRef?.refreshLayout()
  }

  cancelAllQueries = () => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
    this.secondAxiosSource?.cancel(REQUEST_CANCELLED_ERROR)
  }

  debouncedSetParamsForTile = (params, callback) => {
    if (!this._isMounted) {
      clearTimeout(this.setParamsForTileTimeout)
      return
    }

    this.paramsToSet = {
      ...this.paramsToSet,
      ...params,
    }

    if (typeof callback === CustomColumnTypes.FUNCTION) {
      this.callbackArray = [...this.callbackArray, callback]
    }

    clearTimeout(this.setParamsForTileTimeout)
    this.setParamsForTileTimeout = setTimeout(() => {
      this.props.setParamsForTile(this.paramsToSet, this.props.tile.i, _cloneDeep(this.callbackArray))
      this.paramsToSet = {}
      this.callbackArray = []
    }, this.debounceTime)
  }

  getFilteredProps = (props) => {
    return {
      ...props,
      children: undefined,
      tileRef: undefined,
    }
  }

  isQueryValid = (query) => {
    return !!query && !!query.trim()
  }

  setTopExecuted = () => {
    if (this._isMounted) {
      this.setState({
        isTopExecuting: false,
        isTopExecuted: true,
      })
    }
  }

  endTopQuery = ({ response }) => {
    if (response?.data?.message !== REQUEST_CANCELLED_ERROR) {
      // Update component key after getting new response
      // so QueryOutput completely resets
      this.debouncedSetParamsForTile(
        {
          queryResponse: response,
          defaultSelectedSuggestion: undefined,
        },
        this.setTopExecuted,
      )
      return response
    } else {
      return Promise.reject(REQUEST_CANCELLED_ERROR)
    }
  }

  setBottomExecuted = () => {
    if (this._isMounted) {
      this.setState({
        isBottomExecuting: false,
        isBottomExecuted: true,
      })
    }
  }

  endBottomQuery = ({ response }) => {
    if (response?.data?.message !== REQUEST_CANCELLED_ERROR) {
      this.debouncedSetParamsForTile(
        {
          secondQueryResponse: response,
          secondDefaultSelectedSuggestion: undefined,
        },
        this.setBottomExecuted,
      )
      return response
    } else {
      return Promise.reject(REQUEST_CANCELLED_ERROR)
    }
  }

  processQuery = ({ query, userSelection, skipQueryValidation, source, isSecondHalf }) => {
    if (this.isQueryValid(query)) {
      let pageSize
      if (isSecondHalf && isChartType(this.props.tile.secondDisplayType)) {
        pageSize = this.props.tile.secondPageSize ?? this.props.dataPageSize
      } else if (isChartType(this.props.tile.displayType)) {
        pageSize = this.props.tile.pageSize ?? this.props.dataPageSize
      }

      const useSecondAxiosSource = isSecondHalf && !this.areTopAndBottomSameQuery()
      const additionalColumnSelects = isSecondHalf ? this.props.tile.secondColumnSelects : this.props.tile.columnSelects
      const currentDisplayOverrides = isSecondHalf
        ? this.props.tile?.secondDisplayOverrides
        : this.props.tile?.displayOverrides
      const currentSessionFilters = isSecondHalf ? this.props.tile.secondFilters : this.props.tile.filters
      const currentOrders = isSecondHalf ? this.props.tile.secondOrders : this.props.tile.orders
      const currentFilter = isSecondHalf ? this.props.tile.secondTableFilters : this.props.tile.tableFilters
      const cancelToken = useSecondAxiosSource ? this.secondAxiosSource?.token : this.axiosSource?.token

      const requestData = {
        ...getAuthentication(this.props.authentication),
        ...getAutoQLConfig(this.props.autoQLConfig),
        enableQueryValidation: !this.props.isEditing
          ? false
          : getAutoQLConfig(this.props.autoQLConfig).enableQueryValidation,
        skipQueryValidation: skipQueryValidation,
        newColumns: additionalColumnSelects,
        displayOverrides: currentDisplayOverrides,
        filters: currentSessionFilters,
        orders: currentOrders,
        tableFilters: currentFilter,
        // Hardcode this for now until we change the filter lock blacklist to a whitelist
        // mergeSources(this.props.source, source),
        source: 'dashboards.user',
        scope: 'dashboards',
        userSelection,
        cancelToken,
        pageSize,
        query,
      }
      return runQuery(requestData)
        .then((response) => {
          if (isSecondHalf) {
            this.bottomRequestData = requestData
          } else {
            this.topRequestData = requestData
          }
          return Promise.resolve(response)
        })
        .catch((error) => Promise.reject(error))
    }
    return Promise.reject()
  }

  processTileTop = ({ query, userSelection, skipQueryValidation, source, pageSize }) => {
    this.setState({ isTopExecuting: true, queryResponse: null })
    const queryChanged = this.props.tile.query !== query
    const skipValidation = skipQueryValidation || (this.props.tile.skipQueryValidation && !queryChanged)

    const queryValidationSelections =
      userSelection || (queryChanged ? undefined : this.props.tile?.queryValidationSelections)

    // New query is running, reset temporary state fields
    this.debouncedSetParamsForTile({
      query,
      dataConfig: queryChanged ? undefined : this.props.tile.dataConfig,
      skipQueryValidation: skipValidation,
      columns: queryChanged ? undefined : this.props.tile.columns,
      defaultSelectedSuggestion: undefined,
      queryValidationSelections,
      tableFilters: queryChanged ? undefined : this.props.tile.tableFilters,
    })

    return this.processQuery({
      query,
      userSelection: queryValidationSelections,
      skipQueryValidation: skipQueryValidation,
      source,
      pageSize,
      isSecondHalf: false,
    })
      .then((response) => {
        return this.endTopQuery({ response })
      })
      .catch((response) => {
        if (response?.data?.message === REQUEST_CANCELLED_ERROR) {
          return undefined
        }

        return this.endTopQuery({ response })
      })
  }

  processTileBottom = ({ query, userSelection, skipQueryValidation, source }) => {
    this.setState({
      isBottomExecuting: true,
      isSecondQueryInputOpen: false,
      secondQueryResponse: null,
    })

    const queryChanged = this.props.tile.secondQuery !== query
    const skipValidation = skipQueryValidation || (this.props.tile.secondskipQueryValidation && !queryChanged)

    const queryValidationSelections =
      userSelection || (queryChanged ? undefined : this.props.tile?.secondQueryValidationSelections)

    // New query is running, reset temporary state fields
    this.debouncedSetParamsForTile({
      secondQuery: query,
      secondDataConfig: queryChanged ? undefined : this.props.tile.secondDataConfig,
      secondskipQueryValidation: skipValidation,
      secondColumns: queryChanged ? undefined : this.props.tile.secondColumns,
      secondCustomColumns: queryChanged ? undefined : this.props.tile.secondCustomColumns,
      secondDefaultSelectedSuggestion: undefined,
      secondQueryValidationSelections: queryValidationSelections,
    })

    return this.processQuery({
      query,
      userSelection: queryValidationSelections,
      skipQueryValidation: skipQueryValidation,
      source,
      isSecondHalf: true,
    })
      .then((response) => this.endBottomQuery({ response }))
      .catch((response) => {
        if (response?.data?.message === REQUEST_CANCELLED_ERROR) {
          return undefined
        }

        return this.endBottomQuery({ response })
      })
  }

  clearTopQueryResponse = (newState = {}) => {
    this.setState({
      isTopExecuting: false,
      isTopExecuted: false,
      userSelection: undefined,
      ...newState,
    })

    this.debouncedSetParamsForTile({
      queryResponse: undefined,
    })
  }

  clearBottomQueryResponse = (newState = {}) => {
    this.setState({
      isBottomExecuted: false,
      isBottomExecuting: false,
      secondUserSelection: undefined,
      ...newState,
    })

    this.debouncedSetParamsForTile({
      secondQueryResponse: undefined,
    })
  }

  processTile = ({ query, secondQuery, skipQueryValidation, secondskipQueryValidation, source } = {}) => {
    // If tile is already processing, cancel current process
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
    this.secondAxiosSource?.cancel(REQUEST_CANCELLED_ERROR)

    // Create new cancel tokens for each query
    this.axiosSource = axios.CancelToken?.source()
    this.secondAxiosSource = axios.CancelToken.source()

    const q1 = query || this.props.tile.defaultSelectedSuggestion || this.state.query
    const q2 = secondQuery || this.props.tile.secondDefaultSelectedSuggestion || this.state.secondQuery

    const promises = []

    if (this.getIsSplitView() && q2 && q1 !== q2) {
      promises[1] = this.processTileBottom({
        query: q2,
        skipQueryValidation: secondskipQueryValidation,
        source,
      })
    }

    promises[0] = this.processTileTop({ query: q1, skipQueryValidation, source })

    return Promise.all(promises)
      .then((queryResponses) => {
        return {
          ...this.props.tile,
          queryResponse: queryResponses?.[0],
          secondQueryResponse: queryResponses?.[1],
          defaultSelectedSuggestion: undefined,
          secondDefaultSelectedSuggestion: undefined,
        }
      })
      .catch(() => {
        return Promise.reject()
      })
  }

  debounceQueryInputChange = (query) => {
    if (query === this.state.query) {
      return
    }

    const newState = { query, queryValidationSelections: undefined }
    this.clearTopQueryResponse(newState)

    clearTimeout(this.queryInputTimer)
    this.queryInputTimer = setTimeout(() => {
      this.debouncedSetParamsForTile({
        query,
        pageSize: undefined,
        aggConfig: undefined,
        dataConfig: undefined,
        queryValidationSelections: undefined,
      })
    }, 600)
  }

  debounceSecondQueryInputChange = (secondQuery) => {
    if (secondQuery === this.state.secondQuery) {
      return
    }

    const newState = { secondQuery }
    this.clearBottomQueryResponse(newState)

    clearTimeout(this.secondQueryInputTimer)
    this.secondQueryInputTimer = setTimeout(() => {
      this.debouncedSetParamsForTile({
        secondQuery,
        secondPageSize: undefined,
        secondAggConfig: undefined,
        secondDataConfig: undefined,
        secondQueryValidationSelections: undefined,
      })
    }, 600)
  }

  debounceTitleInputChange = (title) => {
    this.setState({ title })

    clearTimeout(this.titleInputTimer)
    this.titleInputTimer = setTimeout(() => {
      this.debouncedSetParamsForTile({ title })
    }, 600)
  }

  onQueryTextKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.value) {
      this.processTile({ query: e.target.value })
      e.target.blur()
    }
  }

  onSecondQueryTextKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.processTileBottom({ query: e.target.value })
      e.target.blur()
    }
  }

  onSuggestionClick = ({ query, userSelection, isButtonClick, source }) => {
    this.setState({ query })

    if (isButtonClick) {
      this.processTileTop({
        query,
        userSelection,
        skipQueryValidation: true,
        source,
      })
    } else {
      this.debouncedSetParamsForTile({ defaultSelectedSuggestion: query })
    }
  }

  onSecondSuggestionClick = ({ query, userSelection, isButtonClick, source }) => {
    this.setState({ secondQuery: query })

    if (isButtonClick) {
      this.debouncedSetParamsForTile({
        secondQuery: query,
        secondQueryValidationSelections: userSelection,
      })
      this.processTileBottom({
        query,
        userSelection,
        skipQueryValidation: true,
        source,
      })
    } else {
      this.debouncedSetParamsForTile({ secondQuery: query })
    }
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.autoCompleteTimer = setTimeout(() => {
      fetchAutocomplete({
        suggestion: value,
        ...getAuthentication(this.props.authentication),
      })
        .then((response) => {
          if (this._isMounted) {
            const body = response?.data?.data

            const sortingArray = []
            let suggestionsMatchArray = []
            autoCompleteArray = []
            suggestionsMatchArray = body.matches

            for (let i = 0; i < suggestionsMatchArray.length; i++) {
              sortingArray.push(suggestionsMatchArray[i])

              if (i === 4) {
                break
              }
            }

            sortingArray.sort((a, b) => b.length - a.length)
            for (let idx = 0; idx < sortingArray.length; idx++) {
              const anObject = {
                name: sortingArray[idx],
              }
              autoCompleteArray.push(anObject)
            }

            this.setState({
              suggestions: autoCompleteArray,
            })
          }
        })
        .catch((error) => {
          console.error(error)
        })
    }, 300)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  userSelectedSuggestionHandler = (userSelectedValueFromSuggestionBox) => {
    if (userSelectedValueFromSuggestionBox && userSelectedValueFromSuggestionBox.name && this._isMounted) {
      const newQuery = userSelectedValueFromSuggestionBox.name
      this.userSelectedValue = newQuery
      this.userSelectedSuggestion = true
      this.setState({ query: newQuery })
      this.debouncedSetParamsForTile({ query: newQuery })
    }
  }

  onQueryInputChange = (e) => {
    // If input change we want to start validating the new queries again
    if (this.props.tile.skipQueryValidation) {
      this.debouncedSetParamsForTile({ skipQueryValidation: false })
    }

    if (this.userSelectedSuggestion && (e.keyCode === 38 || e.keyCode === 40)) {
      // keyup or keydown
      return // return to let the component handle it...
    }

    if (e?.target?.value || e?.target?.value === '') {
      this.debounceQueryInputChange(e.target.value)
    } else {
      // User clicked on autosuggest item
      this.processTile({ query: this.userSelectedValue })
    }
  }

  onSecondQueryInputChange = (e) => {
    this.setState({ secondQuery: e.target.value })
    this.debouncedSetParamsForTile({ secondSkipQueryValidation: false })
  }

  getIsSplitView = () => this.props.tile?.splitView

  toggleSecondQueryInput = () => {
    this.setState({
      isSecondQueryInputOpen: !this.state.isSecondQueryInputOpen,
    })
  }

  isTitleOverFlow = () => {
    const dashboardTileTitleElement = this.dashboardTileTitleRef
    if (dashboardTileTitleElement) {
      const elemWidth = dashboardTileTitleElement.getBoundingClientRect().width
      const parentWidth = dashboardTileTitleElement.parentElement.getBoundingClientRect().width
      return elemWidth > parentWidth
    }
    return false
  }

  onQueryValidationSelectOption = (queryText, selections) => {
    this.setState({ query: queryText })
    this.debouncedSetParamsForTile({
      query: queryText,
      queryValidationSelections: selections,
    })
  }

  onSecondQueryValidationSelectOption = (queryText, selections) => {
    this.setState({ secondQuery: queryText })
    this.debouncedSetParamsForTile({
      secondQuery: queryText,
      secondqueryValidationSelections: selections,
    })
  }

  onPageSizeChange = (pageSize, newRows = []) => {
    const queryResponse = this.props.tile?.queryResponse?.data?.data?.rows
      ? _cloneDeep(this.props.tile.queryResponse)
      : undefined

    queryResponse.data.data.rows = newRows

    this.debouncedSetParamsForTile({ pageSize, queryResponse })
  }

  onSecondPageSizeChange = (secondPageSize, newRows = []) => {
    let secondQueryResponse = this.props.tile?.secondQueryResponse?.data?.data?.rows
      ? _cloneDeep(this.props.tile.secondQueryResponse)
      : undefined

    const q1 = this.props.tile.defaultSelectedSuggestion || this.state.query
    const q2 = this.props.tile.secondDefaultSelectedSuggestion || this.state.secondQuery
    if (this.getIsSplitView() && q2 && q1 === q2) {
      secondQueryResponse = this.props.tile.queryResponse
    }
    secondQueryResponse.data.data.rows = newRows

    this.debouncedSetParamsForTile({ secondPageSize, secondQueryResponse })
  }

  onAggConfigChange = (aggConfig) => this.debouncedSetParamsForTile({ aggConfig })
  onDataConfigChange = (dataConfig) => this.debouncedSetParamsForTile({ dataConfig })
  onDisplayTypeChange = (displayType) => this.debouncedSetParamsForTile({ displayType })
  onBucketSizeChange = (bucketSize) => this.debouncedSetParamsForTile({ bucketSize })

  onTableParamsChange = (params, formattedParams) => {
    this.debouncedSetParamsForTile({
      tableFilters: formattedParams.filters,
      orders: formattedParams.sorters,
    })
  }

  onSecondTableParamsChange = (params, formattedParams) => {
    this.debouncedSetParamsForTile({
      secondTableFilters: formattedParams.filters,
      secondOrders: formattedParams.sorters,
    })
  }

  onColumnChange = (displayOverrides, columns, columnSelects, queryResponse, dataConfig, filters) => {
    this.debouncedSetParamsForTile({
      columnSelects,
      queryResponse,
      dataConfig,
      displayOverrides,
      filters,
    })
  }

  onSecondAggConfigChange = (secondAggConfig) => this.debouncedSetParamsForTile({ secondAggConfig })
  onSecondDataConfigChange = (secondDataConfig) => this.debouncedSetParamsForTile({ secondDataConfig })
  onSecondDisplayTypeChange = (secondDisplayType) => this.debouncedSetParamsForTile({ secondDisplayType })
  onSecondBucketSizeChange = (secondBucketSize) => this.debouncedSetParamsForTile({ secondBucketSize })
  onSecondCustomColumnUpdate = (secondCustomColumns) => this.debouncedSetParamsForTile({ secondCustomColumns })

  onSecondColumnChange = (
    secondDisplayOverrides,
    secondColumns,
    secondColumnSelects,
    secondQueryResponse,
    secondDataConfig,
    secondTableFilters,
    secondOrders,
    secondFilters,
  ) => {
    this.debouncedSetParamsForTile({
      secondDisplayOverrides,
      secondColumnSelects,
      secondQueryResponse,
      secondDataConfig,
      secondTableFilters,
      secondTableFilters,
      secondFilters,
    })
  }

  reportProblemCallback = () => {
    if (this.optionsToolbarRef?._isMounted) {
      this.optionsToolbarRef?.openReportProblemModal()
    }
  }

  secondReportProblemCallback = () => {
    if (this.secondOptionsToolbarRef?._isMounted) {
      this.secondOptionsToolbarRef.openReportProblemModal()
    }
  }

  onSplitViewClick = () => {
    const splitView = !this.props.tile?.splitView
    let secondQuery = this.props.tile?.secondQuery

    if (splitView && !secondQuery) {
      secondQuery = this.state.query
    }

    this.debouncedSetParamsForTile({ splitView, secondQuery })
  }

  renderSplitResponse = () => {
    return (
      <SplitterLayout
        key={`dashboard-tile-splitter-layout-${this.COMPONENT_KEY}`}
        vertical={true}
        percentage={true}
        primaryMinSize={30}
        secondaryMinSize={30}
        secondaryInitialSize={this.props.secondDisplayPercentage || 50}
        onDragStart={() => {
          this.setState({ isDraggingSplitter: true })
        }}
        onDragEnd={() => {
          this.dragEndTimeout = setTimeout(() => {
            const percentString = this.tileInnerDiv?.style?.height ?? ''
            const percentNumber = Number(percentString.substring(0, percentString.length - 1))

            if (!isNaN(percentNumber)) {
              this.debouncedSetParamsForTile({
                secondDisplayPercentage: percentNumber,
              })
            }

            this.setState({ isDraggingSplitter: false })
          }, 1000)
        }}
      >
        <div className='dashboard-tile-split-pane-container'>{this.renderTopResponse()}</div>
        <div className='dashboard-tile-split-pane-container'>
          {this.renderBottomResponse()}
          {this.props.isEditing && (
            <div
              className={`split-view-query-btn-container react-autoql-toolbar ${
                this.state.isSecondQueryInputOpen ? 'open' : ''
              }`}
            >
              <div
                className='react-autoql-toolbar viz-toolbar split-view-btn split-view-query-btn react-autoql-toolbar-btn'
                data-test='split-view-query-btn'
              >
                <Button
                  onClick={() => this.toggleSecondQueryInput()}
                  className='react-autoql-toolbar-btn'
                  tooltip='Query'
                  tooltipID={this.props.tooltipID}
                >
                  <div className='split-view-query-btn-icon-container'>
                    <Icon type='react-autoql-bubbles-outlined' />
                    <Icon type={this.state.isSecondQueryInputOpen ? 'caret-left' : 'caret-right'} />
                  </div>
                </Button>
                <input
                  className={'dashboard-tile-input query second'}
                  value={this.state.secondQuery}
                  spellCheck={false}
                  onChange={this.onSecondQueryInputChange}
                  onKeyDown={this.onSecondQueryTextKeyDown}
                  placeholder={this.props.tile.query || 'Type a query'}
                />
              </div>
            </div>
          )}
        </div>
      </SplitterLayout>
    )
  }

  renderHeader = () => {
    if (this.props.isEditing) {
      return (
        <div className='dashboard-tile-edit-wrapper'>
          <div
            className={`dashboard-tile-input-container
            ${this.state.isQueryInputFocused ? 'query-focused' : ''}
            ${this.state.isTitleInputFocused ? 'title-focused' : ''}`}
          >
            <div className='dashboard-tile-left-input-container'>
              <Icon
                className='query-input-icon'
                type='react-autoql-bubbles-outlined'
                tooltip='Query'
                tooltipID={this.props.tooltipID}
              />
              {getAutoQLConfig(this.props.autoQLConfig).enableAutocomplete ? (
                <Autosuggest
                  onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                  onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                  getSuggestionValue={this.userSelectedSuggestionHandler}
                  suggestions={this.state.suggestions}
                  ref={(ref) => {
                    this.autoSuggest = ref
                  }}
                  renderSuggestion={(suggestion) => {
                    return <>{suggestion.name}</>
                  }}
                  inputProps={{
                    className: 'dashboard-tile-autocomplete-input',
                    placeholder: 'Type a query in your own words',
                    value: this.state.query,
                    onFocus: (e) => {
                      e.stopPropagation()
                      this.setState({ isQueryInputFocused: true })
                    },
                    onChange: this.onQueryInputChange,
                    onKeyDown: this.onQueryTextKeyDown,
                    onBlur: () => this.setState({ isQueryInputFocused: false }),
                  }}
                />
              ) : (
                <input
                  className='dashboard-tile-input query'
                  placeholder='Type a query in your own words'
                  value={this.state.query}
                  data-tooltip-content='Query'
                  data-tooltip-id={this.props.tooltipID}
                  data-place='bottom'
                  spellCheck={false}
                  onChange={this.onQueryInputChange}
                  onKeyDown={this.onQueryTextKeyDown}
                  onFocus={() => this.setState({ isQueryInputFocused: true })}
                  onBlur={() => this.setState({ isQueryInputFocused: false })}
                />
              )}
            </div>

            <div className='dashboard-tile-right-input-container'>
              <Icon className='title-input-icon' type='title' tooltip='Title' tooltipID={this.props.tooltipID} />
              <input
                className='dashboard-tile-input title'
                placeholder='Add descriptive title (optional)'
                value={this.state.title}
                onChange={(e) => this.debounceTitleInputChange(e.target.value)}
                onFocus={() => this.setState({ isTitleInputFocused: true })}
                onBlur={() => this.setState({ isTitleInputFocused: false })}
              />
            </div>
          </div>
          <div className={`dashboard-tile-play-button${!this.isQueryValid(this.state.query) ? ' disabled' : ''}`}>
            <Icon type='play' onClick={() => this.processTile()} data-tooltip-content='Run tile' data-place='left' />
          </div>
        </div>
      )
    }

    return (
      <div className='dashboard-tile-title-container'>
        <span
          ref={(r) => (this.dashboardTileTitleRef = r)}
          className='dashboard-tile-title'
          id={`dashboard-tile-title-${this.COMPONENT_KEY}`}
          data-tooltip-content={
            this.state.isTitleOverFlow ? this.props.tile.title || this.props.tile.query || 'Untitled' : null
          }
          data-tooltip-id='react-autoql-dashboard-tile-title-tooltip'
        >
          {this.props.tile.title || this.props.tile.query || 'Untitled'}
        </span>
        <div className='dashboard-tile-title-divider'></div>
      </div>
    )
  }

  renderContentPlaceholder = ({ isExecuting, isExecuted } = {}) => {
    if (isExecuting) {
      // This should always take priority over the other conditions below
      return (
        <div className='loading-container-centered'>
          <LoadingDots />
        </div>
      )
    }

    if (!this.state.query?.trim()) {
      return (
        <div className='loading-container-centered'>
          <div className='dashboard-tile-placeholder-text'>
            {this.props.isEditing ? (
              <span>
                To get started, enter a query and click <Icon className='play-icon' type='play' />
              </span>
            ) : (
              <span>No query was supplied for this tile.</span>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className='loading-container-centered'>
        <div className='dashboard-tile-placeholder-text'>
          {this.props.isEditing ? (
            <span>
              Hit <Icon className='edit-mode-placeholder-icon' type='play' /> to run this tile
            </span>
          ) : (
            <span>{this.props.notExecutedText}</span>
          )}
        </div>
      </div>
    )
  }

  renderSplitViewBtn = () => {
    return (
      <div className='viz-toolbar react-autoql-toolbar split-view-btn' data-test='split-view-btn'>
        <Button
          onClick={this.onSplitViewClick}
          className={`react-autoql-toolbar-btn ${this.getIsSplitView() ? 'active' : ''}`}
          tooltip={this.props.tile.splitView ? 'Split View On' : 'Split View Off'}
          tooltipID={this.props.tooltipID}
          data-test='viz-toolbar-button'
        >
          <Icon type='split-view' />
        </Button>
      </div>
    )
  }

  onCSVDownloadStart = (params) =>
    this.props.onCSVDownloadStart({
      ...params,
      tileId: this.props.tile.i,
    })

  onCSVDownloadProgress = (params) =>
    this.props.onCSVDownloadProgress({
      ...params,
      tileId: this.props.tile.i,
    })

  onCSVDownloadFinish = (params) =>
    this.props.onCSVDownloadFinish({
      ...params,
      tileId: this.props.tile.i,
    })

  onPNGDownloadFinish = () => this.props.onPNGDownloadFinish({ tileId: this.props.tile.i })

  onDrilldownStart = (activeKey) =>
    this.props.onDrilldownStart({
      tileId: this.props.tile.i,
      isSecondHalf: false,
      activeKey,
      queryOutputRef: this.state.responseRef,
    })

  renderToolbars = ({ queryOutputProps, vizToolbarProps, optionsToolbarProps, isSecondHalf }) => {
    return (
      <div className='dashboard-tile-toolbars-container'>
        <div className='dashboard-tile-toolbars-left-container'>
          {this.props.isEditing && (isSecondHalf || !this.getIsSplitView()) && this.renderSplitViewBtn()}
          {this.props.isEditing && (
            <VizToolbar {...vizToolbarProps} shouldRender={!this.props.isDragging} tooltipID={this.props.tooltipID} />
          )}
        </div>
        <div className='dashboard-tile-toolbars-right-container'>
          <OptionsToolbar
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            onErrorCallback={this.props.onErrorCallback}
            onSuccessAlert={this.props.onSuccessCallback}
            onCSVDownloadStart={this.onCSVDownloadStart}
            onCSVDownloadProgress={this.onCSVDownloadProgress}
            onCSVDownloadFinish={this.onCSVDownloadFinish}
            onPNGDownloadFinish={this.onPNGDownloadFinish}
            shouldRender={!this.props.isDragging}
            tooltipID={this.props.tooltipID}
            popoverPositions={['top', 'left', 'bottom', 'right']}
            customOptions={this.props.customToolbarOptions}
            popoverAlign='end'
            {...optionsToolbarProps}
          />
        </div>
      </div>
    )
  }

  renderResponseContent = ({ queryOutputProps, isExecuting, isExecuted, renderPlaceholder }) => {
    if (renderPlaceholder) {
      return this.renderContentPlaceholder({
        isExecuting,
        isExecuted,
      })
    }

    return (
      <QueryOutput
        authentication={this.props.authentication}
        autoQLConfig={this.props.autoQLConfig}
        dataFormatting={this.props.dataFormatting}
        renderTooltips={false}
        autoSelectQueryValidationSuggestion={false}
        autoChartAggregations={this.props.autoChartAggregations}
        isResizing={this.props.isDragging || this.state.isDraggingSplitter}
        renderSuggestionsAsDropdown={this.props.tile.h < 4}
        enableDynamicCharting={this.props.enableDynamicCharting}
        backgroundColor={document.documentElement.style.getPropertyValue('--react-autoql-background-color-secondary')}
        showQueryInterpretation={this.props.isEditing}
        reverseTranslationPlacement='bottom'
        tooltipID={this.props.tooltipID}
        chartTooltipID={this.props.chartTooltipID}
        shouldRender={!this.props.isDragging}
        allowColumnAddition={this.props.isEditing}
        enableTableContextMenu={this.props.isEditing}
        source='dashboards.user'
        scope='dashboards'
        autoHeight={false}
        height='100%'
        width='100%'
        onUpdateFilterResponse={this.onUpdateFilterResponse}
        localRTFilterResponse={this.state.localRTFilterResponse}
        enableCustomColumns={this.props.enableCustomColumns}
        preferRegularTableInitialDisplayType={this.props.preferRegularTableInitialDisplayType}
        {...queryOutputProps}
      />
    )
  }

  renderResponse = ({
    queryOutputProps = {},
    vizToolbarProps = {},
    optionsToolbarProps = {},
    isSecondHalf,
    isExecuting,
    isExecuted,
    renderPlaceholder,
  }) => {
    return (
      <div className='loading-container-centered' id={queryOutputProps.key}>
        {this.renderResponseContent({
          queryOutputProps,
          isExecuting,
          isExecuted,
          renderPlaceholder,
          isSecondHalf,
        })}
        {this.renderToolbars({
          queryOutputProps,
          vizToolbarProps,
          optionsToolbarProps,
          isSecondHalf,
        })}
      </div>
    )
  }

  renderTopResponse = () => {
    const isExecuting = this.state.isTopExecuting
    const isExecuted = this.state.isTopExecuted

    const renderPlaceholder = !this.props.tile?.queryResponse || isExecuting || !isExecuted

    const initialDisplayType = this.props?.tile?.displayType

    return this.renderResponse({
      renderPlaceholder,
      isExecuting,
      isExecuted,
      queryOutputProps: {
        ref: (ref) => ref && ref !== this.state.responseRef && this._isMounted && this.setState({ responseRef: ref }),
        optionsToolbarRef: this.optionsToolbarRef,
        vizToolbarRef: this.vizToolbarRef,
        key: `dashboard-tile-query-top-${this.FIRST_QUERY_RESPONSE_KEY}${this.props.isEditing ? '-editing' : ''}`,
        initialDisplayType,
        queryResponse: this.props.tile?.queryResponse,
        initialTableConfigs: this.props.tile.dataConfig,
        initialAggConfig: this.props.tile.aggConfig,
        onTableConfigChange: this.onDataConfigChange,
        onTableParamsChange: this.onTableParamsChange,
        onAggConfigChange: this.onAggConfigChange,
        onColumnChange: this.onColumnChange,
        queryValidationSelections: this.props.tile.queryValidationSelections,
        onSuggestionClick: this.onSuggestionClick,
        defaultSelectedSuggestion: this.props.tile?.defaultSelectedSuggestion,
        onNoneOfTheseClick: this.onNoneOfTheseClick,
        onDrilldownStart: this.onDrilldownStart,
        onDrilldownEnd: this.props.onDrilldownEnd,
        onQueryValidationSelectOption: this.onQueryValidationSelectOption,
        reportProblemCallback: this.reportProblemCallback,
        queryRequestData: this.topRequestData,
        onDisplayTypeChange: this.onDisplayTypeChange,
        dataPageSize: this.props.tile.pageSize,
        onPageSizeChange: this.onPageSizeChange,
        onBucketSizeChange: this.onBucketSizeChange,
        bucketSize: this.props.tile.bucketSize,
        initialFormattedTableParams: this.state.initialFormattedTableParams,
      },
      vizToolbarProps: {
        ref: (r) => (this.vizToolbarRef = r),
        responseRef: this.state.responseRef,
        key: `dashboard-tile-viz-toolbar-${this.FIRST_QUERY_RESPONSE_KEY}${this.props.isEditing ? '-editing' : ''}`,
      },
      optionsToolbarProps: {
        ref: (r) => (this.optionsToolbarRef = r),
        responseRef: this.state.responseRef,
        key: `dashboard-tile-options-toolbar-${this.FIRST_QUERY_RESPONSE_KEY}${this.props.isEditing ? '-editing' : ''}`,
      },
    })
  }

  areTopAndBottomSameQuery = () => {
    const topQuery = this.props?.tile?.query
    const bottomQuery = this.props?.tile?.secondQuery
    const isQuerySame = !bottomQuery || topQuery === bottomQuery
    return isQuerySame
  }

  renderBottomResponse = () => {
    const isQuerySameAsTop = this.areTopAndBottomSameQuery()
    let isExecuting = this.state.isBottomExecuting
    let isExecuted = this.state.isBottomExecuted
    let queryRequestData = this.bottomRequestData

    if (isQuerySameAsTop) {
      isExecuting = this.state.isTopExecuting
      isExecuted = this.state.isTopExecuted
      queryRequestData = this.topRequestData
    }

    const renderPlaceholder =
      (!isQuerySameAsTop && !this.props.tile?.secondQueryResponse) ||
      (isQuerySameAsTop && !this.props.tile?.queryResponse) ||
      isExecuting ||
      !isExecuted

    const initialDisplayType = this.props?.tile?.secondDisplayType

    return this.renderResponse({
      renderPlaceholder,
      isExecuting,
      isExecuted,
      queryOutputProps: {
        key: `dashboard-tile-query-bottom-${this.SECOND_QUERY_RESPONSE_KEY}${this.props.isEditing ? '-editing' : ''}`,
        ref: (ref) =>
          ref && ref !== this.state.secondResponseRef && this._isMounted && this.setState({ secondResponseRef: ref }),
        optionsToolbarRef: this.secondOptionsToolbarRef,
        vizToolbarRef: this.secondVizToolbarRef,
        initialDisplayType,
        queryResponse: this.props.tile?.secondQueryResponse || this.props.tile?.queryResponse,
        initialTableConfigs: this.props.tile.secondDataConfig,
        initialAggConfig: this.props.tile.secondAggConfig,
        onTableConfigChange: this.onSecondDataConfigChange,
        onTableParamsChange: this.onSecondTableParamsChange,
        onAggConfigChange: this.onSecondAggConfigChange,
        queryValidationSelections: this.props.tile.secondQueryValidationSelections,
        onSuggestionClick: this.onSecondSuggestionClick,
        defaultSelectedSuggestion: this.props.tile?.secondDefaultSelectedSuggestion,
        reportProblemCallback: this.secondReportProblemCallback,
        onNoneOfTheseClick: this.secondOnNoneOfTheseClick,
        onDrilldownStart: (activeKey) => {
          this.props.onDrilldownStart({
            tileId: this.props.tile.i,
            isSecondHalf: true,
            activeKey,
            queryOutputRef: this.state.secondResponseRef,
          })
        },
        onDrilldownEnd: this.props.onDrilldownEnd,
        onQueryValidationSelectOption: this.onSecondQueryValidationSelectOption,
        queryRequestData,
        onDisplayTypeChange: this.onSecondDisplayTypeChange,
        dataPageSize: this.props.tile.secondPageSize,
        onPageSizeChange: this.onSecondPageSizeChange,
        onBucketSizeChange: this.onSecondBucketSizeChange,
        onColumnChange: this.onSecondColumnChange,
        bucketSize: this.props.tile.secondBucketSize,
        initialFormattedTableParams: {
          filters: this.props.tile?.secondTableFilters,
          sorters: this.props.tile?.secondOrders,
          sessionFilters: this.props.tile?.secondFilters,
        },
      },
      vizToolbarProps: {
        ref: (r) => (this.secondVizToolbarRef = r),
        responseRef: this.state.secondResponseRef,
        key: `dashboard-tile-viz-toolbar-${this.SECOND_QUERY_RESPONSE_KEY}${this.props.isEditing ? '-editing' : ''}`,
      },
      optionsToolbarProps: {
        ref: (r) => (this.secondOptionsToolbarRef = r),
        responseRef: this.state.secondResponseRef,
        key: `dashboard-tile-options-toolbar-${this.SECOND_QUERY_RESPONSE_KEY}${
          this.props.isEditing ? '-editing' : ''
        }`,
      },
      isSecondHalf: true,
    })
  }

  renderContent = () => {
    return (
      <div
        className={`dashboard-tile-response-wrapper
      ${this.props.isEditing ? ' editing' : ''}
      ${this.props.tile.h < 4 ? ' small' : ''}`}
      >
        <div className='dashboard-tile-response-container'>
          {this.getIsSplitView() ? this.renderSplitResponse() : this.renderTopResponse()}
        </div>
      </div>
    )
  }

  renderDragHandle = (props, placement) => {
    return <div {...props} className={`react-autoql-dashboard-tile-drag-handle ${placement}`} />
  }

  renderDragHandles = () => {
    const propsToPassToDragHandle = {
      onMouseDown: (e) => {
        e.stopPropagation()
        return this.props.onMouseDown(e)
      },
      onMouseUp: (e) => {
        e.stopPropagation()
        return this.props.onMouseUp(e)
      },
      onTouchStart: (e) => {
        e.stopPropagation()
        return this.props.onTouchStart(e)
      },
      onTouchEnd: (e) => {
        e.stopPropagation()
        return this.props.onTouchEnd(e)
      },
    }

    return (
      <>
        {this.renderDragHandle(propsToPassToDragHandle, 'top')}
        {this.renderDragHandle(propsToPassToDragHandle, 'bottom')}
        {this.renderDragHandle(propsToPassToDragHandle, 'left')}
        {this.renderDragHandle(propsToPassToDragHandle, 'right')}
      </>
    )
  }

  renderDeleteBtn = () => {
    return (
      <div className='dashboard-tile-delete-button' onClick={() => this.props.deleteTile(this.props.tile.i)}>
        <Icon style={{ fontSize: '18px' }} type='close' />
      </div>
    )
  }

  render = () => {
    const style = {}
    if (this.props.isDragging) {
      style.pointerEvents = 'none'
    }

    return (
      <ErrorBoundary>
        <div
          ref={(r) => (this.ref = r)}
          className={this.props.className}
          style={{ ...this.props.style }}
          data-grid={this.props.tile}
          data-test='react-autoql-dashboard-tile'
        >
          {this.props.children}
          <div
            id={`react-autoql-dashboard-tile-inner-div-${this.COMPONENT_KEY}`}
            ref={(r) => (this.tileInnerDiv = r)}
            className={`react-autoql-dashboard-tile-inner-div
              ${this.getIsSplitView() ? 'split' : ''}`}
            style={style}
          >
            <>
              {this.renderHeader()}
              {this.renderContent()}
            </>
          </div>
          {this.props.isEditing && this.renderDragHandles()}
          {this.props.isEditing && this.renderDeleteBtn()}
        </div>
      </ErrorBoundary>
    )
  }
}

// React-Grid-Layout needs the forwarded original ref
// we can forward our own ref down to DashboardTile as a prop
export default React.forwardRef(({ style, className, key, ...props }, ref) => (
  <div style={{ ...style }} className={className} ref={ref}>
    <DashboardTile
      {...props}
      rglRef={ref}
      ref={props.tileRef}
      className={`${props.innerDivClass} ${props.isEditing ? 'editing' : ''}`}
    />
  </div>
))
