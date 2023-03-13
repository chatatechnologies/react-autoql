import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import parseNum from 'parse-num'

import { Input } from '../../Input'
import { Select } from '../../Select'
import { Icon } from '../../Icon'
import { Chip } from '../../Chip'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'
import { fetchAutocomplete } from '../../../js/queryService'
import { capitalizeFirstChar, isSingleValueResponse } from '../../../js/Util'
import { DATA_ALERT_OPERATORS } from '../../../js/Constants'
import { constructRTArray, getTimeFrameTextFromChunk, getTimeRangeFromRT } from '../../../js/reverseTranslationHelpers'

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
      input1Value: initialData?.[0]?.term_value ?? queryResponse?.data?.data?.text ?? '',
      input2Value: initialData?.[1]?.term_value ?? '',
      isEditingQuery: false,
      selectedOperator: this.supportedOperators?.[0],
      secondTermType: this.supportedSecondTermTypes?.[0],
      isFirstTermValid: true,
      isSecondTermValid: true,
      secondInputType: 'number',
      userSelection: initialData?.[0].user_selection,
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
    //     input1Value: initialData[0].term_value,
    //     selectedOperator: 'EXISTS',
    //   })
    // } else
    if (initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
      this.setState({
        input1Value: initialData[0].term_value,
        input2Value: `${initialData[1].term_value}`,
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
    //       term_value: this.state.input1Value,
    //       user_selection: this.state.userSelection,
    //     },
    //   ]
    // }

    const { input2Value } = this.state
    return [
      {
        id: this.TERM_ID_1,
        term_type: 'query',
        condition: this.state.selectedOperator,
        term_value: this.state.input1Value,
        user_selection: this.state.userSelection,
      },
      {
        id: this.TERM_ID_2,
        term_type: this.isNumerical(input2Value) ? 'constant' : 'query',
        condition: 'TERMINATOR',
        term_value: this.isNumerical(input2Value) ? parseNum(input2Value) : input2Value,
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
    return !!this.state.input1Value?.length && !!this.state.input2Value?.length
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

    this.setState({ secondInputType, input2Value: '' })
  }

  renderReadOnlyRule = () => {
    const operator = this.state.selectedOperator
    return (
      <ErrorBoundary>
        <div>
          <span className='read-only-rule-term'>{`${capitalizeFirstChar(this.state.input1Value)}`}</span>
          <span className='read-only-rule-term'>{DATA_ALERT_OPERATORS[operator].displayName}</span>
          <span className='read-only-rule-term'>{capitalizeFirstChar(this.state.input2Value)}</span>
          {this.props.andOrValue && <span className='read-only-rule-term'>{this.props.andOrValue}</span>}
        </div>
      </ErrorBoundary>
    )
  }

  renderValidationError = () => {
    return (
      <div className='expression-term-validation-error'>
        <Icon type='warning-triangle' /> That query is invalid. Try entering a different query.
      </div>
    )
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
          data-tip='This query will be used to evaluate the conditions below. If the result meets the specified conditons, an alert will be triggered.'
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
    const query = this.props.queryResponse?.data?.data?.text
    return (
      <div className='react-autoql-rule-input'>
        {this.state.isEditingQuery ? (
          <Input
            placeholder='Type a query'
            value={this.state.input1Value}
            onChange={(e) => this.setState({ input1Value: e.target.value })}
            spellCheck={false}
            icon='react-autoql-bubbles-outlined'
          />
        ) : (
          this.renderFormattedQuery()
        )}

        {!this.state.isFirstTermValid && this.renderValidationError()}
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
                    value={this.state.input2Value}
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
                    onChange={(e) => this.setState({ input2Value: e.target.value })}
                  />
                  {!this.state.isSecondTermValid && this.renderValidationError()}
                </div>
              </div>
              {/* <div className='rule-second-input-type-select' onClick={this.switchSecondInputType}>
                <span>Use {secondInputOtherType} instead</span>
              </div> */}
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
