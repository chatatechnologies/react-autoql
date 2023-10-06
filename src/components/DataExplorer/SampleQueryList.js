import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { fetchDataExplorerSuggestionsV2 } from 'autoql-fe-utils'

import { QueryValidationMessage } from '../QueryValidationMessage'
import { LoadingDots } from '../LoadingDots'
import SampleQuery from './SampleQuery'

import './SampleQueryList.scss'

export default class SampleQueryList extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      queryList: undefined,
      loading: false,
      error: false,
    }
  }

  static propTypes = {
    searchText: PropTypes.string,
    subject: PropTypes.shape({}),
    columns: PropTypes.array,
    valueLabel: PropTypes.shape({}),
    skipQueryValidation: PropTypes.bool,
    onSuggestionListResponse: PropTypes.func,
    executeQuery: PropTypes.func,
  }

  static defaultProps = {
    searchText: '',
    subject: undefined,
    columns: [],
    valueLabel: undefined,
    skipQueryValidation: false,
    onSuggestionListResponse: () => {},
    executeQuery: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.getSampleQueries()
  }

  componentDidUpdate = (prevProps) => {
    if (
      (this.props.searchText && this.props.searchText !== prevProps.searchText) ||
      this.props.context !== prevProps.context ||
      !_isEqual(this.props.valueLabel, prevProps.valueLabel) ||
      !_isEqual(this.props.columns, prevProps.columns)
    ) {
      this.setState({ queryList: undefined }, () => {
        this.getSampleQueries()
      })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false

    clearTimeout(this.scrollbarTimeout)
  }

  getSampleQueries = () => {
    if (this.props.hidden || (!this.props.searchText && !this.props.context && !this.props.valueLabel)) {
      return
    }

    const newState = {
      loading: true,
      validationResponse: undefined,
    }

    const { searchText } = this.props
    if (searchText !== this.state.keywords) {
      newState.queryList = undefined
    }

    this.setState(newState)

    return fetchDataExplorerSuggestionsV2({
      ...this.props.authentication,
      text: this.props.searchText,
      selectedVL: this.props.valueLabel,
      userVLSelection: this.props.userSelection,
      context: this.props.context,
      skipQueryValidation: this.props.skipQueryValidation,
    })
      .then((response) => {
        if (this._isMounted) {
          this.props.onSuggestionListResponse({ response })
          const finishedState = {
            loading: false,
          }
          if (response?.data?.data?.replacements) {
            finishedState.validationResponse = response
          } else {
            finishedState.queryList = response?.data?.data?.suggestions || []
            finishedState.keywords = searchText
          }

          return this.setState(finishedState)
        }
      })
      .catch((error) => {
        console.error(error)
        if (this._isMounted) {
          this.props.onSuggestionListResponse({ error })
          return this.setState({ loading: false })
        }
      })
  }

  onValidationSuggestionClick = (queryValidationObj) => {
    this.props.onValidationSuggestionClick(queryValidationObj)
  }

  updateScrollbars = () => {
    this.scrollbarTimeout = setTimeout(this.infiniteScroll?.updateScrollbars, 400)
  }

  clearQueryList = () => {
    this.setState({
      queryList: undefined,
      validationResponse: undefined,
    })
  }

  render = () => {
    if (this.state.loading) {
      return (
        <div className='data-explorer-section-placeholder'>
          <LoadingDots />
        </div>
      )
    }

    if (this.state.validationResponse) {
      return (
        <div className='data-explorer-section-placeholder'>
          <QueryValidationMessage
            response={this.state.validationResponse}
            onSuggestionClick={this.onValidationSuggestionClick}
            autoSelectSuggestion={true}
            submitText='Search'
            submitIcon='search'
            scope={this.props.scope}
          />
        </div>
      )
    }

    if (!this.state.queryList) {
      return null
    }

    if (this.state.queryList?.length === 0) {
      return (
        <div className='data-explorer-section-placeholder'>
          <p>
            Sorry, I couldn’t find any queries matching your input. Try entering a different topic or keyword instead.
          </p>
        </div>
      )
    }

    return (
      <div className='query-suggestion-list'>
        {this.state.queryList.map((suggestion, i) => {
          return (
            <SampleQuery
              key={i}
              authentication={this.props.authentication}
              valueLabel={this.props.valueLabel}
              suggestion={suggestion}
              executeQuery={this.props.executeQuery}
              tooltipID={this.props.tooltipID}
              context={this.props.context}
              shouldRender={this.props.shouldRender}
            />
          )
        })}
      </div>
    )
  }
}
