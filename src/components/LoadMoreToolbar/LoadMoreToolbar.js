import React from 'react'
import axios from 'axios'
import { responseErrors } from '../../js/errorMessages'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { isChartType } from '../../js/Util'
import { runQueryNewPage } from '../../js/queryService'
import { getTableConfigState } from '../ChataTable/tableHelpers'
import { getAuthentication } from '../../props/defaults'
import './LoadMoreToolbar.scss'

export default class LoadMoreToolbar extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {}

  static defaultProps = {}

  state = { page: 2 }

  componentDidMount = () => {
    this._isMounted = true
    this.rebuildTooltips()
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  rebuildTooltips = () => {
    ReactTooltip.rebuild()
  }
  getNewPage = (props, page) => {
    return runQueryNewPage({
      ...getAuthentication(this.props.authentication),
      page: page,
      queryId: this.props.responseRef?.queryID,
      cancelToken: this.axiosSource.token,
    })
  }

  loadMore = async (props, params) => {
    try {
      this.axiosSource = axios.CancelToken.source()
      let response
      response = await this.getNewPage(props, this.state.page)
      console.log(response)
      console.log(this.props.responseRef?.queryID)
      this.props.responseRef?.onNewPage(response?.rows)
    } catch (error) {
      if (error?.data?.message === responseErrors.CANCELLED) {
        return Promise.resolve()
      }

      console.error(error)
      this.setState({ scrollLoading: false, pageLoading: false })
      // Send empty promise so data doesn't change
      return Promise.resolve()
    }
  }
  renderToolbar = (shouldShowButton) => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-toolbar load-more-toolbar
        ${this.state.activeMenu ? 'active' : ''}
        ${this.props.className || ''}`}
          data-test="autoql-load-more-toolbar"
        >
          {shouldShowButton.showLoadMoreButton && (
            <button
              onClick={() =>
                this.loadMore(this.setState({ page: this.state.page + 1 }))
              }
              data-tip="Load More"
              data-for={`react-autoql-load-more-toolbar-tooltip-${this.COMPONENT_KEY}`}
            >
              Load More
            </button>
          )}
        </div>
      </ErrorBoundary>
    )
  }

  getShouldShowButtonObj = () => {
    let shouldShowButton = {}
    try {
      const displayType = this.props.responseRef?.state?.displayType
      const isChart = isChartType(displayType)
      shouldShowButton = {
        showLoadMoreButton: isChart,
      }
    } catch (error) {
      console.error(error)
    }
    return shouldShowButton
  }

  render = () => {
    const shouldShowButton = this.getShouldShowButtonObj()

    // If there is nothing to put in the toolbar, don't render it
    if (
      !Object.values(shouldShowButton).find((showButton) => showButton === true)
    ) {
      return null
    }

    return (
      <ErrorBoundary>
        {this.renderToolbar(shouldShowButton)}

        <ReactTooltip
          className="react-autoql-tooltip"
          id={`react-autoql-load-more-toolbar-tooltip-${this.COMPONENT_KEY}`}
          effect="solid"
          delayShow={800}
        />
      </ErrorBoundary>
    )
  }
}
