import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import InfiniteScroll from 'react-infinite-scroller'
import ReactTooltip from 'react-tooltip'

import { QueryValidationMessage } from '../QueryValidationMessage'
import { fetchExploreQueries } from '../../js/queryService'
import { CustomScrollbars } from '../CustomScrollbars'
import { LoadingDots } from '../LoadingDots'
import { Spinner } from '../Spinner'
import { Icon } from '../Icon'

import './ExploreQueries.scss'

export default class ExploreQueries extends React.Component {
  constructor(props) {
    super(props)

    this.pageSize = 25

    this.state = {
      inputValue: '',
      keywords: '',
      queryList: undefined,
      initialLoading: false,
      loading: false,
      error: false,
      hasMore: true,
    }
  }

  static propTypes = {
    shouldRender: PropTypes.bool,
    executeQuery: PropTypes.func,
    inputPlaceholder: PropTypes.string,
  }

  static defaultProps = {
    shouldRender: true,
    executeQuery: () => {},
    inputPlaceholder: 'Search relevant queries by topic',
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.shouldRender && !prevProps.shouldRender) {
      this.inputRef?.focus()
    }
  }

  loadMore = (page, skipQueryValidation) => {
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

    const inputValue = this.state.inputValue
    if (inputValue !== this.state.keywords) {
      newState.queryList = undefined
    }

    this.setState(newState)

    fetchExploreQueries({
      ...this.props.authentication,
      keywords: inputValue,
      pageSize: this.pageSize,
      pageNumber: page,
      skipQueryValidation,
    })
      .then((response) => {
        const finishedState = {
          initialLoading: false,
          loading: false,
        }

        if (response?.data?.data?.replacements) {
          finishedState.validationResponse = response
        } else {
          const currentPage = response?.data?.data?.pagination?.current_page
          const totalPages = response?.data?.data?.pagination?.total_pages
          if (
            currentPage >= totalPages ||
            !response?.data?.data?.items?.length
          ) {
            finishedState.hasMore = false
          }

          const newQueries = response?.data?.data?.items || []
          if (!this.state.queryList) {
            finishedState.queryList = newQueries
          } else {
            const newQueryList = this.state.queryList.concat(newQueries)
            finishedState.queryList = newQueryList
          }
          finishedState.keywords = inputValue
        }

        this.setState(finishedState)
      })
      .catch((error) => {
        this.setState({ loading: false, initialLoading: false })
        console.error(error)
      })
  }

  onInputChange = (e) => {
    this.setState({ inputValue: e.target.value })
  }

  onKeyPress = (e) => {
    if (e.key == 'Enter') {
      this.loadMore(1)
    }
  }

  onValidationSuggestionClick = (queryValidationObj) => {
    const keywords = queryValidationObj.query
    this.animateQITextAndSubmit(keywords)
  }

  animateQITextAndSubmit = (text) => {
    if (typeof text === 'string' && text?.length) {
      clearTimeout(this.animateTextTimeout)
      for (let i = 1; i <= text.length; i++) {
        this.animateTextTimeout = setTimeout(() => {
          this.setState(
            {
              inputValue: text.slice(0, i),
            },
            () => {
              if (i === text.length) {
                this.loadMore(1)
              }
            }
          )
        }, i * 50)
      }
    }
  }

  clearExploreQueries = () => {
    this.setState(
      {
        keywords: '',
        inputValue: '',
        queryList: undefined,
        validationResponse: undefined,
      },
      () => {
        this.inputRef?.focus()
      }
    )
  }

  renderQueryList = () => {
    if (this.state.initialLoading) {
      return (
        <div className="query-tips-result-placeholder">
          <LoadingDots />
        </div>
      )
    }

    if (this.state.validationResponse) {
      return (
        <div className="query-tips-result-placeholder">
          <QueryValidationMessage
            response={this.state.validationResponse}
            onSuggestionClick={this.onValidationSuggestionClick}
            autoSelectSuggestion={true}
            submitText="Search"
            submitIcon="search"
          />
        </div>
      )
    }

    if (!this.state.queryList) {
      return (
        <div className="query-tips-result-placeholder">
          <h2>Welcome to Explore Queries</h2>
          <p>
            Discover what you can ask by entering a topic in the search bar
            above.
          </p>
          <p>
            Simply click on any of the returned options to run the query in Data
            Messenger.
          </p>
        </div>
      )
    }

    if (this.state.queryList?.length === 0) {
      return (
        <div className="query-tips-result-placeholder">
          <p>
            Sorry, I couldn’t find any queries matching your input. Try entering
            a different topic or keyword instead.
          </p>
        </div>
      )
    }

    return (
      <CustomScrollbars>
        <InfiniteScroll
          pageStart={1}
          loadMore={this.loadMore}
          hasMore={this.state.hasMore}
          useWindow={false}
          initialLoad={false}
          threshold={100}
          loader={
            <div className="loader" key={0}>
              <Spinner
                style={{ width: '19px', height: '20px', color: '#999' }}
              />
            </div>
          }
        >
          {this.state.queryList.map((query, i) => {
            return (
              <div
                className="query-tip-item animated-item"
                onClick={() => this.props.executeQuery(query)}
                key={`query-tip-${i}`}
                style={{ display: 'block' }}
              >
                {query}
              </div>
            )
          })}
        </InfiniteScroll>
      </CustomScrollbars>
    )
  }

  render = () => {
    if (!this.props.shouldRender) {
      return null
    }

    return (
      <ErrorBoundary>
        <div
          ref={(r) => (this.exploreQueriesPage = r)}
          className="query-tips-page-container"
          data-test="query-tips-tab"
        >
          <div
            className="react-autoql-chatbar-input-container"
            style={{ animation: 'slideDown 0.5s ease' }}
          >
            <input
              className="react-autoql-chatbar-input left-padding right-padding"
              placeholder={this.props.inputPlaceholder}
              value={this.state.inputValue}
              onChange={this.onInputChange}
              onKeyPress={this.onKeyPress}
              ref={(ref) => (this.inputRef = ref)}
              autoFocus
            />
            <div className="chat-bar-input-icon">
              <Icon
                type="search"
                style={{
                  width: '19px',
                  height: '20px',
                  color: 'var(--react-autoql-text-color-placeholder)',
                }}
              />
            </div>
            <div
              className={`chat-bar-clear-btn ${
                this.state.queryList?.length || this.state.inputValue
                  ? 'visible'
                  : ''
              }`}
              data-for="explore-queries-tooltips"
              data-tip="Clear Search"
            >
              <Icon type="close" onClick={this.clearExploreQueries} />
            </div>
          </div>
          <div className="query-tips-result-container">
            {this.renderQueryList()}
          </div>
        </div>
        <ReactTooltip
          className="react-autoql-tooltip"
          id="explore-queries-tooltips"
          delayShow={800}
          effect="solid"
        />
      </ErrorBoundary>
    )
  }
}
