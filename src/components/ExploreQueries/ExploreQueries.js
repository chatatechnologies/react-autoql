import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { QueryValidationMessage } from '../QueryValidationMessage'
import { fetchExploreQueries } from '../../js/queryService'
import { InfiniteScrollAutoQL } from '../InfiniteScroll'
import { animateInputText } from '../../js/Util'
import { LoadingDots } from '../LoadingDots'
import { withTheme } from '../../theme'
import { Tooltip } from '../Tooltip'
import { Spinner } from '../Spinner'
import { Icon } from '../Icon'

import './ExploreQueries.scss'

export class ExploreQueries extends React.Component {
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

  componentDidMount = () => {
    if (this.props.shouldRender) {
      this.focusInput()
    }
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.shouldRender && !prevProps.shouldRender) {
      this.focusInput()
    }
  }

  componentWillUnmount = () => {
    clearTimeout(this.animateTextDelay)
    clearTimeout(this.animateTextTimeout)
  }

  focusInput = () => {
    this.inputRef?.focus()
  }

  loadMore = (page, skipQueryValidation) => {
    if (this.state.loading) {
      return Promise.resolve()
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

    return fetchExploreQueries({
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
          finishedState.keywords = inputValue
        }

        this.setState(finishedState)
        return Promise.resolve()
      })
      .catch((error) => {
        this.setState({ loading: false, initialLoading: false })
        console.error(error)
        return Promise.reject()
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
    this.animateQITextAndSubmit(keywords, true)
  }

  animateQITextAndSubmit = (text, skipQueryValidation) => {
    return animateInputText({
      text,
      inputRef: this.inputRef,
      callback: () => {
        this.setState({ inputValue: text }, () => this.loadMore(1, skipQueryValidation))
      },
    })
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
        this.focusInput()
      },
    )
  }

  renderIntroMessage = () => {
    return (
      <div className='query-tips-result-placeholder'>
        <h2>Welcome to Explore Queries</h2>
        {this.props.introMessage ? (
          <p>{this.props.introMessage}</p>
        ) : (
          <>
            <p>Discover what you can ask by entering a topic in the search bar above.</p>
            <p>Simply click on any of the returned options to run the query in Data Messenger.</p>
          </>
        )}
      </div>
    )
  }

  renderQueryList = () => {
    if (this.state.initialLoading) {
      return (
        <div className='query-tips-result-placeholder'>
          <LoadingDots />
        </div>
      )
    }

    if (this.state.validationResponse) {
      return (
        <div className='query-tips-result-placeholder'>
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
      return this.renderIntroMessage()
    }

    if (this.state.queryList?.length === 0) {
      return (
        <div className='query-tips-result-placeholder'>
          <p>
            Sorry, I couldn’t find any queries matching your input. Try entering a different topic or keyword instead.
          </p>
        </div>
      )
    }

    return (
      <InfiniteScrollAutoQL
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
        {this.state.queryList.map((query, i) => {
          return (
            <div
              className='query-tip-item animated-item'
              onClick={() => this.props.executeQuery(query)}
              key={`query-tip-${i}`}
              style={{ display: 'block' }}
            >
              {query}
            </div>
          )
        })}
      </InfiniteScrollAutoQL>
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
          className='query-tips-page-container'
          data-test='query-tips-tab'
        >
          <div className='react-autoql-chatbar-input-container' style={{ animation: 'slideDown 0.5s ease' }}>
            <input
              className='react-autoql-chatbar-input left-padding right-padding'
              placeholder={this.props.inputPlaceholder}
              value={this.state.inputValue}
              onChange={this.onInputChange}
              onKeyPress={this.onKeyPress}
              spellCheck={false}
              ref={(ref) => (this.inputRef = ref)}
              data-test='explore-queries-input-bar'
              autoFocus
            />
            <div className='chat-bar-input-icon'>
              <Icon
                type='search'
                style={{
                  width: '19px',
                  height: '20px',
                  color: 'var(--react-autoql-text-color-placeholder)',
                }}
              />
            </div>
            <div
              className={`chat-bar-clear-btn ${this.state.queryList?.length || this.state.inputValue ? 'visible' : ''}`}
              data-for={this.props.tooltipID ?? 'explore-queries-tooltips'}
              data-tip='Clear Search'
            >
              <Icon type='close' onClick={this.clearExploreQueries} />
            </div>
          </div>
          <div className='query-tips-result-container'>{this.renderQueryList()}</div>
        </div>
        {!this.props.tooltipID && (
          <Tooltip className='react-autoql-tooltip' id='explore-queries-tooltips' delayShow={800} effect='solid' />
        )}
      </ErrorBoundary>
    )
  }
}

export default withTheme(ExploreQueries)
