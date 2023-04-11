import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import parseNum from 'parse-num'
import axios from 'axios'

import { Input } from '../../Input'
import { Select } from '../../Select'
import { Icon } from '../../Icon'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication, getAutoQLConfig } from '../../../props/defaults'
import { fetchAutocomplete, runQueryOnly } from '../../../js/queryService'
import { isNumber, isSingleValueResponse } from '../../../js/Util'
import { DATA_ALERT_OPERATORS, EXISTS_TYPE, NUMBER_TERM_TYPE, QUERY_TERM_TYPE } from '../DataAlertConstants'
import { constructRTArray, getTimeFrameTextFromChunk } from '../../../js/reverseTranslationHelpers'
import { responseErrors } from '../../../js/errorMessages'

import './RuleSimple.scss'

export default class RuleSimple extends React.Component {
  autoCompleteTimer = undefined

  constructor(props) {
    super(props)

    const { initialData, queryResponse } = props

    this.SUPPORTED_OPERATORS = Object.keys(DATA_ALERT_OPERATORS)
    this.TERM_ID_1 = uuid()
    this.TERM_ID_2 = uuid()

    const state = {
      selectedOperator: this.SUPPORTED_OPERATORS[0],
      inputValue: queryResponse?.data?.data?.text ?? '',
      secondInputValue: '',
      secondTermType: NUMBER_TERM_TYPE,
      secondQueryValidating: false,
      secondQueryValidated: false,
      secondQueryInvalid: false,
      secondQueryError: '',
      isEditingQuery: false,
    }

    if (initialData) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData.length > 1 ? initialData[1].id : uuid()

      state.selectedOperator = initialData[0]?.condition ?? this.SUPPORTED_OPERATORS[0]
      state.inputValue = initialData[0]?.term_value ?? ''
      state.secondInputValue = initialData[1]?.term_value ?? ''
      state.secondTermType = initialData[1]?.term_type ?? NUMBER_TERM_TYPE
      state.secondQueryValidated = true
    }

    this.state = state
  }

  static propTypes = {
    authentication: authenticationType,
    ruleId: PropTypes.string,
    onUpdate: PropTypes.func,
    initialData: PropTypes.arrayOf(PropTypes.shape({})),
    readOnly: PropTypes.bool,
    queryResponse: PropTypes.shape({}),
    onLastInputEnterPress: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    ruleId: undefined,
    onUpdate: () => {},
    initialData: undefined,
    queryResponse: undefined,
    readOnly: false,
    onLastInputEnterPress: () => {},
  }

  componentDidMount = () => {
    this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())

    // Focus on second input if it exists. The first input will already be filled in
    this.secondInput?.focus()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!_isEqual(this.state, prevState)) {
      this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())
    }

    if (this.state.secondInputValue && this.state.secondInputValue !== prevState.secondInputValue) {
      this.validateSecondQuery()
    }
  }

  componentWillUnmount = () => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
  }

  getConditionStatement = (tense) => {
    const queryText = this.getFormattedQueryText()?.toLowerCase()
    const operator = DATA_ALERT_OPERATORS[this.state.selectedOperator]
    const operatorText = tense === 'past' ? operator?.conditionTextPast : operator?.conditionText
    let secondTermText = this.state.secondInputValue
    if (this.state.secondTermType === QUERY_TERM_TYPE) {
      secondTermText = `"${secondTermText}"`
    }

    if (queryText && operatorText && secondTermText) {
      return (
        <span className='data-alert-condition-statement'>
          "{queryText}" {operatorText} {secondTermText}
        </span>
      )
    } else if (queryText) {
      return <span className='data-alert-condition-statement'>New data detected for the query "{queryText}"</span>
    }

    return
  }

  getJSON = () => {
    const { secondInputValue } = this.state
    const userSelection = this.props.queryResponse?.data?.data?.fe_req?.disambiguation

    const expression = [
      {
        id: this.TERM_ID_1,
        term_type: QUERY_TERM_TYPE,
        condition: this.state.selectedOperator,
        term_value: this.state.inputValue,
        user_selection: userSelection,
      },
      {
        id: this.TERM_ID_2,
        term_type: this.isNumerical(secondInputValue) ? NUMBER_TERM_TYPE : QUERY_TERM_TYPE,
        condition: 'TERMINATOR',
        term_value: this.isNumerical(secondInputValue) ? parseNum(secondInputValue) : secondInputValue,
      },
    ]

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
    if (
      this.state.secondInputType === QUERY_TERM_TYPE &&
      (this.state.secondQueryInvalid || this.state.secondQueryValidating || !this.state.secondQueryValidated)
    ) {
      return false
    }

    const firstTermComplete = !!this.state.inputValue?.length
    const secondTermComplete = isNumber(this.state.secondInputValue) || !!this.state.secondInputValue?.length

    return firstTermComplete && secondTermComplete
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

  switchSecondTermType = () => {
    let secondTermType = NUMBER_TERM_TYPE
    if (this.state.secondTermType === NUMBER_TERM_TYPE) {
      secondTermType = QUERY_TERM_TYPE
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
            {operatorObj.displayName} {symbol}
          </span>
        ),
        label: operatorObj.displayName,
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
    this.axiosSource?.cancel(responseErrors.CANCELLED)
  }

  runSecondValidation = () => {
    this.axiosSource = axios.CancelToken?.source()

    runQueryOnly({
      query: this.state.secondInputValue,
      ...getAuthentication(this.props.authentication),
      ...getAutoQLConfig(this.props.autoQLConfig),
      source: 'data_alert_validation',
      pageSize: 2, // No need to fetch more than 2 rows to determine validity
      cancelToken: this.axiosSource.token,
    })
      .then((response) => {
        this.onValidationResponse(response)
      })
      .catch((error) => {
        if (error?.response?.data?.message !== responseErrors.CANCELLED) {
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
    this.setState({ secondInputValue: e.target.value })
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

        // We might want to use this later for VLs or other query filters
        // return (
        //   <>
        //     {prefix}
        //     <Chip
        //       onClick={() => {}}
        //       onDelete={() => {
        //       }}
        //     >
        //       {text}
        //     </Chip>
        //   </>
        // )
      }

      return (
        <>
          {!!prefix && this.renderRTChunk(prefix, 'VL_PREFIX', `${i}-${i}`)}
          {this.renderRTChunk(text, type, i)}
        </>
      )
    })
  }

  getFormattedQueryText = () => {
    try {
      let queryText = this.state.inputValue
      if (this.props.queryResponse) {
        queryText = this.props.queryResponse?.data?.data?.text
      }

      if (!queryText) {
        return ''
      }

      queryText = queryText[0].toUpperCase() + queryText.substring(1)
      return queryText
    } catch (error) {
      console.error(error)
      return ''
    }
  }

  renderFormattedQuery = () => {
    return (
      <div className='data-alert-rule-formatted-query'>
        <span>{this.getFormattedQueryText()}</span>
        <Icon
          type='info'
          className='data-alert-rule-tooltip-icon'
          data-for={this.props.tooltipID}
          data-tip='This query will be used to evaluate the conditions below. If the query result meets the specified conditons, an alert will be triggered.'
          data-place='right'
        />
        {/* 
        Do we want the ability to edit this?
        <Icon type='edit' onClick={() => this.setState({ isEditingQuery: true })} /> 
        */}
      </div>
    )
  }

  renderQueryDisplay = () => {
    return (
      <div className='react-autoql-rule-input'>
        {this.state.isEditingQuery ? (
          <Input
            placeholder='Type a query'
            value={this.state.inputValue}
            onChange={(e) => this.setState({ inputValue: e.target.value })}
            spellCheck={false}
            icon='react-autoql-bubbles-outlined'
          />
        ) : (
          this.renderFormattedQuery()
        )}
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

  renderTermValidationSection = () => {
    return (
      <div className='rule-simple-validation-container'>
        {this.state.secondTermType === QUERY_TERM_TYPE ? this.renderValidationError() : null}
      </div>
    )
  }

  renderSecondTermInput = () => {
    return (
      <Input
        ref={(r) => (this.secondInput = r)}
        spellCheck={false}
        placeholder={this.getSecondInputPlaceholder()}
        value={this.state.secondInputValue}
        type={this.state.secondTermType === NUMBER_TERM_TYPE ? NUMBER_TERM_TYPE : undefined}
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
        onSelectChange={this.switchSecondTermType}
        selectValue={this.state.secondTermType}
        onChange={this.onSecondQueryChange}
      />
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div style={this.props.style}>
          <div className='react-autoql-notification-rule-container' data-test='rule'>
            <div className='react-autoql-rule-first-input-container'>
              <div className='react-autoql-input-label'>Trigger Alert when</div>
              {this.renderQueryDisplay()}
            </div>
          </div>
          <div className='react-autoql-notification-rule-container' data-test='rule'>
            {this.state.selectedOperator !== EXISTS_TYPE && (
              <>
                <div className='react-autoql-rule-condition-select-input-container'>
                  <div className='react-autoql-input-label'>Meets this condition</div>
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
