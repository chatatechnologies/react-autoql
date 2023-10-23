import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { fetchDataExplorerSuggestionsV2 } from 'autoql-fe-utils'

import SampleQuery from './SampleQuery'

import './SampleQueryList.scss'

export default class SampleQueryList extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      queryList: undefined,
      loading: true,
      error: false,
    }
  }

  static propTypes = {
    searchText: PropTypes.string,
    subject: PropTypes.shape({}),
    columns: PropTypes.shape({}),
    valueLabel: PropTypes.shape({}),
    onSuggestionListResponse: PropTypes.func,
    executeQuery: PropTypes.func,
  }

  static defaultProps = {
    searchText: '',
    subject: undefined,
    columns: {},
    valueLabel: undefined,
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
      columns: this.props.columns,
    })
      .then((response) => {
        if (this._isMounted) {
          this.props.onSuggestionListResponse()
          const finishedState = {
            loading: false,
          }

          console.log({ queryList: response?.data?.data?.suggestions, response })

          finishedState.queryList = response?.data?.data?.suggestions || []
          finishedState.keywords = searchText

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

  updateScrollbars = () => {
    this.scrollbarTimeout = setTimeout(this.infiniteScroll?.updateScrollbars, 400)
  }

  clearQueryList = () => {
    this.setState({
      queryList: undefined,
    })
  }

  renderSampleQueryPlaceholder = () => {
    const placeholderHeight = '25px'

    return (
      <div className='data-explorer-section-placeholder-loading-container'>
        <div className='data-explorer-section-placeholder-loading-item'>
          <div className='react-autoql-placeholder-loader' style={{ width: '60%', height: placeholderHeight }} />
        </div>
        <div className='data-explorer-section-placeholder-loading-item'>
          <div className='react-autoql-placeholder-loader' style={{ width: '80%', height: placeholderHeight }} />
        </div>
        <div className='data-explorer-section-placeholder-loading-item'>
          <div className='react-autoql-placeholder-loader' style={{ width: '40%', height: placeholderHeight }} />
        </div>
        <div className='data-explorer-section-placeholder-loading-item'>
          <div className='react-autoql-placeholder-loader' style={{ width: '50%', height: placeholderHeight }} />
        </div>
      </div>
    )
  }

  render = () => {
    console.log('rendering sample query list')
    if (this.state.loading) {
      return this.renderSampleQueryPlaceholder()
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
