import React from 'react'
import PropTypes from 'prop-types'
import { DEFAULT_DATA_PAGE_SIZE, MAX_DATA_PAGE_SIZE } from 'autoql-fe-utils'
import { isAbortError } from '../../../utils/abortUtils'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

import { axesDefaultProps, axesPropTypes } from '../chartPropHelpers'

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

  loadMoreChartData = async (pageSize, isMax) => {
    const previousRowNumber = this.props.currentRowNumber

    try {
      // Fetch data with max page size, but dont display this
      // number in the dropdown, use exact row count instead
      const pageSizeForRequest = isMax ? MAX_DATA_PAGE_SIZE : pageSize
      this.props.setCurrentRowNumber(pageSize)
      this.props.setIsLoadingMoreRows(true)
      const response = await this.props.queryFn({ pageSize: pageSizeForRequest })
      this.props.onNewData(response, pageSizeForRequest)
      this.props.setIsLoadingMoreRows(false)
    } catch (error) {
      if (!isAbortError(error)) {
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
      <CustomScrollbars autoHeight autoHeightMin={minHeight} maxHeight={maxHeight}>
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
        innerRef={(r) => (this.popoverRef = r)}
        content={this.renderSelectorContent}
        onClickOutside={this.closeSelector}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={this.props.positions}
        align={this.props.align}
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
