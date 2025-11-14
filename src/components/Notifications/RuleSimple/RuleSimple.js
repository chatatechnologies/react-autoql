import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import parseNum from 'parse-num'
import axios from 'axios'
import dayjs from '../../../js/dayjsWithPlugins'
import {
  fetchAutocomplete,
  runQueryOnly,
  ColumnTypes,
  COMPARE_TYPE,
  DATA_ALERT_OPERATORS,
  EXISTS_TYPE,
  NUMBER_TERM_TYPE,
  QUERY_TERM_TYPE,
  isNumber,
  isListQuery,
  isSingleValueResponse,
  constructRTArray,
  getTimeFrameTextFromChunk,
  getSupportedConditionTypes,
  REQUEST_CANCELLED_ERROR,
  isISODate,
  authenticationDefault,
  getAuthentication,
  getAutoQLConfig,
  dataFormattingDefault,
  getColumnTypeAmounts,
  getGroupableColumns,
  getStringColumnIndices,
  getNumberOfGroupables,
  isColumnNumberType,
  DATA_ALERT_CONDITION_TYPES,
  SCHEDULED_TYPE,
  getDefaultJoinColumnAndDisplayNameAndJoinColumnsIndices,
  getQuerySelectableJoinColumns,
  fetchFilters,
  normalizeString,
} from 'autoql-fe-utils'
import LoadingDots from '../../LoadingDots/LoadingDots'
import JoinColumnSelectionTable from '../JoinColumnSelectionTable/JoinColumnSelectionTable'
import { Icon } from '../../Icon'
import { Chip } from '../../Chip'
import { Input } from '../../Input'
import { Select } from '../../Select'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ReverseTranslation } from '../../ReverseTranslation'
import { SelectableTable } from '../../SelectableTable/'
import { authenticationType, dataFormattingType } from '../../../props/types'
import { CustomList } from '../CustomList'
import './RuleSimple.scss'
const SELF_COMPARISONS_TYPE = 'selfComparisons'

const CONDITION_TYPE_LABELS = {
  EXISTS: (
    <span>
      receives <strong>new rows</strong> of data.
    </span>
  ),
  COMPARE: (
    <span>
      contains data that meets the following <strong>conditions:</strong>
    </span>
  ),
}

const CONDITION_TYPE_LABELS_SCHEDULED = {
  EXISTS: (
    <span>
      with the result of <strong>this query:</strong>
    </span>
  ),
  COMPARE: (
    <span>
      based on the following <strong>conditions:</strong>
    </span>
  ),
}

export default class RuleSimple extends React.Component {
  autoCompleteTimer = undefined

  constructor(props) {
    super(props)
    this.secondFieldSelectionGridRef = React.createRef()
    const { initialData, queryResponse } = props

    this.TERM_ID_1 = uuid()
    this.TERM_ID_2 = uuid()

    this.SUPPORTED_CONDITION_TYPES = getSupportedConditionTypes(initialData, queryResponse)
    this.SUPPORTED_OPERATORS = []

    if (
      this.SUPPORTED_CONDITION_TYPES.includes(COMPARE_TYPE) ||
      Object.keys(DATA_ALERT_OPERATORS).includes(initialData?.[0]?.condition)
    ) {
      this.SUPPORTED_OPERATORS = Object.keys(DATA_ALERT_OPERATORS)
    }

    let selectedOperator = this.getInitialSelectedOperator()
    if (
      props.dataAlertTypes === EXISTS_TYPE ||
      (isListQuery(queryResponse?.data?.data?.columns) && this.SUPPORTED_CONDITION_TYPES.includes(EXISTS_TYPE))
    ) {
      selectedOperator = EXISTS_TYPE
    }

    let secondTermMultiplicationFactorType = 'multiply-percent-higher'
    let secondTermMultiplicationFactorValue = '0'

    if (initialData?.[1]?.result_adjustment) {
      let type = initialData[1].result_adjustment.operation
      let value = initialData[1].result_adjustment.value

      if (type === 'multiply' && value.includes('%')) {
        value = value.replace(/%/g, '')
        if (value > 100) {
          type = 'multiply-percent-higher'
          value = `${value - 100}`
        } else if (value < 100) {
          type = 'multiply-percent-lower'
          value = `${100 - value}`
        }
      }

      secondTermMultiplicationFactorType = type
      secondTermMultiplicationFactorValue = value
    }
    if (initialData?.[0]?.result_adjustment) {
      let type = initialData[0].result_adjustment.operation
      let value = initialData[0].result_adjustment.value

      if (type === 'multiply' && value.includes('%')) {
        value = value.replace(/%/g, '')
        if (value > 100) {
          type = 'multiply-percent-higher'
          value = `${value - 100}`
        } else if (value < 100) {
          type = 'multiply-percent-lower'
          value = `${100 - value}`
        }
      }

      secondTermMultiplicationFactorType = type
      secondTermMultiplicationFactorValue = value
    }

    const state = {
      storedInitialData: props.initialData,
      columnSelectionType: 'any-column',
      selectedOperator: initialData[0]?.condition ?? selectedOperator,
      selectedConditionType:
        (initialData[0]?.condtion ?? selectedOperator) === EXISTS_TYPE ? EXISTS_TYPE : COMPARE_TYPE,

      inputValue: queryResponse?.data?.data?.text ?? '',
      secondInputValue: '',
      secondTermType: NUMBER_TERM_TYPE,
      columnSelectValue: props.initialData?.[0]?.self_compare_columns?.[1] || '',
      secondQueryValidating: false,
      secondQueryValidated: false,
      secondQueryInvalid: false,
      secondQueryError: '',
      isEditingQuery: false,
      queryFilters: this.getFilters(props),
      secondQueryResponse: {},
      isSecondQueryListQuery: true,
      firstQuerySelectedColumns: [],
      firstQueryGroupableColumnIndex: 0,
      secondQuerySelectedColumns: [],
      secondQueryGroupableColumnIndex: 0,
      secondQueryAmountOfNumberColumns: 0,
      secondQueryAllColumnsAmount: 0,
      secondQueryGroupableColumnsAmount: 0,
      secondTermMultiplicationFactorType,
      secondTermMultiplicationFactorValue,
      firstQueryResult: props.queryResponse ? props.queryResponse : null,
      secondQueryResult: null,
      isLoadingFirstQuery: false,
      isLoadingSecondQuery: false,
      showJoinColumnSelection: false,
      firstQueryFirstValue: '',
      firstQuerySecondValue: '',
      secondQueryFirstValue: '',
      secondQuerySecondValue: '',
      isDisabledCustomList: true,
      disabledReason: '',
    }

    if (initialData?.length) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData.length > 1 ? initialData[1].id : uuid()
      state.selectedConditionType = state.selectedOperator === EXISTS_TYPE ? EXISTS_TYPE : COMPARE_TYPE
      state.inputValue = initialData[0].term_value ?? ''
      state.secondInputValue = initialData[1]?.term_value ?? ''
      state.secondTermType = initialData[1]?.term_type?.toUpperCase() ?? NUMBER_TERM_TYPE
      if (
        initialData[0]?.self_compare_columns?.length !== 0 &&
        initialData[0]?.self_compare_columns?.length !== undefined
      ) {
        state.secondTermType = SELF_COMPARISONS_TYPE
      }
      state.secondQueryValidated = true
    }

    this.state = state
  }

  static propTypes = {
    authentication: authenticationType,
    ruleId: PropTypes.string,
    onUpdate: PropTypes.func,
    initialData: PropTypes.arrayOf(PropTypes.shape({})),
    queryResponse: PropTypes.shape({}),
    onLastInputEnterPress: PropTypes.func,
    dataFormatting: dataFormattingType,
    isCompositeAlert: PropTypes.bool,
    onCustomFiltersChange: PropTypes.func,
    customFilters: PropTypes.array,
    baseDataAlertColumns: PropTypes.array,
    baseDataAlertQueryResponse: PropTypes.object,
    isLoadingBaseDataAlertQueryResponse: PropTypes.bool,
    isPreviewMode: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    ruleId: undefined,
    onUpdate: () => {},
    initialData: undefined,
    queryResponse: undefined,
    queryResultMetadata: undefined,
    onLastInputEnterPress: () => {},
    dataFormatting: dataFormattingDefault,
    isCompositeAlert: false,
    onCustomFiltersChange: () => {},
    customFilters: [],
    baseDataAlertColumns: [],
    baseDataAlertQueryResponse: {},
    isLoadingBaseDataAlertQueryResponse: false,
    isPreviewMode: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())

    // Focus on second input if it exists. The first input will already be filled in
    this.secondInput?.focus()
    const response = this.props.queryResponse || this.state.firstQueryResult
    if (response?.data?.data?.columns) {
      const groupableColumns = getGroupableColumns(response.data.data.columns)
      const { stringColumnIndices } = getStringColumnIndices(response.data.data.columns)
      const disabledColumns = Array.from(new Set([...groupableColumns, ...stringColumnIndices]))
      const columnSelectValue =
        response.data.data.columns.filter((column, index) => !disabledColumns.includes(index))[0]?.name || ''
      this.setState({ columnSelectValue })
    }

    !this.props.isCompositeAlert && this.getQuery()
    this.initialize()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      this.state.firstQueryResult !== prevState.firstQueryResult &&
      this.state.firstQueryResult?.data?.data?.columns
    ) {
      const groupableColumns = getGroupableColumns(this.state.firstQueryResult.data.data.columns)
      const { stringColumnIndices } = getStringColumnIndices(this.state.firstQueryResult.data.data.columns)
      const disabledColumns = Array.from(new Set([...groupableColumns, ...stringColumnIndices]))

      const columnSelectValue = this.props.initialData?.[0]?.self_compare_columns?.[1]
        ? this.props.initialData?.[0]?.self_compare_columns?.[1]
        : this.state.firstQueryResult.data.data.columns.filter((column, index) => !disabledColumns.includes(index))[0]
            ?.name || ''

      this.setState({ columnSelectValue })
    }
    if (this.props.baseDataAlertQueryResponse !== prevProps.baseDataAlertQueryResponse) {
      const isDisabled = this.isCustomListDisabled()
      this.setState({
        isDisabledCustomList: isDisabled,
        disabledReason: isSingleValueResponse(this.props.baseDataAlertQueryResponse) ? this.showWarningMessage() : '',
      })
    }
    if (!_isEqual(this.state, prevState)) {
      this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())
    }

    if (this.shouldValidateSecondQuery(prevState)) {
      this.validateSecondQuery()
      this.handleResetSecondQueryJoinColumns()
    }
    if (this.shouldScrollToSecondFieldSelectionGrid(prevState)) {
      setTimeout(() => {
        this.secondFieldSelectionGridRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }, 100)
    }

    if (this.shouldUpdateSecondFieldSelectionGrid(prevState)) {
      this.updateSecondFieldSelectionGrid()
    }
    if (this.shouldResetJoinColumnsAndShowSelection(prevState)) {
      this.setState((prevState) => ({
        storedInitialData: [
          prevState.storedInitialData[0],
          {
            ...prevState.storedInitialData[1],
            compare_column: '',
          },
          ...prevState.storedInitialData.slice(2),
        ],
        showJoinColumnSelection: this.state.secondTermType !== NUMBER_TERM_TYPE,
      }))
    }
  }
  isCustomListDisabled = () => {
    return (
      isSingleValueResponse(this.props.baseDataAlertQueryResponse) || this.props.isLoadingBaseDataAlertQueryResponse
    )
  }
  showWarningMessage = () => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Icon className='warning-icon' type='warning-triangle' />
      <div className='disabled-explanation'>
        Custom filters are disabled because this alert contains no filterable columns
      </div>
    </div>
  )
  transformTermValueToFilters = (termValue) => {
    if (!termValue?.rows || !termValue?.columns?.[0]?.name) {
      return []
    }
    const columnName = termValue.columns[0].name
    const showMessage = termValue.columns[0].display_name
    return termValue.rows.map((row) => ({
      value: row[0],
      column_name: columnName,
      show_message: showMessage,
    }))
  }
  initialize = () => {
    this.setState({ isFetchingFilters: true })
    const termValue = this.state.storedInitialData?.[1]?.term_value
    if (termValue) {
      const initialFilters = this.transformTermValueToFilters(termValue)
      if (this._isMounted) {
        this.setState({ initialFilters, isFetchingFilters: false })
      }
    } else {
      fetchFilters(getAuthentication(this.props.authentication))
        .then((response) => {
          const initialFilters = response?.data?.data?.data || []
          if (this._isMounted) {
            this.setState({ initialFilters, isFetchingFilters: false })
          }
        })
        .catch((error) => {
          console.error(error)
          if (this._isMounted) {
            this.setState({ isFetchingFilters: false })
          }
        })
    }
  }
  shouldScrollToSecondFieldSelectionGrid = (prevState) => {
    return this.state.secondQueryResponse && this.state.secondQueryResponse !== prevState.secondQueryResponse
  }
  shouldResetJoinColumnsAndShowSelection = (prevState) => {
    return this.state.secondQueryResult !== prevState.secondQueryResult && this.state.storedInitialData !== undefined
  }
  shouldUpdateSecondFieldSelectionGrid = (prevState) => {
    return this.state.secondQueryResult !== prevState.secondQueryResult && this.state.secondTermType === QUERY_TERM_TYPE
  }
  shouldValidateSecondQuery = (prevState) => {
    return (
      this.state.secondTermType === QUERY_TERM_TYPE &&
      this.state.secondInputValue !== prevState.secondInputValue &&
      this.state.secondInputValue?.length &&
      !this.props.isCompositeAlert
    )
  }
  handleFirstQueryFirstValueChange = (value) => {
    this.setState({ firstQueryFirstValue: value })
  }

  handleFirstQuerySecondValueChange = (value) => {
    this.setState({ firstQuerySecondValue: value })
  }

  handleSecondQueryFirstValueChange = (value) => {
    this.setState({ secondQueryFirstValue: value })
  }

  handleSecondQuerySecondValueChange = (value) => {
    this.setState({ secondQuerySecondValue: value })
  }
  renderJoinColumnSelectionTable = () => {
    if (!this.state.showJoinColumnSelection) {
      return null
    }
    if (!this.state.secondQueryValidated) {
      return null
    }
    if (isSingleValueResponse(this.state.firstQueryResult) || isSingleValueResponse(this.state.secondQueryResult)) {
      return null
    }
    const firstQueryColumns = this.state.firstQueryResult?.data?.data?.columns || []
    const secondQueryColumns = this.state.secondQueryResult?.data?.data?.columns || []

    const firstQuerySelectableJoinColumns = getQuerySelectableJoinColumns(firstQueryColumns)
    const secondQuerySelectableJoinColumns = getQuerySelectableJoinColumns(secondQueryColumns)
    return (
      <div className='join-column-selection-prompt'>
        <h4>Select join columns for your queries:</h4>
        <JoinColumnSelectionTable
          columnHeaders={[
            this.state.firstQueryResult?.data?.data?.text || 'Query 1',
            this.state.secondQueryResult?.data?.data?.text || 'Query 2',
          ]}
          rowHeaders={['1st Join', '2nd Join']}
          firstQueryFirstOptions={firstQuerySelectableJoinColumns.map((col) => ({
            value: col?.name,
            label: col?.display_name,
          }))}
          firstQuerySecondOptions={firstQuerySelectableJoinColumns.map((col) => ({
            value: col?.name,
            label: col?.display_name,
          }))}
          secondQueryFirstOptions={secondQuerySelectableJoinColumns.map((col) => ({
            value: col?.name,
            label: col?.display_name,
          }))}
          secondQuerySecondOptions={secondQuerySelectableJoinColumns.map((col) => ({
            value: col?.name,
            label: col?.display_name,
          }))}
          firstQueryResult={this.state.firstQueryResult}
          secondQueryResult={this.state.secondQueryResult}
          firstQueryFirstValue={this.state.firstQueryFirstValue}
          firstQuerySecondValue={this.state.firstQuerySecondValue}
          secondQueryFirstValue={this.state.secondQueryFirstValue}
          secondQuerySecondValue={this.state.secondQuerySecondValue}
          onFirstQueryFirstValueChange={this.handleFirstQueryFirstValueChange}
          onFirstQuerySecondValueChange={this.handleFirstQuerySecondValueChange}
          onSecondQueryFirstValueChange={this.handleSecondQueryFirstValueChange}
          onSecondQuerySecondValueChange={this.handleSecondQuerySecondValueChange}
          onRemoveSecondValues={this.handleRemoveSecondValues}
          isLoadingSecondQuery={this.state.isLoadingSecondQuery}
          storedInitialData={this.state.storedInitialData}
        />
      </div>
    )
  }
  handleResetSecondQueryJoinColumns = () => {
    this.setState((prevState) => ({
      storedInitialData: [
        {
          ...prevState.storedInitialData[0],
          join_columns: prevState.storedInitialData[0]?.join_columns?.filter((_, index) => index !== 1),
        },
        {
          ...prevState.storedInitialData[1],
          join_columns: [],
        },
        ...prevState.storedInitialData.slice(2),
      ],
      secondQueryFirstValue: '',
      firstQuerySecondValue: '',
      secondQuerySecondValue: '',
    }))
  }

  handleRemoveSecondValues = () => {
    this.setState({ firstQuerySecondValue: '', secondQuerySecondValue: '' })
  }

  updateSecondFieldSelectionGrid() {
    if (this.state.storedInitialData[1]?.compare_column === '') {
      this.setState({
        secondQuerySelectedColumns: [],
      })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
  }

  getInitialSelectedOperator = () => {
    return this.SUPPORTED_CONDITION_TYPES.includes(COMPARE_TYPE) ? this.SUPPORTED_OPERATORS[0] : EXISTS_TYPE
  }

  getMultiplicationFactorText = () => {
    const type = this.state.secondTermMultiplicationFactorType
    const value = this.state.secondTermMultiplicationFactorValue

    if (this.shouldRenderMultiplicationFactorSection()) {
      if (type === 'multiply-percent-higher') {
        if (value == 0) return null
        return `${value}% higher than`
      } else if (type === 'multiply-percent-lower') {
        if (value == 0) return null
        return `${value}% lower than`
      } else if (type === 'multiply') {
        if (value == 1) return null
        return `${value} times`
      } else if (type === 'add') {
        if (value == 0) return null
        return `${value} more than`
      } else if (type === 'subtract') {
        if (value == 0) return null
        return `${value} less than`
      }
    }

    return null
  }

  getConditionStatement = ({ tense, useRT, sentenceCase = false, withFilters = false } = {}) => {
    let queryText = this.getFormattedQueryText({ sentenceCase, withFilters })

    const RTExists = !!this.props.queryResponse?.data?.data?.parsed_interpretation?.length

    if (useRT && RTExists) {
      queryText = (
        <ReverseTranslation
          queryResponse={this.props.queryResponse}
          queryResultMetadata={this.props.queryResultMetadata}
          termId={this.TERM_ID_1}
          textOnly
        />
      )
    } else {
      queryText = this.props.queryResponse?.data?.data?.text ?? this.props.initialData?.expression?.[0]?.term_value
    }

    const operator = DATA_ALERT_OPERATORS[this.state.selectedOperator]
    const operatorText = tense === 'past' ? operator?.conditionTextPast : operator?.conditionText

    const multiplicationFactorText = this.getMultiplicationFactorText()

    let secondTermText = this.state.secondInputValue
    if (this.state.secondTermType === QUERY_TERM_TYPE) {
      secondTermText = (
        <span>
          "
          <ReverseTranslation
            queryResponse={this.props.queryResponse}
            queryResultMetadata={this.props.queryResultMetadata}
            textOnly
            termId={this.TERM_ID_2}
          />
          "
        </span>
      )
    }

    if (queryText && operatorText && secondTermText !== undefined) {
      return (
        <span className='data-alert-condition-statement'>
          <span className='data-alert-condition-statement-query1'>"{queryText}"</span>{' '}
          <span className='data-alert-condition-statement-query2'>
            <span className='data-alert-condition-statement-operator'>{operatorText}</span>{' '}
            {multiplicationFactorText ? (
              <span className='data-alert-condition-statement-operator'>{multiplicationFactorText}</span>
            ) : null}{' '}
            {secondTermText}
          </span>
        </span>
      )
    } else if (queryText) {
      return (
        <span className='data-alert-condition-statement'>
          <span className='data-alert-condition-statement-operator'>
            {sentenceCase ? 'N' : 'n'}ew data {tense === 'past' ? 'was' : 'is'} detected for the query
          </span>{' '}
          <span className='data-alert-condition-statement-query1'>"{queryText}"</span>
        </span>
      )
    }

    return
  }
  isValidSecondQueryResponse = () => {
    return (
      this.state.secondQueryResponse &&
      Object.keys(this.state.secondQueryResponse).length > 0 &&
      this.state.secondQueryResponse.data
    )
  }
  getCompareColumnIndex = (response, storedInitialData, index) => {
    let selectedNumberColumnName = storedInitialData?.[index]?.compare_column ?? ''
    if (this.state.secondTermType === SELF_COMPARISONS_TYPE) {
      selectedNumberColumnName = storedInitialData?.[index]?.self_compare_columns[0]
    }
    let compareColumnIndex

    if (selectedNumberColumnName) {
      compareColumnIndex = response?.data?.data?.columns?.findIndex((col) => col.name === selectedNumberColumnName)
    } else {
      compareColumnIndex = response?.data?.data?.columns?.findIndex((col) => isColumnNumberType(col) && col.is_visible)
    }

    return compareColumnIndex === -1 ? undefined : compareColumnIndex
  }
  shouldFetchSecondQuery = () => {
    return (
      this.state.secondTermType !== NUMBER_TERM_TYPE &&
      this.props.initialData?.[1]?.term_value &&
      !this.isValidSecondQueryResponse()
    )
  }
  getQuery = () => {
    try {
      this.setState({ isLoadingFirstQuery: true, isLoadingSecondQuery: true })
      const fetchFirstQuery = this.props.queryResponse
        ? Promise.resolve(this.props.queryResponse)
        : runQueryOnly({
            query: this.props.initialData?.[0]?.term_value,
            ...getAuthentication(this.props.authentication),
            ...getAutoQLConfig(this.props.autoQLConfig),
            source: 'data_alert_first_query',
            pageSize: 2,
            allowSuggestions: false,
            newColumns: this.props.initialData?.[0]?.additional_selects,
          })

      const fetchSecondQuery = this.shouldFetchSecondQuery()
        ? runQueryOnly({
            query: this.props.initialData?.[1]?.term_value,
            ...getAuthentication(this.props.authentication),
            ...getAutoQLConfig(this.props.autoQLConfig),
            source: 'data_alert_second_query',
            pageSize: 2,
            allowSuggestions: false,
          })
        : Promise.resolve(null)

      Promise.all([fetchFirstQuery, fetchSecondQuery])
        .then(([firstResponse, secondResponse]) => {
          const firstQueryCompareColumnIndex = this.getCompareColumnIndex(
            firstResponse,
            this.state.storedInitialData,
            0,
          )
          const secondQueryCompareColumnIndex = this.getCompareColumnIndex(
            secondResponse,
            this.state.storedInitialData,
            1,
          )
          this.setState({
            firstQueryResult: firstResponse,
            secondQueryResult: secondResponse,
            isLoadingFirstQuery: false,
            isLoadingSecondQuery: false,
            firstQuerySelectedColumns: firstQueryCompareColumnIndex !== undefined ? [firstQueryCompareColumnIndex] : [],
            secondQuerySelectedColumns:
              secondQueryCompareColumnIndex !== undefined ? [secondQueryCompareColumnIndex] : [],
          })
        })
        .catch((error) => {
          console.error('Error fetching query results:', error)
          this.setState({
            firstQueryResult: null,
            secondQueryResult: null,
            isLoadingFirstQuery: false,
            isLoadingSecondQuery: false,
          })
        })
    } catch (error) {
      console.error('Error in getQuery:', error)
      this.setState({
        firstQueryResult: null,
        secondQueryResult: null,
        isLoadingFirstQuery: false,
        isLoadingSecondQuery: false,
      })
    }
  }

  getJSON = () => {
    let firstQueryJoinColumns = []
    let secondQueryJoinColumns = []
    const { defaultJoinColumn: firstDefaultJoinColumn } = getDefaultJoinColumnAndDisplayNameAndJoinColumnsIndices(
      this.state.firstQueryResult,
    )
    const { defaultJoinColumn: secondDefaultJoinColumn } = getDefaultJoinColumnAndDisplayNameAndJoinColumnsIndices(
      this.state.secondQueryResult,
    )
    if (!isSingleValueResponse(this.state.firstQueryResult) && !isSingleValueResponse(this.state.secondQueryResult)) {
      firstQueryJoinColumns =
        this.state.firstQueryFirstValue !== ''
          ? [this.state.firstQueryFirstValue]
          : this.state.storedInitialData?.[0]?.join_columns ?? firstDefaultJoinColumn
      if (this.state.firstQuerySecondValue) {
        firstQueryJoinColumns[1] = this.state.firstQuerySecondValue
      }
      secondQueryJoinColumns =
        this.state.secondQueryFirstValue !== ''
          ? [this.state.secondQueryFirstValue]
          : this.state.storedInitialData?.[1]?.join_columns ?? secondDefaultJoinColumn
      if (this.state.secondQuerySecondValue) {
        secondQueryJoinColumns[1] = this.state.secondQuerySecondValue
      }
    }
    const userSelection = this.props.queryResponse?.data?.data?.fe_req?.disambiguation
    const tableFilters = this.state.queryFilters?.filter((f) => f.type === 'table')
    const lockedFilters = this.state.queryFilters?.filter((f) => f.type === 'locked')
    const additionalSelects =
      this.props.queryResponse?.data?.data?.fe_req?.additional_selects ||
      this.state.storedInitialData?.[0]?.additional_selects ||
      []
    const displayOverrides = this.props.queryResponse?.data?.data?.fe_req?.display_overrides || []
    const firstQuerySelectedNumberColumnName = this.state.firstQuerySelectedColumns?.map(
      (index) => this.state.firstQueryResult?.data?.data?.columns[index]?.name,
    )[0]
    const expression = [
      {
        id: this.TERM_ID_1,
        condition: this.state.selectedOperator,
        term_type: QUERY_TERM_TYPE,
        term_value: this.state.inputValue,
        ...(this.state.secondTermType === SELF_COMPARISONS_TYPE
          ? {
              self_compare_columns: [firstQuerySelectedNumberColumnName, this.state.columnSelectValue],
              filters: tableFilters,
              additional_selects: additionalSelects,
              display_overrides: displayOverrides,
              user_selection: this.props.initialData?.[0]?.user_selection ?? userSelection,
              session_filter_locks: lockedFilters,
            }
          : {
              user_selection: this.props.initialData?.[0]?.user_selection ?? userSelection,
              filters: tableFilters,
              session_filter_locks: lockedFilters,
              join_columns: this.state.secondTermType === NUMBER_TERM_TYPE ? [] : firstQueryJoinColumns,
              additional_selects: additionalSelects,
              display_overrides: displayOverrides,
              compare_column: firstQuerySelectedNumberColumnName,
            }),
      },
    ]
    const secondQuerySelectedNumberColumnName = this.state.secondQuerySelectedColumns.map(
      (index) => this.state.secondQueryResult?.data?.data?.columns[index]?.name,
    )[0]
    //To see if this a multiple groupby query

    if (this.allowOperators() && this.state.selectedOperator !== EXISTS_TYPE) {
      const { secondInputValue } = this.state
      let secondTermValue = secondInputValue
      const percentageWithMissingFractionRegex = /^\d+\.%$/
      if (percentageWithMissingFractionRegex.test(secondInputValue)) {
        // If secondInputValue ends with a dot, slice off the '%' at the end, add '0%',
        // Example: 40.% will become 40.0%
        secondTermValue = secondInputValue.slice(0, -1) + '0%'
      }

      const secondTerm = {
        id: this.TERM_ID_2,
        term_type: this.state.secondTermType,
        condition: 'TERMINATOR',
        term_value: secondTermValue,
      }

      if (this.state.secondTermType === QUERY_TERM_TYPE || this.state.secondTermType === SELF_COMPARISONS_TYPE) {
        let operation = this.state.secondTermMultiplicationFactorType
        let value = this.state.secondTermMultiplicationFactorValue

        if (operation === 'multiply-percent-higher' || operation === 'multiply-percent-lower') {
          let numberValue = parseInt(value ?? 0)
          if (!isNaN(numberValue) && numberValue > 0) {
            if (operation === 'multiply-percent-higher') {
              value = `${100 + numberValue}%`
            } else if (operation === 'multiply-percent-lower') {
              value = `${100 - numberValue}%`
            }

            if (this.state.secondTermType === SELF_COMPARISONS_TYPE) {
              expression[0].result_adjustment = {
                value,
                operation: 'multiply',
              }
            }

            secondTerm.result_adjustment = {
              value,
              operation: 'multiply',
            }
          }
        }
      }

      secondTerm.join_columns = this.state.secondTermType === NUMBER_TERM_TYPE ? [] : secondQueryJoinColumns

      if (this.state.secondTermType === QUERY_TERM_TYPE) {
        secondTerm.session_filter_locks = lockedFilters
        secondTerm.user_selection = this.props.initialData?.[1]?.user_selection ?? userSelection
      }
      secondTerm.compare_column = secondQuerySelectedNumberColumnName
      if (this.state.secondTermType !== SELF_COMPARISONS_TYPE) {
        expression.push(secondTerm)
      }
    }

    return expression
  }
  isNumerical = (num) => {
    try {
      if (typeof num === NUMBER_TERM_TYPE) {
        return true
      }

      if (!num) {
        return false
      }

      // Check for multiple words. If so, do not attempt parse
      const words = num.split(' ')
      if (words && words.length > 1) {
        return false
      }

      // If just one word, strip everything but numbers
      const strippedSymbolsStr = parseNum(num)
      return !isNaN(Number(strippedSymbolsStr))
    } catch (error) {
      return false
    }
  }

  isComplete = () => {
    let firstTermComplete = !!this.state.inputValue?.length
    if (this.shouldRenderFirstFieldSelectionGrid()) {
      firstTermComplete = this.state.firstQuerySelectedColumns.length !== 0
    }

    if (!firstTermComplete) {
      return false
    }

    if (
      !this.allowOperators() ||
      this.state.selectedOperator === EXISTS_TYPE ||
      this.state.secondTermType === SELF_COMPARISONS_TYPE
    ) {
      return true
    }

    const isQueryInvalidOrLoading =
      this.state.secondTermType === QUERY_TERM_TYPE &&
      (this.state.secondQueryInvalid || this.state.secondQueryValidating || !this.state.secondQueryValidated)
    if (isQueryInvalidOrLoading) {
      return false
    }

    let secondTermComplete = isNumber(this.state.secondInputValue) || !!this.state.secondInputValue?.length
    if (this.shouldRenderSecondFieldSelectionGrid()) {
      secondTermComplete = this.state.secondQuerySelectedColumns.length !== 0
    }

    if (!secondTermComplete) {
      return false
    }

    if (this.state.firstQueryFirstValue && !this.state.secondQueryFirstValue) {
      return false
    }

    if (this.state.firstQuerySecondValue && !this.state.secondQuerySecondValue) {
      return false
    }
    return true
  }

  isValid = () => {
    return true
  }

  userSelectedSuggestionHandler = (userSelectedValueFromSuggestionBox) => {
    if (userSelectedValueFromSuggestionBox && userSelectedValueFromSuggestionBox.name) {
      this.userSelectedValue = userSelectedValueFromSuggestionBox.name
      this.userSelectedSuggestion = true
      this.setState({ inputValue: userSelectedValueFromSuggestionBox.name })
    }
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }

    this.autoCompleteTimer = setTimeout(() => {
      fetchAutocomplete({
        ...getAuthentication(this.props.authentication),
        ...getAutoQLConfig(this.props.autoQLConfig),
        suggestion: value,
      })
        .then((response) => {
          const body = response.data

          const sortingArray = []
          let suggestionsMatchArray = []
          const autoCompleteArray = []
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
        })
        .catch((error) => {
          console.error(error)
        })
    }, 500)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }
  onColumnSelectValueChange = (selectedColumn) => {
    this.setState({
      columnSelectValue: selectedColumn,
    })
  }
  onSecondTermTypeChange = (secondTermType) => {
    if (secondTermType === this.state.secondTermType) {
      return
    }

    this.cancelSecondValidation()
    const newState = {
      secondTermType,
      secondInputValue: '',
      secondQueryResult: null,
      secondQueryValidating: false,
      secondQueryValidated: false,
      secondQueryInvalid: false,
      secondQueryError: '',
      showJoinColumnSelection: secondTermType !== NUMBER_TERM_TYPE,
    }
    this.setState(newState)
  }

  renderValidationError = () => {
    if (this.state.secondQueryValidating) {
      return <span className='expression-term-validation expression-term-validation-loading'>Validating...</span>
    } else if (this.state.secondQueryInvalid) {
      return (
        <span className='expression-term-validation expression-term-validation-error'>
          <Icon type='warning-triangle' />{' '}
          {this.state.secondQueryError ? (
            <span>{this.state.secondQueryError}</span>
          ) : (
            <span>That query is invalid. Try entering a different query.</span>
          )}
        </span>
      )
    } else if (this.state.secondQueryValidated) {
      return (
        <span className='expression-term-validation expression-term-validation-valid'>
          <Icon type='check' /> <span>Valid</span>
        </span>
      )
    }
    return null
  }

  renderOperatorSelector = () => {
    const options = this.SUPPORTED_OPERATORS?.map((operator) => {
      const operatorObj = DATA_ALERT_OPERATORS[operator]
      const symbol = operatorObj.symbol ? `(${operatorObj.symbol})` : ''
      return {
        value: operator,
        listLabel: (
          <span>
            <span dangerouslySetInnerHTML={{ __html: operatorObj.displayName }} /> {symbol}
          </span>
        ),
        label: <span dangerouslySetInnerHTML={{ __html: operatorObj.displayName }}></span>,
      }
    })

    return (
      <Select
        options={options}
        value={this.state.selectedOperator}
        className='react-autoql-rule-condition-select'
        onChange={(value) => {
          this.setState({ selectedOperator: value })
        }}
      />
    )
  }

  renderRTChunk = (text, type, key) => {
    return (
      <span key={`data-alert-chunked-rt-${this.COMPONENT_KEY}-${key}`} className={`data-alert-chunked-rt ${type}`}>
        {text}{' '}
      </span>
    )
  }

  onValidationResponse = (response) => {
    let error
    let isInvalid = false
    const isSecondQueryListQuery = isListQuery(response.data?.data?.columns) && !isSingleValueResponse(response)
    const amountOfNumberColumns = getColumnTypeAmounts(response.data?.data?.columns)['amountOfNumberColumns'] ?? 0
    const allColumnsAmount = response.data?.data?.columns.length
    const groupableColumnsAmount = getNumberOfGroupables(response.data?.data?.columns)

    if (this.getNumericalColumnAmount(response.data?.data?.columns) === 0) {
      isInvalid = true
      error = <span>Unsupported comparison query: Please use a query with a numerical column.</span>
    }

    this.setState({
      secondQueryValidating: false,
      secondQueryInvalid: isInvalid,
      secondQueryValidated: true,
      secondQueryError: error,
      secondQueryResponse: response,
      secondQueryResult: response,
      isSecondQueryListQuery: isSecondQueryListQuery,
      secondQueryAmountOfNumberColumns: amountOfNumberColumns,
      secondQueryAllColumnsAmount: allColumnsAmount,
      secondQueryGroupableColumnsAmount: groupableColumnsAmount,
    })
  }

  cancelSecondValidation = () => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
  }

  runSecondValidation = () => {
    if (!this.state.secondInputValue) {
      return
    }

    this.axiosSource = axios.CancelToken?.source()

    runQueryOnly({
      query: this.state.secondInputValue,
      ...getAuthentication(this.props.authentication),
      ...getAutoQLConfig(this.props.autoQLConfig),
      source: 'data_alert_validation',
      pageSize: 2, // No need to fetch more than 2 rows to determine validity
      cancelToken: this.axiosSource.token,
      allowSuggestions: false,
    })
      .then((response) => {
        this.onValidationResponse(response)
        const secondQueryCompareColumnIndex = this.getCompareColumnIndex(response, this.state.storedInitialData, 1)
        this.setState({
          isLoadingSecondQuery: false,
          secondQuerySelectedColumns:
            secondQueryCompareColumnIndex !== undefined ? [secondQueryCompareColumnIndex] : [],
        })
      })
      .catch((error) => {
        if (error?.response?.data?.message !== REQUEST_CANCELLED_ERROR) {
          this.setState({ secondQueryValidating: false, secondQueryInvalid: true })
        }
      })
  }

  validateSecondQuery = () => {
    this.cancelSecondValidation()

    if (!this.state.secondQueryValidating) {
      this.setState({ isLoadingSecondQuery: true, secondQueryValidating: true })
    }

    clearTimeout(this.secondValidationTimeout)
    this.secondValidationTimeout = setTimeout(() => {
      this.runSecondValidation()
    }, 1000)
  }

  onSecondQueryChange = (e) => {
    const secondInputValue = e.target.value
    const newState = { secondInputValue, secondQueryValidated: false }

    if (!secondInputValue?.length) {
      newState.secondQueryValidating = false
    }
    if (this.state.secondTermType === NUMBER_TERM_TYPE) {
      const numberRegex = /^-?(?!0\d)(\d*[,.$]?)+\d*%?$/
      // This regex matches positive integers, decimals, and percentages. It allows % sign at the end rather than the beginning.
      if (numberRegex.test(secondInputValue) || secondInputValue === '') {
        this.setState(newState)
      }
    } else {
      this.setState(newState)
    }
  }

  getChunkedInterpretationText = () => {
    const parsedRT = this.props.queryResponse?.data?.data?.parsed_interpretation
    const rtArray = constructRTArray(parsedRT)

    if (!parsedRT?.length) {
      return this.props.queryResponse?.data?.data?.text ?? this.props.initialData?.expression?.[0]?.term_value
    }

    let queryText = ''
    let numValueLabels = 0
    rtArray.forEach((chunk, i) => {
      let text = chunk.eng?.trim()
      const type = chunk.c_type

      if (!text || !type || type === 'VL_SUFFIX' || type === 'DELIM') {
        return
      }

      let prefix = ''
      if (type === 'VALUE_LABEL') {
        if (!numValueLabels) {
          prefix = 'for '
        }

        numValueLabels += 1
      }

      if (type === ColumnTypes.DATE) {
        const timeFrame = getTimeFrameTextFromChunk(chunk)
        if (timeFrame) {
          text = timeFrame
        } else {
          return
        }
      }

      queryText = `${queryText} ${prefix}${text}`
    })

    return queryText?.trim()
  }

  renderChunkedInterpretation = () => {
    const parsedRT = this.props.queryResponse?.data?.data?.parsed_interpretation
    const rtArray = constructRTArray(parsedRT)

    if (!parsedRT?.length) {
      return this.props.queryResponse?.data?.data?.text ?? this.props.initialData?.expression?.[0]?.term_value
    }

    let numValueLabels = 0
    return rtArray.map((chunk, i) => {
      let text = chunk.eng
      const type = chunk.c_type

      if (!text || !type) {
        return null
      }

      if (i === 0) {
        text = text[0].toUpperCase() + text.substring(1)
      }

      if (type === 'VL_SUFFIX' || type === 'DELIM') {
        return null
      }

      if (type === ColumnTypes.DATE) {
        const timeFrame = getTimeFrameTextFromChunk(chunk)
        if (timeFrame) {
          text = timeFrame
        } else {
          return null
        }
      }

      let prefix = ''
      if (type === 'VALUE_LABEL') {
        if (!numValueLabels) {
          prefix = 'for'
        }

        numValueLabels += 1
      }

      return (
        <>
          {!!prefix && this.renderRTChunk(prefix, 'VL_PREFIX', `${i}-${i}`)}
          {this.renderRTChunk(text, type, i)}
        </>
      )
    })
  }

  getQueryFiltersText = () => {
    const rtArray = constructRTArray(this.props.queryResponse?.data?.data?.parsed_interpretation)

    if (!rtArray) {
      return this.props.queryResponse?.data?.data?.text ?? this.props.initialData?.expression?.[0]?.term_value
    }

    const filters = this.state.queryFilters

    let filterText = ''
    let filterTextStrings = []
    if (filters.length === 0) {
      return filterText
    }
    filters.forEach((filter) => {
      const filterValue = normalizeString(filter.value)
      const rtChunks = rtArray.filter((chunk) => {
        return chunk.for?.trim()?.toLowerCase() === filterValue
      })

      let filterTextStr = ''
      if (rtChunks?.length) {
        rtChunks.forEach((chunk) => {
          filterTextStr = filterTextStr + chunk.eng
        })
      }

      if (filterTextStr) {
        filterTextStrings.push(filterTextStr)
      }
    })

    if (filterTextStrings.length) {
      filterTextStrings.forEach((str, i) => {
        const delim = i !== filterTextStrings.length - 1 ? ', ' : ''
        filterText = `${filterText}${str}${delim}`
      })
    }

    return filterText
  }
  getFormattedDate = (filter) => {
    let isDate = false
    let dateText
    let dateArray = []
    try {
      const textArray = filter.value.split(',')
      const textWithDatesArray = textArray.map((str) => {
        if (isISODate(str)) {
          const dateDayJS = dayjs(str).utc()
          const formattedDate = dateDayJS.format('ll')
          if (formattedDate !== 'Invalid Date') {
            isDate = true
            dateArray.push(dateDayJS)
            return formattedDate
          }
        }
        return str
      })
      const startDate = textWithDatesArray[0]
      const endDate = textWithDatesArray[1]
      dateText = `Between ${startDate} and ${endDate}`
      if (startDate === endDate) {
        dateText = `${startDate}`
      }
    } catch (error) {
      console.error(error)
      isDate = false
    }
    if (isDate) {
      return dateText
    }
    return undefined
  }
  getFormattedQueryText = ({ sentenceCase = true, withFilters } = {}) => {
    try {
      let queryFiltersText = ''
      let queryText = this.state.inputValue
      if (this.props.queryResponse) {
        queryText = this.props.queryResponse?.data?.data?.text
        queryFiltersText = this.getQueryFiltersText()
      } else if (!queryText && this.props.initialData) {
        queryText = this.props.initialData?.expression?.[0]?.term_value
      }

      if (!queryText) {
        return ''
      }

      if (sentenceCase) {
        queryText = queryText[0].toUpperCase() + queryText.substring(1)
      }

      if (withFilters) {
        queryText = `${queryText} ${queryFiltersText}`.trim()
      }

      return queryText
    } catch (error) {
      console.error(error)
      return ''
    }
  }
  getFormattedDataAlertText = ({ sentenceCase = true } = {}) => {
    try {
      let dataAlertText = this.props.dataAlert.title

      if (!dataAlertText) {
        return ''
      }

      if (sentenceCase) {
        dataAlertText = dataAlertText[0].toUpperCase() + dataAlertText.substring(1)
      }

      return dataAlertText
    } catch (error) {
      console.error(error)
      return ''
    }
  }
  renderFormattedQuery = () => {
    return
  }

  getFilters = (props = this.props) => {
    let lockedFilters = []
    let tableFilters = []

    if (!props.queryResponse) {
      lockedFilters = props.initialData[0]?.session_filter_locks ?? []
      tableFilters = props.initialData[0]?.filters ?? []
    } else {
      const persistentFilters = props.queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
      const sessionFilters = props.queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
      lockedFilters = [...persistentFilters, ...sessionFilters] ?? []
      tableFilters = props.filters ?? []
    }

    const tableFiltersFormatted =
      tableFilters.map((filter) => ({
        ...filter,
        value: filter?.displayValue ?? filter?.value,
        type: 'table',
      })) ?? []

    const lockedFiltersFormatted = lockedFilters.map((filter) => ({
      ...filter,
      type: 'locked',
    }))

    const allFilters = [...tableFiltersFormatted, ...lockedFiltersFormatted]

    return allFilters
  }

  removeFilter = (filter) => {
    const newFilterList = this.state.queryFilters?.filter((f) => !_isEqual(f, filter))
    this.setState({ queryFilters: newFilterList })
  }

  renderFilterChips = () => {
    const filters = this.state.queryFilters

    if (filters?.length) {
      return (
        <div className='react-autoql-data-alert-filters-container'>
          {filters.map((filter, i) => {
            if (filter) {
              let chipContent = null
              if (filter.type === 'table') {
                let operatorDisplay = ' ' + filter.operator ?? 'like'

                if (filter.operator === 'between' && !filter.value.includes(' and ')) {
                  operatorDisplay = ':'
                }

                let dateText
                if (filter.column_type !== 'AMOUNT') {
                  dateText = this.getFormattedDate(filter)
                }

                let value = filter.value
                if (filter.operator === 'like') {
                  value = `"${filter.value}"`
                }
                if (dateText) {
                  value = dateText
                }

                chipContent = (
                  <span>
                    <strong>
                      <Icon type='table' /> {filter.columnName}
                    </strong>
                    {operatorDisplay} <em>{value}</em>
                  </span>
                )
              } else if (filter.type === 'locked') {
                chipContent = (
                  <span>
                    <strong>
                      <Icon type='lock' /> {filter.show_message ?? 'Value'}
                    </strong>
                    {filter.filter_type?.toLowerCase() === 'exclude' ? (
                      <span>
                        {' '}
                        <u>not</u>{' '}
                      </span>
                    ) : (
                      ': '
                    )}
                    {filter.value}
                  </span>
                )
              }

              if (chipContent) {
                return (
                  <Chip
                    key={`filter-chip-${i}`}
                    onDelete={() => this.removeFilter(filter)}
                    confirmDelete
                    confirmText='Remove this filter?'
                    tooltip={`This ${filter.type} filter is currently applied to your query data. It will also be applied to your Data Alert unless you remove it by hitting "x".`}
                    tooltipID={this.props.tooltipID}
                    popoverPadding={10}
                  >
                    {chipContent}
                  </Chip>
                )
              }
            }

            return null
          })}
        </div>
      )
    }
    return null
  }

  renderBaseQuery = () => {
    if (this.props.isCompositeAlert) {
      return (
        <div className='react-autoql-rule-input'>
          <div>
            <span className='data-alert-rule-query-readonly-container'>
              <Input label='Data Alert' value={this.getFormattedDataAlertText()} readOnly disabled fullWidth />
            </span>
            <div className='react-autoql-rule-field-selection-first-query'>
              <div className='react-autoql-rule-field-selection-grid-container'>{this.renderPreviewGrid()}</div>
            </div>
            {this.renderFilterChips()}
          </div>
        </div>
      )
    }
    return (
      <div className='react-autoql-rule-input'>
        <div>
          <span
            className='data-alert-rule-query-readonly-container'
            data-tooltip-id={this.props.tooltipID}
            data-tooltip-content='Editing this query is not permitted. To use a different query, simply create a new Data Alert via Data Messenger or a Dashboard.'
          >
            {/* Save this bock for later when we want to allow column selection from list queries */}
            {/* <span className='data-alert-description-span'>Trigger Alert when this query</span>
             Trigger Alert when{' '}
            <Select
              className='data-alert-schedule-step-type-selector'
              options={[
                {
                  value: 'any-column',
                  label: 'any column',
                },
                {
                  value: 'selected-columns',
                  label: 'selected columns',
                },
              ]}
              value={this.state.columnSelectionType}
              onChange={(type) => this.setState({ columnSelectionType: type })}
              outlined={false}
              showArrow={false}
            />{' '}
            from this query */}
            <Input label='Query' value={this.getFormattedQueryText()} readOnly disabled fullWidth />
          </span>
          {this.shouldRenderFirstFieldSelectionGrid() && (
            <>
              <div className='react-autoql-rule-field-selection-first-query' data-test='rule'>
                <div className='react-autoql-rule-field-selection-grid-container'>
                  {this.renderfirstFieldSelectionGrid()}
                </div>
              </div>
            </>
          )}
          {this.renderFilterChips()}
        </div>
      </div>
    )
  }

  getNumericalColumnAmount = (columns) => {
    return getColumnTypeAmounts(columns)['amountOfNumberColumns'] ?? 0
  }

  shouldRenderFirstFieldSelectionGrid = () => {
    return this.state.selectedConditionType === COMPARE_TYPE
  }

  shouldRenderSecondFieldSelectionGrid = () => {
    return (
      this.state.secondTermType !== NUMBER_TERM_TYPE &&
      this.state.secondTermType !== SELF_COMPARISONS_TYPE &&
      this.state.secondQueryValidated
    )
  }

  renderfirstFieldSelectionGrid = () => {
    if (this.state.isLoadingFirstQuery) {
      return <LoadingDots />
    }
    if (!this.state.firstQueryResult) {
      return <div className='error-message'>Error loading query data. Please try again.</div>
    }
    const columns = this.state.firstQueryResult?.data?.data?.columns
    const additionalSelects = this.state.firstQueryResult?.data?.data?.fe_req?.additional_selects
    const groupableColumns = getGroupableColumns(columns)
    const { stringColumnIndices } = getStringColumnIndices(columns)
    const additionalSelectColumns =
      columns
        ?.filter((col) => !!additionalSelects?.find((select) => select.columns[0] === col.name))
        ?.map((col) => col.index) ?? []

    const disabledColumns = Array.from(
    const disabledColumns = Array.from(new Set([...groupableColumns, ...stringColumnIndices]))

    return (
      <SelectableTable
        dataFormatting={this.props.dataFormatting}
        onColumnSelection={(columns) => {
          this.setState({ firstQuerySelectedColumns: columns, firstQueryGroupableColumnIndex: groupableColumns[0] })
        }}
        selectedColumns={this.state.firstQuerySelectedColumns}
        disabledColumns={disabledColumns}
        additionalSelectColumns={additionalSelectColumns}
        shouldRender={this.shouldRenderFirstFieldSelectionGrid()}
        queryResponse={this.state.firstQueryResult}
        radio={true}
        showEndOfPreviewMessage={true}
        tooltipID={this.props.tooltipID}
        rowLimit={20}
      />
    )
  }

  renderSecondFieldSelectionGrid = () => {
    if (this.state.isLoadingSecondQuery) {
      return <LoadingDots />
    }
    if (!this.state.secondQueryResult) {
      return <div className='error-message'>Error loading query data. Please try again.</div>
    }
    const groupableColumns = getGroupableColumns(this.state.secondQueryResult?.data?.data?.columns)
    const { stringColumnIndices } = getStringColumnIndices(this.state.secondQueryResult?.data?.data?.columns)
    const disabledColumns = Array.from(new Set([...groupableColumns, ...stringColumnIndices]))

    return (
      <SelectableTable
        dataFormatting={this.props.dataFormatting}
        onColumnSelection={(columns) =>
          this.setState({ secondQuerySelectedColumns: columns, secondQueryGroupableColumnIndex: groupableColumns[0] })
        }
        selectedColumns={this.state.secondQuerySelectedColumns}
        disabledColumns={disabledColumns}
        shouldRender={this.shouldRenderSecondFieldSelectionGrid()}
        queryResponse={this.state.secondQueryResult}
        radio={true}
        showEndOfPreviewMessage={true}
        tooltipID={this.props.tooltipID}
        rowLimit={20}
      />
    )
  }

  getSecondInputPlaceholder = () => {
    const { secondTermType } = this.state
    const { queryResponse } = this.props

    if (secondTermType === NUMBER_TERM_TYPE) {
      let placeholder = 'Type a number'
      const queryResponseValue = queryResponse?.data?.data?.rows?.[0]?.[0]
      if (isNumber(queryResponseValue)) {
        return `${placeholder} (eg. "${queryResponseValue}")`
      }
      return placeholder
    } else if (secondTermType === QUERY_TERM_TYPE) {
      return 'Type a query'
    }
  }

  shouldRenderValidationSection = () => {
    return this.allowOperators() && this.state.secondTermType === QUERY_TERM_TYPE
  }
  renderPreviewGrid = () => {
    if (this.props.isLoadingBaseDataAlertQueryResponse) {
      return <LoadingDots />
    }
    if (!this.props.baseDataAlertQueryResponse) {
      return <div className='error-message'>Error loading data alert data. Please try again.</div>
    }
    const queryResponse = this.props.baseDataAlertQueryResponse
    return (
      <SelectableTable
        dataFormatting={this.props.dataFormatting}
        queryResponse={queryResponse}
        radio={false}
        showEndOfPreviewMessage={true}
        tooltipID={this.props.tooltipID}
        rowLimit={20}
        disableCheckboxes={true}
      />
    )
  }

  renderTermValidationSection = () => {
    if (!this.shouldRenderValidationSection()) {
      return null
    }

    return <div className='rule-simple-validation-container'>{this.renderValidationError()}</div>
  }

  renderSecondTermInput = () => {
    const queryResponse = this.state.firstQueryResult
    let disabledColumns = undefined
    if (queryResponse !== null) {
      const groupableColumns = getGroupableColumns(queryResponse?.data?.data?.columns)
      const { stringColumnIndices } = getStringColumnIndices(queryResponse?.data?.data?.columns)
      disabledColumns = Array.from(new Set([...groupableColumns, ...stringColumnIndices]))
    }
    const baseOptions = [
      {
        value: NUMBER_TERM_TYPE,
        label: (
          <span>
            this <strong>number:</strong>
          </span>
        ),
      },
      {
        value: QUERY_TERM_TYPE,
        label: (
          <span>
            the result of this <strong>query:</strong>
          </span>
        ),
      },
    ]
    const selfComparisonOption = {
      value: SELF_COMPARISONS_TYPE,
      label: (
        <span>
          this column of current <strong>query:</strong>
        </span>
      ),
    }

    return (
      <Input
        ref={(r) => (this.secondInput = r)}
        className='react-autoql-second-term-type-input'
        dataFormatting={this.props.dataFormatting}
        queryResponse={queryResponse}
        spellCheck={false}
        placeholder={this.getSecondInputPlaceholder()}
        value={this.state.secondInputValue}
        type={
          this.state.secondTermType === NUMBER_TERM_TYPE
            ? 'text'
            : this.state.secondTermType === SELF_COMPARISONS_TYPE
            ? 'hidden'
            : undefined
        }
        displayColumnSelector={
          this.state.secondTermType === SELF_COMPARISONS_TYPE && !isSingleValueResponse(queryResponse)
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            this.props.onLastInputEnterPress()
          }
        }}
        columnSelectOptions={
          this.state.firstQueryResult?.data?.data?.columns
            ?.filter((column, index) => !disabledColumns.includes(index))
            .map((column) => ({
              value: column.name,
              label: <span>{column.display_name}</span>,
            })) || []
        }
        selectOptions={[...baseOptions, ...(!isSingleValueResponse(queryResponse) ? [selfComparisonOption] : [])]}
        onSelectChange={this.onSecondTermTypeChange}
        onColumnSelectValueChange={this.onColumnSelectValueChange}
        selectValue={this.state.secondTermType}
        columnSelectValue={this.state.columnSelectValue}
        onChange={this.onSecondQueryChange}
      />
    )
  }

  shouldRenderMultiplicationFactorSection = () => {
    return (
      this.state.secondTermType === QUERY_TERM_TYPE ||
      (this.state.secondTermType === SELF_COMPARISONS_TYPE &&
        this.state.selectedOperator != 'EQUAL_TO' &&
        this.state.selectedOperator != 'NOT_EQUAL_TO')
    )
  }

  renderSecondTermMultiplicationFactor = () => {
    if (!this.shouldRenderMultiplicationFactorSection()) {
      return null
    }

    return (
      <div className='react-autoql-second-term-multiplication-factor-input'>
        <Input
          ref={(r) => (this.multiplicationFactorInput = r)}
          spellCheck={false}
          placeholder=''
          value={this.state.secondTermMultiplicationFactorValue}
          onChange={(e) => {
            this.setState({ secondTermMultiplicationFactorValue: e.target.value })
          }}
          type='text' // TODO: make custom number type where percent symbol is allowed
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              this.props.onLastInputEnterPress()
            }
          }}
          selectLocation='right'
          selectOptions={[
            {
              value: 'multiply-percent-higher',
              label: (
                <span>
                  <strong>% higher</strong> than
                </span>
              ),
            },
            {
              value: 'multiply-percent-lower',
              label: (
                <span>
                  <strong>% lower</strong> than
                </span>
              ),
            },
            {
              value: 'multiply',
              label: (
                <span>
                  <strong>times</strong> (multiple)
                </span>
              ),
            },
            {
              value: 'add',
              label: (
                <span>
                  <strong>more</strong> than
                </span>
              ),
            },
            {
              value: 'subtract',
              label: (
                <span>
                  <strong>less</strong> than
                </span>
              ),
            },
          ]}
          selectValue={this.state.secondTermMultiplicationFactorType}
          onSelectChange={(secondTermMultiplicationFactorType) => {
            if (secondTermMultiplicationFactorType === this.state.secondTermMultiplicationFactorType) {
              return
            }

            const newState = { secondTermMultiplicationFactorType }

            if (
              secondTermMultiplicationFactorType === 'multiply-percent-higher' ||
              secondTermMultiplicationFactorType === 'multiply-percent-lower'
            ) {
              newState.secondTermMultiplicationFactorValue = '0'
            } else if (secondTermMultiplicationFactorType === 'multiply') {
              newState.secondTermMultiplicationFactorValue = '1'
            } else {
              newState.secondTermMultiplicationFactorValue = '0'
            }

            this.setState(newState, () => {
              this.multiplicationFactorInput?.selectAll()
            })
          }}
        />
        {/* <Icon
          className='react-autoql-multiplication-factor-tooltip-icon'
          type='info'
          tooltipID={this.props.tooltipID}
          tooltip={
            this.state.secondTermMultiplicationFactorType === 'multiply'
              ? 'Compare to a custom multiple or percentage of the query result (eg. 90% of total sales last month). You may type in a number or a percentage.'
              : 'Add or subtract a specific amount from the query result to compare to.'
          }
        /> */}
      </div>
    )
  }

  allowOperators = () => {
    return this.SUPPORTED_CONDITION_TYPES.includes(COMPARE_TYPE, SELF_COMPARISONS_TYPE)
  }
  renderNotificationHeader = () => {
    const options = Object.keys(DATA_ALERT_CONDITION_TYPES).map((type) => {
      const disabled = !this.SUPPORTED_CONDITION_TYPES.includes(type)

      return {
        value: type,
        label:
          this.props.dataAlertType === SCHEDULED_TYPE
            ? CONDITION_TYPE_LABELS_SCHEDULED[type]
            : CONDITION_TYPE_LABELS[type],
        disabled,
        tooltip: disabled ? 'Your query is not eligible for this option.' : undefined,
      }
    })
    return (
      <div style={{ marginBottom: '10px' }}>
        <>
          {this.props.dataAlertType === SCHEDULED_TYPE ? (
            <span className='data-alert-description-span'>Schedule a notification</span>
          ) : (
            <span className='data-alert-description-span'>Send a notification when your query</span>
          )}

          <Select
            className='data-alert-schedule-step-type-selector'
            outlined={false}
            showArrow={false}
            options={options}
            value={this.state.selectedConditionType}
            onChange={(type) =>
              this.setState({
                selectedOperator: type === EXISTS_TYPE ? EXISTS_TYPE : this.SUPPORTED_OPERATORS[0],
                selectedConditionType: type,
              })
            }
          />
        </>
      </div>
    )
  }
  renderComparisonSection = () => {
    if (this.state.selectedConditionType !== COMPARE_TYPE) {
      return null
    }

    return (
      <>
        <div style={{ marginTop: '25px' }}>
          {this.state.firstQuerySelectedColumns?.length ? (
            <>
              <span className='data-alert-description-span'>
                Any value from{' '}
                <Select
                  value={this.state.firstQuerySelectedColumns[0]}
                  onChange={(col) => this.setState({ firstQuerySelectedColumns: [col] })}
                  outlined={false}
                  showArrow={false}
                  options={this.state.firstQueryResult?.data?.data?.columns
                    ?.filter(
                      (col) =>
                        col.is_visible &&
                        isColumnNumberType(col) &&
                        !this.state.firstQueryResult?.data?.data?.fe_req?.additional_selects?.find(
                          (select) => select.columns[0] === col.name,
                        ),
                    )
                    ?.map((col) => ({
                      value: col.index,
                      label: col.display_name,
                    }))}
                />
              </span>
            </>
          ) : (
            <span className='data-alert-description-span'>The result of your query</span>
          )}
        </div>
        <div className='react-autoql-notification-rule-container' data-test='rule'>
          {this.allowOperators() && (
            <>
              <div className='react-autoql-rule-condition-select-input-container'>{this.renderOperatorSelector()}</div>
              <div className='react-autoql-rule-mult-factor-select-input-container'>
                {this.renderSecondTermMultiplicationFactor()}
              </div>
              <div className='react-autoql-rule-second-input-container'>
                <div className='react-autoql-rule-input'>{this.renderSecondTermInput()}</div>
                {this.renderTermValidationSection()}
              </div>
            </>
          )}
        </div>
        {this.shouldRenderSecondFieldSelectionGrid() && (
          <div className='react-autoql-rule-field-selection-grid-container' ref={this.secondFieldSelectionGridRef}>
            <div className='react-autoql-rule-field-selection-description'>
              <div className='react-autoql-input-label'>Select field to compare to</div>
            </div>
            {this.renderSecondFieldSelectionGrid()}
          </div>
        )}
        {this.renderJoinColumnSelectionTable()}
      </>
    )
  }
  renderCustomList = () => {
    return (
      <div>
        <div className={`custom-list-container ${this.state.isDisabledCustomList ? 'disabled' : ''}`}>
          <CustomList
            authentication={this.props.authentication}
            initialFilters={this.state.initialFilters}
            baseDataAlertColumns={this.props.baseDataAlertColumns}
            onCustomFiltersChange={this.props.onCustomFiltersChange}
            customFilters={this.props.customFilters}
            storedInitialData={this.state.storedInitialData}
            tooltipID={this.props.tooltipID}
            isPreviewMode={this.props.isPreviewMode}
          />
        </div>
        {this.state.isDisabledCustomList && <div>{this.state.disabledReason}</div>}
      </div>
    )
  }

  render = () => {
    if (this.props.conditionStatementOnly) {
      return null
    }
    const isInputDisabled = this.props.isPreviewMode

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-rule-simple
${this.shouldRenderValidationSection() && 'with-query-validation'}
${this.props.isPreviewMode && 'preview-mode'}`}
          style={this.props.style}
        >
          {!this.props.isCompositeAlert && this.renderNotificationHeader()}

          <div className='react-autoql-rule-simple-first-query' data-test='rule'>
            <div className='react-autoql-rule-first-input-container'>{this.renderBaseQuery()}</div>
          </div>

          {!this.props.isCompositeAlert && this.renderComparisonSection()}
          {this.props.isCompositeAlert && this.renderCustomList()}
        </div>
      </ErrorBoundary>
    )
  }
}
