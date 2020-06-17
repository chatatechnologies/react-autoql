import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import isEqual from 'lodash.isequal'
import Autosuggest from 'react-autosuggest'
import uuid from 'uuid'
import _get from 'lodash.get'

import { Input } from '../../Input'
import { Select } from '../../Select'
import { Icon } from '../../Icon'

import { fetchAutocomplete } from '../../../js/queryService'
import { capitalizeFirstChar } from '../../../js/Util'

import './Rule.scss'

const getInitialStateData = initialData => {
  if (initialData && initialData.length === 1) {
    return {
      input1Value: initialData[0].term_value,
      conditionSelectValue: 'EXISTS',
      isComplete: !!_get(initialData[0].term_value, 'length'),
    }
  } else if (initialData && initialData.length > 1) {
    const input1Value = `${_get(initialData, '[0].term_value', '')}`
    const input2Value = `${_get(initialData, '[1].term_value', '')}`

    return {
      input1Value,
      input2Value,
      conditionSelectValue: initialData[0].condition,
      secondTermType: initialData[1].term_type,
      isComplete:
        !!_get(input1Value, 'length') && !!_get(input2Value, 'length'),
    }
  }

  return {}
}

export default class Rule extends React.Component {
  autoCompleteTimer = undefined

  constructor(props) {
    super(props)

    this.initialData = {}
    this.TERM_ID_1 = uuid.v4()
    this.TERM_ID_2 = uuid.v4()

    const { initialData } = props

    if (initialData && initialData.length === 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = uuid.v4()
    } else if (initialData && initialData.length > 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = initialData[1].id
    }
  }

  static propTypes = {
    ruleId: PropTypes.string,
    onAdd: PropTypes.func,
    onDelete: PropTypes.func,
    onUpdate: PropTypes.func,
    initialData: PropTypes.arrayOf(PropTypes.shape({})),
    readOnly: PropTypes.bool,
  }

  static defaultProps = {
    ruleId: undefined,
    onAdd: () => {},
    onDelete: () => {},
    onUpdate: () => {},
    initialData: undefined,
    readOnly: false,
  }

  state = {
    input1Value: '',
    input2Value: '',
    conditionSelectValue: 'GREATER_THAN',
    secondTermType: 'query',
    ...getInitialStateData(this.props.initialData),
  }

  componentDidMount = () => {
    this.props.onUpdate(this.props.ruleId, this.isComplete())
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!isEqual(this.state, prevState)) {
      this.props.onUpdate(this.props.ruleId, this.isComplete())
    }
  }

  componentWillUnmount = () => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
  }

  parseJSON = initialData => {
    if (initialData.length === 1) {
      this.TERM_ID_1 = initialData[0].id
      this.TERM_ID_2 = uuid.v4()
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
        term_value: this.isNumerical(input2Value)
          ? Number(input2Value)
          : input2Value,
      },
    ]
  }

  isNumerical = num => {
    return !Number.isNaN(Number(num))
  }

  isComplete = () => {
    if (this.state.conditionSelectValue === 'EXISTS') {
      return !!this.state.input1Value
    } else {
      return (
        !!_get(this.state.input1Value, 'length') &&
        !!_get(this.state.input2Value, 'length')
      )
    }
  }

  userSelectedSuggestionHandler = userSelectedValueFromSuggestionBox => {
    if (
      userSelectedValueFromSuggestionBox &&
      userSelectedValueFromSuggestionBox.name
    ) {
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
        ...this.props.authentication,
        ...this.props.autoQLConfig,
        suggestion: value,
      })
        .then(response => {
          const body = response.data

          const sortingArray = []
          let suggestionsMatchArray = []
          let autoCompleteArray = []
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
        .catch(error => {
          console.error(error)
        })
    }, 500)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  renderConditionOperator = text => {
    switch (text) {
      case 'GREATER_THAN': {
        return '>'
      }
      case 'LESS_THAN': {
        return '<'
      }
      case 'EQUALS': {
        return '='
      }
      case 'EXISTS': {
        return 'Exists'
      }
    }
  }

  renderReadOnlyRule = () => {
    return (
      <div>
        <span className="read-only-rule-term">{`${capitalizeFirstChar(
          this.state.input1Value
        )}`}</span>
        <span className="read-only-rule-term">{`${this.renderConditionOperator(
          this.state.conditionSelectValue
        )}`}</span>
        {this.state.conditionSelectValue !== 'EXISTS' && (
          <span className="read-only-rule-term">
            {capitalizeFirstChar(this.state.input2Value)}
          </span>
        )}
        {this.props.andOrValue && (
          <span className="read-only-rule-term">{this.props.andOrValue}</span>
        )}
      </div>
    )
  }

  renderRule = () => {
    return (
      <div className="chata-notification-rule-container" data-test="rule">
        <Input
          className="chata-rule-input"
          icon="chata-bubbles-outlined"
          placeholder="Query"
          value={this.state.input1Value}
          onChange={e => this.setState({ input1Value: e.target.value })}
        />
        {
          // <div className="chata-bar-container">
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
          //     <Fragment>{suggestion.name}</Fragment>
          //   )}
          //   inputProps={{
          //     className: 'chata-rule-input chata-input',
          //     // icon:"chata-bubbles-outlined"
          //     placeholder: 'query',
          //     value: this.state.input1Value,
          //     onChange: e => this.setState({ input1Value: e.target.value })
          //   }}
          // />
          // </div>
        }
        <Select
          options={[
            { value: 'GREATER_THAN', label: '>', tooltip: 'Greater Than' },
            { value: 'LESS_THAN', label: '<', tooltip: 'Less Than' },
            { value: 'EQUALS', label: '=', tooltip: 'Equals' },
            { value: 'EXISTS', label: <span>&#8707;</span>, tooltip: 'EXISTS' },
          ]}
          value={this.state.conditionSelectValue}
          className="chata-rule-condition-select"
          onChange={value => {
            this.setState({ conditionSelectValue: value })
          }}
        />
        <div
          className={`chata-rule-second-input-container${
            this.state.conditionSelectValue === 'EXISTS' ? ' hidden' : ''
          }`}
        >
          <Input
            className="chata-rule-input"
            icon="chata-bubbles-outlined"
            placeholder="Query or Number"
            value={this.state.input2Value}
            onChange={e => this.setState({ input2Value: e.target.value })}
          />
          {
            // <Input
            //   className="chata-rule-input"
            //   icon="chata-bubbles-outlined"
            //   type={inputType}
            //   placeholder={inputType === 'number' ? 'Constant' : 'Query'}
            //   value={this.state.input2Value}
            //   onChange={e => this.setState({ input2Value: e.target.value })}
            // />
            // <Select
            //   options={[
            //     {
            //       value: 'query',
            //       label: (
            //         <Icon
            //           type="chata-bubbles-outlined"
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
            //   className="chata-rule-term-type-selector"
            //   onChange={value => {
            //     this.setState({ secondTermType: value })
            //   }}
            // />
          }
        </div>
        <Icon
          className="chata-rule-delete-btn"
          type="close"
          onClick={() => {
            this.props.onDelete(this.props.ruleId)
          }}
        />
      </div>
    )
  }

  render = () => {
    if (this.props.readOnly) {
      return this.renderReadOnlyRule()
    }
    return this.renderRule()
  }
}
