import React from 'react'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import { Popover } from 'react-tiny-popover'
import { axesDefaultProps, axesPropTypes } from '../helpers'
import { CustomScrollbars } from '../../CustomScrollbars'
import { getAuthentication } from '../../../props/defaults'
import { runQueryOnly, runDrilldown } from '../../../js/queryService'
import { responseErrors } from '../../../js/errorMessages'
export default class RowNumberSelector extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isOpen: false,
    }
  }

  static propTypes = axesPropTypes
  static defaultProps = axesDefaultProps

  openSelector = () => {
    this.setState({ isOpen: true })
  }

  closeSelector = () => {
    this.setState({ isOpen: false })
  }

  axiosSource = axios.CancelToken.source()
  getNewChartData = (pageSize) => {
    this.props.setIsLoadingMoreRows(true)
    if (this.props.isDrilldown) {
      return runDrilldown({
        ...getAuthentication(this.props.authentication),
        source: this.props.queryRequestData?.source,
        debug: this.props.queryRequestData?.translation === 'include',
        formattedUserSelection: this.props.queryRequestData?.user_selection,
        filters: this.props.queryRequestData?.session_filter_locks,
        test: this.props.queryRequestData?.test,
        groupBys: this.props.queryRequestData?.columns,
        queryID: this.props.queryRequestData?.original_query_id, // todo: get original query ID from drillown response
        orders: this.props.formattedTableParams?.sorters,
        tableFilters: this.props.formattedTableParams?.filters,
        cancelToken: this.axiosSource.token,
        pageSize: pageSize,
      })
    } else {
      return runQueryOnly({
        ...getAuthentication(this.props.authentication),
        query: this.props.queryRequestData?.text,
        source: this.props.queryRequestData?.source,
        debug: this.props.queryRequestData?.translation === 'include',
        formattedUserSelection: this.props.queryRequestData?.user_selection,
        filters: this.props.queryRequestData?.session_filter_locks,
        test: this.props.queryRequestData?.test,
        pageSize: pageSize,
        orders: this.props.formattedTableParams?.sorters,
        tableFilters: this.props.formattedTableParams?.filters,
        cancelToken: this.axiosSource.token,
      })
    }
  }
  loadMoreChartData = async (pageSize) => {
    try {
      let response
      this.props.setCurrentRowNumber(pageSize)
      response = await this.getNewChartData(pageSize)
      this.props.setIsLoadingMoreRows(false)
      this.props.onNewData(response)
    } catch (error) {
      if (error?.data?.message === responseErrors.CANCELLED) {
        return Promise.resolve()
      }
      console.error(error)

      // Send empty promise so data doesn't change
      return Promise.resolve()
    }
  }
  rowNumberListConstructor = (totalRows) => {
    let initialRowNumber = 50
    let currentRowNumber = initialRowNumber
    let rowNumberList = []
    while (currentRowNumber < totalRows && currentRowNumber < 5000) {
      rowNumberList.push(currentRowNumber)
      currentRowNumber = currentRowNumber * 10
    }
    if (totalRows > 5000) {
      rowNumberList.push(5000)
    } else {
      rowNumberList.push(totalRows)
    }

    return rowNumberList
  }
  renderSelectorContent = () => {
    let maxHeight = 300
    const minHeight = 35
    const padding = 50

    const chartHeight = this.props.chartContainerRef?.clientHeight
    if (chartHeight && chartHeight > minHeight + padding) {
      maxHeight = chartHeight - padding
    } else if (chartHeight && chartHeight < minHeight + padding) {
      maxHeight = minHeight
    }

    return (
      <CustomScrollbars autoHide={false} autoHeight autoHeightMin={minHeight} autoHeightMax={maxHeight}>
        <div
          className='axis-selector-container'
          id='string-column-selector-content'
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <ul className='axis-selector-content'>
            {this.rowNumberListConstructor(this.props.totalRowCount).map((rowNumber, i) => {
              let rowNumberString = rowNumber
              if (rowNumber === 5000) {
                rowNumberString = '5000 (Maximum)'
              } else if (rowNumber !== 50 && rowNumber !== 500) {
                rowNumberString = `${rowNumber} (All)`
              }
              return (
                <li
                  className={`string-select-list-item ${rowNumber === this.props.currentRowNumber ? 'active' : ''}`}
                  key={`string-column-select-${i}`}
                  onClick={() => {
                    this.closeSelector()
                    this.loadMoreChartData(rowNumber)
                  }}
                >
                  {rowNumberString}
                </li>
              )
            })}
          </ul>
        </div>
      </CustomScrollbars>
    )
  }

  render = () => {
    return (
      <Popover
        isOpen={this.state.isOpen}
        ref={(r) => (this.popoverRef = r)}
        content={this.renderSelectorContent}
        onClickOutside={this.closeSelector}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={this.props.positions}
        align={this.props.align}
        reposition={true}
        padding={10}
      >
        <rect
          {...this.props.childProps}
          className='axis-label-border'
          data-test='axis-label-border'
          onClick={this.openSelector}
          fill='transparent'
          stroke='transparent'
          strokeWidth='1px'
          rx='4'
        />
      </Popover>
    )
  }
}
