import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { Scrollbars } from 'react-custom-scrollbars'
import ReactPaginate from 'react-paginate'
import _get from 'lodash.get'

import { Spinner } from '../Spinner'
import { Icon } from '../Icon'
import { QueryValidationMessage } from '../QueryValidationMessage'

import { themeConfigType } from '../../props/types'
import { themeConfigDefault, getThemeConfig } from '../../props/defaults'

import './QueryTipsTab.scss'

export default class QueryTipsTab extends React.Component {
  static propTypes = {
    themeConfig: themeConfigType,
    onQueryTipsInputKeyPress: PropTypes.func,
    loading: PropTypes.bool,
    error: PropTypes.bool,
    queryTipsList: PropTypes.array,
    executeQuery: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    loading: false,
    error: false,
    queryTipsList: undefined,
    executeQuery: () => {},
    onQueryTipsInputKeyPress: () => {},
  }

  // state = {
  //   queryTipsInputValue: '',
  //   queryTipsList: []
  // }

  renderQueryTipsContent = () => {
    if (this.props.queryTipsQueryValidationResponse) {
      return (
        <QueryValidationMessage
          themeConfig={getThemeConfig(this.props.themeConfig)}
          response={this.props.queryTipsQueryValidationResponse}
          onSuggestionClick={this.props.onQueryValidationSuggestionClick}
          autoSelectSuggestion={true}
          // message="Did you mean"
          submitText="Search"
          submitIcon="search"
        />
      )
    }

    if (!this.props.queryTipsList) {
      return (
        <div className="query-tips-result-placeholder">
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

    if (_get(this.props.queryTipsList, 'length') === 0) {
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
      <Fragment>
        <div className="query-tip-list-container">
          {this.props.queryTipsList.map((query, i) => {
            return (
              <div
                className="query-tip-item animated-item"
                onClick={() => this.props.executeQuery(query)}
                key={`query-tip-${i}`}
                style={{ display: 'block' }}
              >
                {query}
                {
                  // <span className="execute-btn">
                  //   <MdPlayCircleOutline />
                  // </span>
                }
              </div>
            )
          })}
          {
            //   this.props.loading && (
            //   <Spinner />
            // )
          }
        </div>
        <div id="react-paginate" className="animated-item">
          <ReactPaginate
            pageCount={this.props.totalPages}
            pageRangeDisplayed={1}
            forcePage={this.props.currentPage - 1} // it is 0 indexed
            pageRangeDisplayed={1}
            marginPagesDisplayed={2}
            containerClassName={'pagination'}
            subContainerClassName={'pages pagination'}
            previousLabel="&#8592;"
            nextLabel="&#8594;"
            onPageChange={this.props.onPageChange}
            nextClassName="pagination-next"
            previousClassName="pagination-previous"
          />
        </div>
      </Fragment>
    )
  }

  render = () => {
    return (
      <Scrollbars
        ref={(c) => {
          this.queryTipsScrollComponent = c
        }}
      >
        <div className="query-tips-page-container" data-test="query-tips-tab">
          <div
            className="react-autoql-chatbar-input-container"
            style={{ animation: 'slideDown 0.5s ease' }}
          >
            <input
              className="react-autoql-chatbar-input left-padding"
              placeholder="Search relevant queries by topic"
              value={this.props.queryTipsInputValue}
              onChange={this.props.onQueryTipsInputKeyPress}
              onKeyPress={this.props.onQueryTipsInputKeyPress}
              ref={(ref) => (this.queryTipsInputRef = ref)}
              autoFocus
            />
            <div className="chat-bar-input-icon">
              <Icon
                type="search"
                style={{ width: '19px', height: '20px', color: '#999' }}
              />
            </div>
            {this.props.loading && (
              <div className="chat-bar-loading-spinner">
                <Spinner
                  style={{ width: '19px', height: '20px', color: '#999' }}
                />
              </div>
            )}
          </div>
          <div className="query-tips-result-container">
            {this.renderQueryTipsContent()}
          </div>
        </div>
      </Scrollbars>
    )
  }
}
