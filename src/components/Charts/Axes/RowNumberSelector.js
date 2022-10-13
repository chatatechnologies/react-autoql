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
export default class RowNumberSelector extends React.Component {
  constructor(props) {
    super(props)
    this.formattedTableParams = props.formattedTableParams
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
    console.log('props', this.props)
    this.props.setIsLoadingMoreRows(true)
    console.log('this.formattedTableParams', this.formattedTableParams)
    if (this.props.isDrilldown) {
      console.warn('This is drilldown')
      return runDrilldown({
        ...getAuthentication(this.props.authentication),
        source: this.props.queryRequestData?.source,
        debug: this.props.queryRequestData?.translation === 'include',
        formattedUserSelection: this.props.queryRequestData?.user_selection,
        filters: this.props.queryRequestData?.session_filter_locks,
        test: this.props.queryRequestData?.test,
        groupBys: this.props.queryRequestData?.columns,
        queryID: this.props.queryRequestData?.original_query_id, // todo: get original query ID from drillown response
        orders: this.formattedTableParams?.sorters,
        tableFilters: this.formattedTableParams?.filters,
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
        orders: this.formattedTableParams?.sorters,
        tableFilters: this.formattedTableParams?.filters,
        cancelToken: this.axiosSource.token,
      })
    }
  }
  loadMoreChartData = async (pageSize) => {
    try {
      let response
      if (pageSize === 'Maximum') {
        pageSize = this.props.totalRowNumber //totalRows
        if (this.props.totalRowNumber > 5000) {
          pageSize = 5000
        }
      }
      this.props.setCurrentRowNumber(pageSize)
      response = await this.getNewChartData(pageSize)
      this.props.setIsLoadingMoreRows(false)
      console.log(response)
      this.props.onNewData(response)
      //   this.props.responseRef?.onNewPage(response?.rows)
    } catch (error) {
      //   if (error?.data?.message === responseErrors.CANCELLED) {
      //     return Promise.resolve()
      //   }
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
    rowNumberList.push('Maximum')
    return rowNumberList
  }
  renderSelectorContent = ({ position, childRect, popoverRect }) => {
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
        {console.log('49', this.props.dataLength)}
        <div
          className='axis-selector-container'
          id='string-column-selector-content'
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {console.log('this.props.devTotalRowNumber', this.props.totalRowNumber)}
          <ul className='axis-selector-content'>
            {this.rowNumberListConstructor(this.props.totalRowNumber).map((rowNumber, i) => {
              return (
                <li
                  className={`string-select-list-item ${rowNumber === this.props.stringColumnIndex ? 'active' : ''}`}
                  key={`string-column-select-${i}`}
                  onClick={() => {
                    this.closeSelector()
                    this.loadMoreChartData(rowNumber)
                  }}
                >
                  {rowNumber}
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
