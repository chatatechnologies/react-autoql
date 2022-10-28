import React from 'react'
import PropTypes from 'prop-types'
import InfiniteScroll from 'react-infinite-scroller'
import { Scrollbars } from 'react-custom-scrollbars-2'

import { QueryValidationMessage } from '../QueryValidationMessage'
import { fetchDataExplorerSuggestions } from '../../js/queryService'
import { LoadingDots } from '../LoadingDots'
import { Spinner } from '../Spinner'
import { Icon } from '../Icon'

import DEConstants from '../DataExplorer/constants'

export default class QuerySuggestionList extends React.Component {
  constructor(props) {
    super(props)

    this.pageSize = 25

    this.state = {
      queryList: undefined,
      initialLoading: false,
      loading: false,
      error: false,
      hasMore: true,
    }
  }

  static propTypes = {
    topicText: PropTypes.string,
    skipQueryValidation: PropTypes.bool,
    onSuggestionListResponse: PropTypes.func,
    executeQuery: PropTypes.func,
  }

  static defaultProps = {
    topicText: null,
    skipQueryValidation: false,
    onSuggestionListResponse: () => {},
    executeQuery: () => {},
  }

  componentDidMount = () => {
    if (this.props.topicText) {
      this.loadMore(1)
    }
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.topicText && this.props.topicText !== prevProps.topicText) {
      this.setState({ queryList: undefined }, () => {
        this.loadMore(1)
      })
    }
  }

  loadMore = (page) => {
    if (this.state.loading) {
      return
    }

    const newState = {
      validationResponse: undefined,
    }
    if (page === 1) {
      newState.initialLoading = true
      newState.hasMore = true
    } else {
      newState.loading = true
    }

    const { topicText } = this.props
    if (topicText !== this.state.keywords) {
      newState.queryList = undefined
    }

    this.setState(newState)
    fetchDataExplorerSuggestions({
      ...this.props.authentication,
      keywords: topicText,
      pageSize: this.pageSize,
      pageNumber: page,
      skipQueryValidation: this.props.skipQueryValidation,
      scope: this.props.topic?.type === DEConstants.SUBJECT_TYPE ? 'context' : 'wide',
      isRawText: this.props.topic?.type === 'text',
    })
      .then((response) => {
        this.props.onSuggestionListResponse({ response })
        const finishedState = {
          initialLoading: false,
          loading: false,
        }
        if (response?.data?.data?.replacements) {
          finishedState.validationResponse = response
        } else {
          const currentPage = response?.data?.data?.pagination?.current_page
          const totalPages = response?.data?.data?.pagination?.total_pages
          if (currentPage >= totalPages || !response?.data?.data?.items?.length) {
            finishedState.hasMore = false
          }
          const newQueries = response?.data?.data?.items || []
          if (!this.state.queryList) {
            finishedState.queryList = newQueries
          } else {
            const newQueryList = this.state.queryList.concat(newQueries)
            finishedState.queryList = newQueryList
          }
          finishedState.keywords = topicText
        }
        this.setState(finishedState)
      })
      .catch((error) => {
        this.props.onSuggestionListResponse({ error })
        this.setState({ loading: false, initialLoading: false })
        console.error(error)
      })
  }

  onValidationSuggestionClick = (queryValidationObj) => {
    this.props.onValidationSuggestionClick(queryValidationObj.query)
  }

  clearQueryList = () => {
    this.setState({
      queryList: undefined,
      validationResponse: undefined,
    })
  }

  render = () => {
    if (this.state.initialLoading) {
      return (
        <div className='data-explorer-card-placeholder'>
          <LoadingDots />
        </div>
      )
    }

    if (this.state.validationResponse) {
      return (
        <div className='data-explorer-card-placeholder'>
          <QueryValidationMessage
            response={this.state.validationResponse}
            onSuggestionClick={this.onValidationSuggestionClick}
            autoSelectSuggestion={true}
            submitText='Search'
            submitIcon='search'
          />
        </div>
      )
    }

    if (!this.state.queryList) {
      return null
    }

    if (this.state.queryList?.length === 0) {
      return (
        <div className='data-explorer-card-placeholder'>
          <p>
            Sorry, I couldn’t find any queries matching your input. Try entering a different topic or keyword instead.
          </p>
        </div>
      )
    }

    return (
      <Scrollbars
        autoHeight
        autoHeightMin={0}
        autoHeightMax={800}
        className='query-suggestion-list-scroll-component'
        renderView={(props) => (
          <div {...props} ref={(r) => (this.scrollbarRef = r)} className='data-preview-scroll-container' />
        )}
      >
        <InfiniteScroll
          pageStart={1}
          loadMore={this.loadMore}
          hasMore={this.state.hasMore}
          useWindow={false}
          initialLoad={false}
          threshold={100}
          loader={
            <div className='react-autoql-spinner-centered' key={0}>
              <Spinner style={{ width: '19px', height: '20px', color: '#999' }} />
            </div>
          }
        >
          <div className='query-suggestion-list'>
            {this.state.queryList.map((query, i) => {
              return (
                <div
                  className='query-tip-item animated-item'
                  onClick={() => this.props.executeQuery(query)}
                  key={`query-tip-${i}`}
                >
                  <div className='query-suggestion-text'>
                    <Icon type='react-autoql-bubbles-outlined' /> {query}
                  </div>
                </div>
              )
            })}
          </div>
        </InfiniteScroll>
      </Scrollbars>
    )
  }
}
