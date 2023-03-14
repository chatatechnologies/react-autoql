import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import parseNum from 'parse-num'
import axios from 'axios'

import { Input } from '../../Input'
import { Select } from '../../Select'
import { Icon } from '../../Icon'
import { Chip } from '../../Chip'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication, getAutoQLConfig } from '../../../props/defaults'
import { fetchAutocomplete, runQueryOnly } from '../../../js/queryService'
import { capitalizeFirstChar, isSingleValueResponse } from '../../../js/Util'
import { DATA_ALERT_OPERATORS } from '../../../js/Constants'
import { constructRTArray, getTimeFrameTextFromChunk } from '../../../js/reverseTranslationHelpers'
import { responseErrors } from '../../../js/errorMessages'

import './RuleSimpleV2.scss'

export default class RuleSimpleV2 extends React.Component {
  autoCompleteTimer = undefined

  constructor(props) {
    super(props)

    this.initialData = {}
    this.TERM_ID_1 = uuid()
    this.TERM_ID_2 = uuid()

    const { initialData, queryResponse } = props

    this.supportedOperators = Object.keys(DATA_ALERT_OPERATORS)
    this.supportedSecondTermTypes = this.getSupportedSecondTermTypes(queryResponse)

    if (initialData && initialData.length === 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = uuid()
    } else if (initialData && initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
    }

    this.state = {
      selectedOperator: this.supportedOperators?.[0],
      userSelection: initialData?.[0].user_selection,
      inputValue: initialData?.[0]?.term_value ?? queryResponse?.data?.data?.text ?? '',
      secondInputValue: initialData?.[1]?.term_value ?? '',
      secondInputType: 'number',
      secondTermType: this.supportedSecondTermTypes?.[0],
      secondQueryValidating: false,
      secondQueryValidated: false,
      secondQueryInvalid: false,
      secondQueryError: '',
      isEditingQuery: false,
    }
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

  parseJSON = (initialData) => {
    // if (initialData.length === 1) {
    //   console.log('initialData exists.. setting condition to EXISTS')
    //   this.TERM_ID_1 = initialData[0].id
    //   this.TERM_ID_2 = uuid()
    //   this.setState({
    //     inputValue: initialData[0].term_value,
    //     selectedOperator: 'EXISTS',
    //   })
    // } else
    if (initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
      this.setState({
        inputValue: initialData[0].term_value,
        secondInputValue: `${initialData[1].term_value}`,
        selectedOperator: initialData[0].condition,
        secondTermType: initialData[1].term_type,
      })
    }
  }

  getJSON = () => {
    // if (this.state.selectedOperator === 'EXISTS') {
    //   return [
    //     {
    //       id: this.TERM_ID_1,
    //       term_type: 'query',
    //       condition: this.state.selectedOperator,
    //       term_value: this.state.inputValue,
    //       user_selection: this.state.userSelection,
    //     },
    //   ]
    // }

    const { secondInputValue } = this.state
    return [
      {
        id: this.TERM_ID_1,
        term_type: 'query',
        condition: this.state.selectedOperator,
        term_value: this.state.inputValue,
        user_selection: this.state.userSelection,
      },
      {
        id: this.TERM_ID_2,
        term_type: this.isNumerical(secondInputValue) ? 'constant' : 'query',
        condition: 'TERMINATOR',
        term_value: this.isNumerical(secondInputValue) ? parseNum(secondInputValue) : secondInputValue,
        user_selection: this.state.userSelection,
      },
    ]
  }

  isNumerical = (num) => {
    try {
      if (typeof num === 'number') {
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
      this.state.secondInputType === 'query' &&
      (this.state.secondQueryInvalid || this.state.secondQueryValidating || !this.state.secondQueryValidated)
    ) {
      return false
    }

    return !!this.state.inputValue?.length && !!this.state.secondInputValue?.length
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

  getSupportedSecondTermTypes = (queryResponse) => {
    if (isSingleValueResponse(queryResponse)) {
      return ['constant']
    }
  }

  switchSecondInputType = () => {
    let secondInputType = 'number'
    if (this.state.secondInputType === 'number') {
      secondInputType = 'query'
    }

    this.cancelSecondValidation()

    this.setState({
      secondInputType,
      secondInputValue: '',
      secondQueryValidating: false,
      secondQueryValidated: false,
      secondQueryInvalid: false,
      secondQueryError: '',
    })
  }

  renderReadOnlyRule = () => {
    const operator = this.state.selectedOperator
    return (
      <ErrorBoundary>
        <div>
          <span className='read-only-rule-term'>{`${capitalizeFirstChar(this.state.inputValue)}`}</span>
          <span className='read-only-rule-term'>{DATA_ALERT_OPERATORS[operator].displayName}</span>
          <span className='read-only-rule-term'>{capitalizeFirstChar(this.state.secondInputValue)}</span>
          {this.props.andOrValue && <span className='read-only-rule-term'>{this.props.andOrValue}</span>}
        </div>
      </ErrorBoundary>
    )
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
    const options = this.supportedOperators?.map((operator) => {
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
      // userSelection, // TODO: SEND IN USER SELECTION FROM ORIGINAL QUERY
      ...getAuthentication(this.props.authentication),
      ...getAutoQLConfig(this.props.autoQLConfig),
      // source: newSource, // TODO
      // filters: this.props.queryFilters, // TODO
      pageSize: 2, // No need to fetch more than 2 rows to determine validity
      cancelToken: this.axiosSource.token,
    })
      .then((response) => {
        this.onValidationResponse(response)
      })
      .catch((error) => {
        console.log({ errorResponse: error?.response, errorMessage: error?.message })
        if (error?.response?.data?.message === responseErrors.CANCELLED) {
          console.log('CANCELLED... CONTINUE VALIDATING')
        } else {
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
    console.log('ON SECND QUERY CHANGE', e.target.value)
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

    console.log({ rtArray })

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
        console.log({ timeFrame })
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

        // return (
        //   <>
        //     {prefix}
        //     <Chip
        //       onClick={() => {}}
        //       onDelete={() => {
        //         console.log('DELETED VALUE LABEL')
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

  renderFormattedQuery = () => {
    let queryText = this.props.queryResponse?.data?.data?.text
    queryText = queryText[0].toUpperCase() + queryText.substring(1)
    return (
      <div className='data-alert-rule-formatted-query'>
        <span>{queryText}</span>
        {/* <span>{this.renderChunkedInterpretation()} </span> */}
        <Icon
          type='info'
          className='data-alert-rule-tooltip-icon'
          data-for={this.props.tooltipID}
          data-tip='This query will be used to evaluate the conditions below. If the query result meets the specified conditons, an alert will be triggered.'
          // data-tip={`This is how AutoQL interpreted the query "${this.props.queryResponse?.data?.data?.text}".<br /><br />If there was a date or time frame in the original query, you will be able to configure that in the next step.`}
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
    const { secondInputType } = this.state
    const { queryResponse } = this.props

    if (secondInputType === 'number') {
      return 'Type a number'
      // let numberPlaceholder = 'Type a number'

      // if (isSingleValueResponse(queryResponse)) {
      //   const value = queryResponse?.data?.data?.rows?.[0]?.[0]
      //   if (value) numberPlaceholder = `ie. "${value}"`
      // }

      // return numberPlaceholder
    } else if (secondInputType === 'query') {
      return 'Type a query'
      // let queryPlaceholder = 'Type a query'
      // let query = this.getChunkedInterpretationText()

      // if (query) {
      //   const timeFrame = getTimeRangeFromRT(queryResponse)
      //   if (timeFrame) {
      //     if (timeFrame === 'DAY') query = `${query} yesterday`
      //     if (timeFrame === 'WEEK') query = `${query} last week`
      //     if (timeFrame === 'MONTH') query = `${query} last month`
      //     if (timeFrame === 'YEAR') query = `${query} last year`
      //   }

      //   queryPlaceholder = `ie. "${query.toLowerCase()}"`
      // }

      // return queryPlaceholder
    }
  }

  renderTermValidationSection = () => {
    return (
      <div className='rule-simple-validation-container'>
        {this.state.secondInputType === 'query' ? this.renderValidationError() : null}
      </div>
    )
  }

  renderRule = () => {
    return (
      <ErrorBoundary>
        <div className='react-autoql-notification-rule-container' data-test='rule'>
          <div className='react-autoql-rule-first-input-container'>
            <div className='react-autoql-input-label'>Trigger Alert when</div>
            {this.renderQueryDisplay()}
          </div>
        </div>
        <div className='react-autoql-notification-rule-container' data-test='rule'>
          {this.state.selectedOperator !== 'EXISTS' && (
            <>
              <div className='react-autoql-rule-condition-select-input-container'>
                <div className='react-autoql-input-label'>Meets this condition</div>
                {this.renderOperatorSelector()}
              </div>
              <div className='react-autoql-rule-second-input-container'>
                <div className='react-autoql-rule-input'>
                  <Input
                    ref={(r) => (this.secondInput = r)}
                    spellCheck={false}
                    placeholder={this.getSecondInputPlaceholder()}
                    value={this.state.secondInputValue}
                    type={this.state.secondInputType === 'number' ? 'number' : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        this.props.onLastInputEnterPress()
                      }
                    }}
                    selectOptions={[
                      {
                        value: 'number',
                        label: (
                          <span>
                            this <strong>number:</strong>
                          </span>
                        ),
                        // listLabel: (
                        //   <span>
                        //     <Icon type='number' />
                        //     &nbsp;&nbsp;this number
                        //   </span>
                        // ),
                      },
                      {
                        value: 'query',
                        label: (
                          <span>
                            the result of this <strong>query:</strong>
                          </span>
                        ),
                        // listLabel: (
                        //   <span>
                        //     <Icon type='react-autoql-bubbles-outlined' />
                        //     &nbsp;&nbsp;the result of this query
                        //   </span>
                        // ),
                      },
                    ]}
                    onSelectChange={this.switchSecondInputType}
                    selectValue={this.state.secondInputType}
                    onChange={this.onSecondQueryChange}
                  />
                </div>
                {this.renderTermValidationSection()}
              </div>
            </>
          )}
        </div>
      </ErrorBoundary>
    )
  }

  render = () => {
    if (this.props.readOnly) {
      return this.renderReadOnlyRule()
    }

    return this.renderRule()
  }
}
