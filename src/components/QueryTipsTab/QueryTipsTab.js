import React, { Fragment } from 'react'
import { Scrollbars } from 'react-custom-scrollbars'
import { IoIosSearch } from 'react-icons/io'
import ReactPaginate from 'react-paginate'
import _get from 'lodash.get'
import PropTypes from 'prop-types'
import { MdPlayCircleOutline } from 'react-icons/md'

import { Spinner } from '../Spinner'

import './QueryTipsTab.scss'

export default class QueryTipsTab extends React.Component {
  static propTypes = {
    onQueryTipsInputKeyPress: PropTypes.func.isRequired,
    loading: PropTypes.bool.isRequired,
    error: PropTypes.bool.isRequired,
    queryTipsList: PropTypes.array.isRequired,
    executeQuery: PropTypes.func.isRequired
  }

  // state = {
  //   queryTipsInputValue: '',
  //   queryTipsList: []
  // }

  renderQueryTipsContent = () => {
    if (!this.props.queryTipsList) {
      return (
        <div className="query-tips-result-placeholder">
          <p>Your query suggestions will show up here.</p>
          <p>
            You can copy them for later use or execute them in the data
            messenger by hitting the “execute” button
          </p>
        </div>
      )
    }

    if (_get(this.props.queryTipsList, 'length') === 0) {
      return (
        <div className="query-tips-result-placeholder">
          <p>Sorry, we couldn't find any queries matching those keywords.</p>
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
            forcePage={this.props.currentPage}
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
        ref={c => {
          this.queryTipsScrollComponent = c
        }}
      >
        <div className="query-tips-page-container">
          <div
            className="chata-input-container"
            style={{ animation: 'slideDown 0.5s ease' }}
          >
            <input
              className="chata-input left-padding"
              placeholder="Enter a Topic..."
              value={this.props.queryTipsInputValue}
              onChange={this.props.onQueryTipsInputKeyPress}
              onKeyPress={this.props.onQueryTipsInputKeyPress}
              ref={ref => (this.queryTipsInputRef = ref)}
              autoFocus
            />
            <div className="chat-bar-input-icon">
              <IoIosSearch
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
