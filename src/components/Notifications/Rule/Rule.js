import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import {
  fetchAutocomplete,
  isExpressionQueryValid,
  capitalizeFirstChar,
  authenticationDefault,
  getAuthentication,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { Input } from '../../Input'
import { Select } from '../../Select'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { authenticationType } from '../../../props/types'

import './Rule.scss'

const getInitialStateData = (initialData) => {
  if (initialData && initialData.length === 1) {
    return {
      input1Value: initialData[0].term_value,
      conditionSelectValue: 'EXISTS',
      isComplete: !!initialData?.[0]?.term_value?.length,
    }
  } else if (initialData && initialData.length > 1) {
    const input1Value = `${initialData?.[0]?.term_value ?? ''}`
    const input2Value = `${initialData?.[1]?.term_value ?? ''}`

    return {
      input1Value,
      input2Value,
      conditionSelectValue: initialData[0].condition,
      secondTermType: initialData[1].term_type,
      isComplete: !!input1Value?.length && !!input2Value?.length,
    }
  }

  return {}
}

export default class Rule extends React.Component {
  autoCompleteTimer = undefined

  constructor(props) {
    super(props)

    this.initialData = {}
    this.TERM_ID_1 = uuid()
    this.TERM_ID_2 = uuid()

    const { initialData } = props

    if (initialData && initialData.length === 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = uuid()
    } else if (initialData && initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
    }
  }

  static propTypes = {
    authentication: authenticationType,
    ruleId: PropTypes.string,
    onAdd: PropTypes.func,
    onDelete: PropTypes.func,
    onUpdate: PropTypes.func,
    initialData: PropTypes.arrayOf(PropTypes.shape({})),
    readOnly: PropTypes.bool,
    enableQueryValidation: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    ruleId: undefined,
    onAdd: () => {},
    onDelete: () => {},
    onUpdate: () => {},
    initialData: undefined,
    readOnly: false,
    enableQueryValidation: true,
  }

  state = {
    input1Value: '',
    input2Value: '',
    conditionSelectValue: 'GREATER_THAN',
    secondTermType: 'query',
    isFirstTermValid: true,
    isSecondTermValid: true,
    ...getInitialStateData(this.props.initialData),
  }

  componentDidMount = () => {
    this.props.onUpdate(this.props.ruleId, this.isComplete(), this.isValid())
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
    if (initialData.length === 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = uuid()
      this.setState({
        input1Value: initialData[0].term_value,
        conditionSelectValue: 'EXISTS',
      })
    } else if (initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
      this.setState({
        input1Value: initialData[0].term_value,
        input2Value: `${initialData[1].term_value}`,
        conditionSelectValue: initialData[0].condition,
        secondTermType: initialData[1].term_type,
      })
    }
  }

  getJSON = () => {
    if (this.state.conditionSelectValue === 'EXISTS') {
      return [
        {
          id: this.TERM_ID_1,
          term_type: 'query',
          condition: this.state.conditionSelectValue,
          term_value: this.state.input1Value,
        },
      ]
    }

    const { input2Value } = this.state
    return [
      {
        id: this.TERM_ID_1,
        term_type: 'query',
        condition: this.state.conditionSelectValue,
        term_value: this.state.input1Value,
      },
      {
        id: this.TERM_ID_2,
        term_type: this.isNumerical(input2Value) ? 'constant' : 'query',
        condition: 'TERMINATOR',
        term_value: this.isNumerical(input2Value) ? Number(input2Value) : input2Value,
      },
    ]
  }

  isNumerical = (num) => {
    return !isNaN(Number(num))
  }

  isComplete = () => {
    if (this.state.conditionSelectValue === 'EXISTS') {
      return !!this.state.input1Value
    } else {
      return !!this.state.input1Value?.length && !!this.state.input2Value?.length
    }
  }

  isValid = () => {
    if (!this.props.enableQueryValidation) {
      return true
    }

    if (this.state.conditionSelectValue === 'EXISTS') {
      return this.state.isFirstTermValid
    } else {
      return this.state.isFirstTermValid && this.state.isSecondTermValid
    }
  }

  validateFirstTerm = () => {
    if (!this.props.enableQueryValidation) {
      this.setState({
        isFirstTermValid: true,
      })
    } else if (
      this.state.input1Value &&
      !this.state.isValidatingFirstTerm &&
      this.state.lastCheckedFirstTermValue !== this.state.input1Value
    ) {
      this.setState({
        isFirstTermValid: true,
        lastCheckedFirstTermValue: this.state.input1Value,
        isValidatingFirstTerm: true,
      })
      isExpressionQueryValid({
        query: this.state.input1Value,
        ...getAuthentication(this.props.authentication),
      })
        .then(() => {
          this.setState({
            isFirstTermValid: true,
            isValidatingFirstTerm: false,
          })
        })
        .catch(() => {
          this.setState({
            isFirstTermValid: false,
            isValidatingFirstTerm: false,
          })
        })
    }
  }

  validateSecondTerm = () => {
    if (!this.props.enableQueryValidation) {
      this.setState({
        isSecondTermValid: true,
      })
    } else if (!this.state.input2Value || !isNaN(Number(this.state.input2Value))) {
      this.setState({
        isSecondTermValid: true,
        lastCheckedSecondTermValue: this.state.input2Value,
      })
    } else if (!this.state.isValidatingSecondTerm && this.state.lastCheckedSecondTermValue !== this.state.input2Value) {
      this.setState({
        isSecondTermValid: true,
        lastCheckedSecondTermValue: this.state.input2Value,
        isValidatingSecondTerm: true,
      })
      isExpressionQueryValid({
        query: this.state.input2Value,
        ...getAuthentication(this.props.authentication),
      })
        .then(() => {
          this.setState({
            isSecondTermValid: true,
            isValidatingSecondTerm: false,
          })
        })
        .catch(() => {
          this.setState({
            isSecondTermValid: false,
            isValidatingSecondTerm: false,
          })
        })
    }
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

  renderConditionOperator = (text) => {
    switch (text) {
      case 'GREATER_THAN': {
        return '>'
      }
      case 'LESS_THAN': {
        return '<'
      }
      case 'EQUAL_TO': {
        return '='
      }
      case 'EXISTS': {
        return 'Exists'
      }
    }
  }

  renderReadOnlyRule = () => {
    return (
      <ErrorBoundary>
        <div>
          <span className='read-only-rule-term'>{`${capitalizeFirstChar(this.state.input1Value)}`}</span>
          <span className='read-only-rule-term'>{`${this.renderConditionOperator(
            this.state.conditionSelectValue,
          )}`}</span>
          {this.state.conditionSelectValue !== 'EXISTS' && (
            <span className='read-only-rule-term'>{capitalizeFirstChar(this.state.input2Value)}</span>
          )}
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

  renderRule = () => {
    return (
      <ErrorBoundary>
        <div className='react-autoql-notification-rule-container' data-test='rule'>
          <div className='react-autoql-rule-input'>
            <Input
              placeholder='Type a query'
              value={this.state.input1Value}
              onChange={(e) => this.setState({ input1Value: e.target.value })}
              onBlur={this.validateFirstTerm}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  this.validateFirstTerm()
                }
              }}
            />
            {!this.state.isFirstTermValid && this.renderValidationError()}
            {
              // Keep for implementing autocomplete later
              // <div className="react-autoql-bar-container">
              //   <Autosuggest
              //   className="auto-complete-chata"
              //   onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
              //   onSuggestionsClearRequested={this.onSuggestionsClearRequested}
              //   getSuggestionValue={this.userSelectedSuggestionHandler}
              //   suggestions={this.state.suggestions}
              //   ref={ref => {
              //     this.autoSuggest = ref
              //   }}
              //   renderSuggestion={suggestion => (
              //     <>{suggestion.name}</>
              //   )}
              //   inputProps={{
              //     className: 'react-autoql-rule-input react-autoql-input',
              //     // icon:"react-autoql-bubbles-outlined"
              //     placeholder: 'query',
              //     value: this.state.input1Value,
              //     onChange: e => this.setState({ input1Value: e.target.value })
              //   }}
              // />
              // </div>
            }
          </div>
          <Select
            options={[
              { value: 'GREATER_THAN', label: '>', tooltip: 'Greater Than' },
              { value: 'LESS_THAN', label: '<', tooltip: 'Less Than' },
              { value: 'EQUAL_TO', label: '=', tooltip: 'EQUAL_TO' },
              {
                value: 'EXISTS',
                label: <span>&#8707;</span>,
                tooltip: 'Exists',
              },
            ]}
            value={this.state.conditionSelectValue}
            className='react-autoql-rule-condition-select'
            onChange={(value) => {
              this.setState({ conditionSelectValue: value })
            }}
          />
          <div
            className={`react-autoql-rule-second-input-container${
              this.state.conditionSelectValue === 'EXISTS' ? ' hidden' : ''
            }`}
          >
            <div className='react-autoql-rule-input'>
              <Input
                placeholder='Type a query or number'
                value={this.state.input2Value}
                onChange={(e) => this.setState({ input2Value: e.target.value })}
                onBlur={this.validateSecondTerm}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    this.validateSecondTerm()
                  }
                }}
              />
              {!this.state.isSecondTermValid && this.renderValidationError()}
              {
                // Keep for implementing autocomplete later
                // <Input
                //   className="react-autoql-rule-input"
                //   icon="react-autoql-bubbles-outlined"
                //   type={inputType}
                //   placeholder={inputType === CustomColumnTypes.NUMBER ? 'Constant' : 'Query'}
                //   value={this.state.input2Value}
                //   onChange={e => this.setState({ input2Value: e.target.value })}
                // />
                // <Select
                //   options={[
                //     {
                //       value: 'query',
                //       label: (
                //         <Icon
                //           type="react-autoql-bubbles-outlined"
                //           className="rule-input-select-bubbles-icon"
                //         />
                //       ),
                //       tooltip: 'Query'
                //     },
                //     {
                //       value: 'constant',
                //       // label: <Icon type="numbers" style={{ fontSize: '20px' }} />
                //       label: <div style={{ fontSize: '9px' }}>123</div>,
                //       tooltip: 'Constant'
                //     }
                //     // { value: 'equation', label: 'Eq' }
                //   ]}
                //   value={this.state.secondTermType}
                //   className="react-autoql-rule-term-type-selector"
                //   onChange={value => {
                //     this.setState({ secondTermType: value })
                //   }}
                // />
              }
            </div>
          </div>
          <Icon
            className='react-autoql-rule-delete-btn'
            type='close'
            data-tooltip-content='Remove Condition'
            data-tooltip-id='notification-expression-tooltip'
            onClick={() => {
              this.props.onDelete(this.props.ruleId)
            }}
          />
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
