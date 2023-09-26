import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { fetchDataExplorerSuggestionsV2 } from 'autoql-fe-utils'

import { QueryValidationMessage } from '../QueryValidationMessage'
import { LoadingDots } from '../LoadingDots'

import './SampleQueryList.scss'

export default class QuerySuggestionList extends React.Component {
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
    columns: [],
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

  getSampleQueries = () => {
    if (this.props.hidden || (!this.props.searchText && !this.props.context && !this.props.valueLabel)) {
      return
    }

    const newState = {
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
        this.props.onSuggestionListResponse({ response })
        const finishedState = {
          loading: false,
        }
        if (response?.data?.data?.replacements) {
          finishedState.validationResponse = response
        } else {
          const newQueries = response?.data?.data?.suggestions || []
          if (!this.state.queryList) {
            finishedState.queryList = newQueries
          } else {
            const newQueryList = this.state.queryList.concat(newQueries)
            finishedState.queryList = newQueryList
          }
          finishedState.keywords = searchText
        }

        this.setState(finishedState)
        return
      })
      .catch((error) => {
        console.error(error)
        this.props.onSuggestionListResponse({ error })
        this.setState({ loading: false })
        return
      })
  }

  onValidationSuggestionClick = (queryValidationObj) => {
    this.props.onValidationSuggestionClick(queryValidationObj)
  }

  updateScrollbars = () => {
    setTimeout(this.infiniteScroll?.updateScrollbars, 400)
  }

  clearQueryList = () => {
    this.setState({
      queryList: undefined,
      validationResponse: undefined,
    })
  }

  renderSampleQuery = (suggestion) => {
    const queryText = suggestion.query
    const selectValues = suggestion.values

    return queryText
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
        {this.state.queryList.map((query, i) => {
          return (
            <div className='data-explorer-sample-query' key={`sample-query-${i}`}>
              <div className='query-suggestion-text'>{this.renderSampleQuery(query)}</div>
            </div>
          )
        })}
      </div>
    )
  }
}
