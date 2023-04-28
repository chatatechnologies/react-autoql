import React from 'react'
import axios from 'axios'
import PropTypes from 'prop-types'
import { Popover } from 'react-tiny-popover'
import { axesDefaultProps, axesPropTypes } from '../helpers'
import { CustomScrollbars } from '../../CustomScrollbars'
import { getAuthentication } from '../../../props/defaults'
import { runQueryOnly, runDrilldown } from '../../../js/queryService'
import { responseErrors } from '../../../js/errorMessages'
import { DEFAULT_DATA_PAGE_SIZE, MAX_DATA_PAGE_SIZE } from '../../../js/Constants'

export default class RowNumberSelector extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isOpen: false,
    }
  }

  static propTypes = {
    ...axesPropTypes,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    ...axesDefaultProps,
    onErrorCallback: () => {},
  }

  openSelector = () => {
    this.setState({ isOpen: true })
  }

  closeSelector = () => {
    if (this.state.isOpen) {
      this.setState({ isOpen: false })
    }
  }

  axiosSource = axios.CancelToken.source()

  getNewChartData = (pageSize) => {
    this.props.setIsLoadingMoreRows(true)
    if (this.props.isDrilldown) {
      return runDrilldown({
        ...getAuthentication(this.props.authentication),
        source: this.props.source,
        scope: this.props.scope,
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
        scope: this.props.queryRequestData?.scope,
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

  loadMoreChartData = async (pageSize, isMax) => {
    const previousRowNumber = this.props.currentRowNumber

    try {
      let response
      // Fetch data with max page size, but dont display this
      // number in the dropdown, use exact row count instead
      const pageSizeForRequest = isMax ? MAX_DATA_PAGE_SIZE : pageSize
      this.props.setCurrentRowNumber(pageSize)
      response = await this.getNewChartData(pageSizeForRequest)
      this.props.onNewData(response, pageSizeForRequest)
      this.props.setIsLoadingMoreRows(false)
    } catch (error) {
      if (error?.data?.message !== responseErrors.CANCELLED) {
        console.error(error)
        this.props.onErrorCallback(error)
      }

      // Rows weren't loaded, so reset back to previous row number and stop loading
      this.props.setCurrentRowNumber(previousRowNumber)
      this.props.setIsLoadingMoreRows(false)
    }
  }

  rowNumberListConstructor = (totalRows) => {
    let initialRowNumber = DEFAULT_DATA_PAGE_SIZE
    let currentRowNumber = initialRowNumber
    let rowNumberList = []
    while (currentRowNumber < totalRows && currentRowNumber < MAX_DATA_PAGE_SIZE) {
      rowNumberList.push(currentRowNumber)
      currentRowNumber = currentRowNumber * 10
    }
    if (totalRows > MAX_DATA_PAGE_SIZE) {
      rowNumberList.push(MAX_DATA_PAGE_SIZE)
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

    const rowNumberList = this.rowNumberListConstructor(this.props.totalRowCount)

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
            {rowNumberList.map((rowNumber, i) => {
              let rowNumberString = rowNumber
              if (rowNumber === MAX_DATA_PAGE_SIZE) {
                rowNumberString = `${MAX_DATA_PAGE_SIZE} (Maximum)`
              } else if (rowNumber !== DEFAULT_DATA_PAGE_SIZE && rowNumber !== DEFAULT_DATA_PAGE_SIZE * 10) {
                rowNumberString = `${rowNumber} (All)`
              }

              const isMax = i === rowNumberList.length - 1
              return (
                <li
                  className={`string-select-list-item ${rowNumber === this.props.currentRowNumber ? 'active' : ''}`}
                  key={`string-column-select-${i}`}
                  onClick={() => {
                    this.closeSelector()
                    this.loadMoreChartData(rowNumber, isMax)
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
