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
  COMPARE_TYPE,
  DATA_ALERT_OPERATORS,
  EXISTS_TYPE,
  NUMBER_TERM_TYPE,
  QUERY_TERM_TYPE,
  isNumber,
  isSingleValueResponse,
  constructRTArray,
  getTimeFrameTextFromChunk,
  getSupportedConditionTypes,
  REQUEST_CANCELLED_ERROR,
  isISODate,
  authenticationDefault,
  getAuthentication,
  getAutoQLConfig,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { Chip } from '../../Chip'
import { Input } from '../../Input'
import { Select } from '../../Select'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ReverseTranslation } from '../../ReverseTranslation'

import { authenticationType } from '../../../props/types'

import './RuleSimple.scss'

export default class RuleSimple extends React.Component {
  autoCompleteTimer = undefined

  constructor(props) {
    super(props)

    const { initialData, queryResponse } = props

    this.SUPPORTED_CONDITION_TYPES = getSupportedConditionTypes(initialData, queryResponse)

    this.SUPPORTED_OPERATORS = []
    if (
      this.SUPPORTED_CONDITION_TYPES.includes(COMPARE_TYPE) ||
      Object.keys(DATA_ALERT_OPERATORS).includes(initialData?.[0]?.condition)
    ) {
      this.SUPPORTED_OPERATORS = Object.keys(DATA_ALERT_OPERATORS)
    }

    this.TERM_ID_1 = uuid()
    this.TERM_ID_2 = uuid()

    const selectedOperator = this.SUPPORTED_CONDITION_TYPES.includes(COMPARE_TYPE)
      ? this.SUPPORTED_OPERATORS[0]
      : EXISTS_TYPE

    const state = {
      selectedOperator: initialData?.[0]?.condition ?? selectedOperator,
      inputValue: queryResponse?.data?.data?.text ?? '',
      secondInputValue: '',
      secondTermType: NUMBER_TERM_TYPE,
      secondQueryValidating: false,
      secondQueryValidated: false,
      secondQueryInvalid: false,
      secondQueryError: '',
      isEditingQuery: false,
      queryFilters: this.getFilters(props),
    }

    if (initialData?.length) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData.length > 1 ? initialData[1].id : uuid()

      state.selectedOperator = initialData[0].condition ?? this.SUPPORTED_OPERATORS[0]
      state.inputValue = initialData[0].term_value ?? ''
      state.secondInputValue = initialData[1]?.term_value ?? ''
      state.secondTermType = initialData[1]?.term_type?.toUpperCase() ?? NUMBER_TERM_TYPE
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
  }

  static defaultProps = {
    authentication: authenticationDefault,
    ruleId: undefined,
    onUpdate: () => {},
    initialData: undefined,
    queryResponse: undefined,
    onLastInputEnterPress: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())

    // Focus on second input if it exists. The first input will already be filled in
    this.secondInput?.focus()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!_isEqual(this.state, prevState)) {
      this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())
    }

    if (
      this.state.secondTermType === QUERY_TERM_TYPE &&
      this.state.secondInputValue !== prevState.secondInputValue &&
      this.state.secondInputValue?.length
    ) {
      this.validateSecondQuery()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
  }

  getConditionStatement = ({ tense, useRT, sentenceCase = false, withFilters = false } = {}) => {
    let queryText = this.getFormattedQueryText({ sentenceCase, withFilters })

    if (useRT) {
      queryText = <ReverseTranslation queryResponse={this.props.queryResponse} textOnly />
    }

    const operator = DATA_ALERT_OPERATORS[this.state.selectedOperator]
    const operatorText = tense === 'past' ? operator?.conditionTextPast : operator?.conditionText
    let secondTermText = this.state.secondInputValue
    if (this.state.secondTermType === QUERY_TERM_TYPE) {
      secondTermText = `"${secondTermText}"`
    }

    if (queryText && operatorText && secondTermText !== undefined) {
      return (
        <span className='data-alert-condition-statement'>
          <span className='data-alert-condition-statement-query1'>"{queryText}"</span>{' '}
          <span className='data-alert-condition-statement-operator'>{operatorText}</span>{' '}
          <span className='data-alert-condition-statement-query2'>{secondTermText}</span>
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

  getJSON = () => {
    const { secondInputValue } = this.state
    let secondTermValue = secondInputValue
    const percentageWithMissingFractionRegex = /^\d+\.%$/
    if (percentageWithMissingFractionRegex.test(secondInputValue)) {
      secondTermValue = secondInputValue.slice(0, -1) + '0%'
    }

    const userSelection = this.props.queryResponse?.data?.data?.fe_req?.disambiguation
    const tableFilters = this.state.queryFilters?.filter((f) => f.type === 'table')
    const lockedFilters = this.state.queryFilters?.filter((f) => f.type === 'locked')

    const expression = [
      {
        id: this.TERM_ID_1,
        term_type: QUERY_TERM_TYPE,
        condition: this.state.selectedOperator,
        term_value: this.state.inputValue,
        user_selection: this.props.initialData?.[0]?.user_selection ?? userSelection,
        filters: tableFilters,
        session_filter_locks: lockedFilters,
      },
    ]

    if (this.allowOperators()) {
      const secondTerm = {
        id: this.TERM_ID_2,
        term_type: this.state.secondTermType,
        condition: 'TERMINATOR',
        term_value: secondTermValue,
      }

      if (this.state.secondTermType === QUERY_TERM_TYPE) {
        secondTerm.session_filter_locks = lockedFilters
        secondTerm.user_selection = this.props.initialData?.[1]?.user_selection ?? userSelection
      }

      expression.push(secondTerm)
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
    const firstTermComplete = !!this.state.inputValue?.length
    if (!firstTermComplete) {
      return false
    }

    if (!this.allowOperators()) {
      return true
    }

    const isQueryInvalidOrLoading =
      this.state.secondTermType === QUERY_TERM_TYPE &&
      (this.state.secondQueryInvalid || this.state.secondQueryValidating || !this.state.secondQueryValidated)
    if (isQueryInvalidOrLoading) {
      return false
    }

    const secondTermComplete = isNumber(this.state.secondInputValue) || !!this.state.secondInputValue?.length
    if (!secondTermComplete) {
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

  onSecondTermTypeChange = (secondTermType) => {
    if (secondTermType === this.state.secondTermType) {
      return
    }

    this.cancelSecondValidation()

    this.setState({
      secondTermType,
      secondInputValue: '',
      secondQueryValidating: false,
      secondQueryValidated: false,
      secondQueryInvalid: false,
      secondQueryError: '',
    })
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
        label='Meets this condition'
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
    if (isSingleValueResponse(this.props.queryResponse) && !isSingleValueResponse(response)) {
      isInvalid = true
      error = <span>The result of this query must be a single value</span>
    }

    this.setState({
      secondQueryValidating: false,
      secondQueryInvalid: isInvalid,
      secondQueryValidated: true,
      secondQueryError: error,
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
      this.setState({ secondQueryValidating: true })
    }

    clearTimeout(this.secondValidationTimeout)
    this.secondValidationTimeout = setTimeout(() => {
      this.runSecondValidation()
    }, 1000)
  }

  onSecondQueryChange = (e) => {
    const secondInputValue = e.target.value
    const newState = { secondInputValue }

    if (!secondInputValue?.length) {
      newState.secondQueryValidating = false
    }
    if (this.state.secondTermType === NUMBER_TERM_TYPE) {
      const numberRegex = /^-?(\d+\.\d+|\d+\.?\d*)(%?)$/
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
      return this.props.queryResponse?.data?.data?.text
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

      if (type === 'DATE') {
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
      return this.props.queryResponse?.data?.data?.text
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

      if (type === 'DATE') {
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
    const filters = this.state.queryFilters

    let filterText = ''
    let filterTextStrings = []
    filters.forEach((filter) => {
      const filterValue = filter.value?.trim().toLowerCase()
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
      }

      if (!queryText) {
        return ''
      }

      if (sentenceCase) {
        queryText = queryText[0].toUpperCase() + queryText.substring(1)
      }

      if (withFilters) {
        queryText = `${queryText} ${queryFiltersText}`
      }

      return queryText
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
    return (
      <div className='react-autoql-rule-input'>
        <div>
          <span
            className='data-alert-rule-query-readonly-container'
            data-for={this.props.tooltipID}
            data-tip='Editing this query is not permitted. To use a different query, simply create a new Data Alert via Data Messenger or a Dashboard.'
          >
            <Input
              label={
                this.allowOperators()
                  ? 'Trigger Alert when this query'
                  : 'Trigger Alert when new data is detected for this query'
              }
              value={this.getFormattedQueryText()}
              readOnly
              disabled
              fullWidth
            />
            {/* 
            Do we want the ability to edit this?
            <Icon type='edit' onClick={() => this.setState({ isEditingQuery: true })} /> 
          */}
          </span>
          {this.renderFilterChips()}
        </div>
      </div>
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

  renderTermValidationSection = () => {
    if (!this.shouldRenderValidationSection()) {
      return null
    }

    return <div className='rule-simple-validation-container'>{this.renderValidationError()}</div>
  }

  renderSecondTermInput = () => {
    return (
      <Input
        ref={(r) => (this.secondInput = r)}
        spellCheck={false}
        placeholder={this.getSecondInputPlaceholder()}
        value={this.state.secondInputValue}
        type={this.state.secondTermType === NUMBER_TERM_TYPE ? 'text' : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            this.props.onLastInputEnterPress()
          }
        }}
        selectOptions={[
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
        ]}
        onSelectChange={this.onSecondTermTypeChange}
        selectValue={this.state.secondTermType}
        onChange={this.onSecondQueryChange}
      />
    )
  }

  allowOperators = () => {
    return this.SUPPORTED_CONDITION_TYPES.includes(COMPARE_TYPE)
  }

  render = () => {
    if (this.props.conditionStatementOnly) {
      return null
    }

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-rule-simple
        ${this.shouldRenderValidationSection() ? 'with-query-validation' : ''}`}
          style={this.props.style}
        >
          <div className='react-autoql-rule-simple-first-query' data-test='rule'>
            <div className='react-autoql-rule-first-input-container'>{this.renderBaseQuery()}</div>
          </div>
          <div className='react-autoql-notification-rule-container' data-test='rule'>
            {this.allowOperators() && (
              <>
                <div className='react-autoql-rule-condition-select-input-container'>
                  {this.renderOperatorSelector()}
                </div>
                <div className='react-autoql-rule-second-input-container'>
                  <div className='react-autoql-rule-input'>{this.renderSecondTermInput()}</div>
                  {this.renderTermValidationSection()}
                </div>
              </>
            )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
