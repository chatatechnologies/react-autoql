import React from 'react'
import PropTypes from 'prop-types'
import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { getStringColumnIndices, isColumnStringType } from 'autoql-fe-utils'

import './LegendSelector.scss'
export default class LegendSelector extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      isOpen: false,
    }
  }

  static propTypes = {
    changeStringColumnIndex: PropTypes.func,
    changeLegendColumnIndex: PropTypes.func,
    legendColumn: PropTypes.shape({}),
    stringColumnIndices: PropTypes.arrayOf(PropTypes.number),
    stringColumnIndex: PropTypes.number,
    numberColumnIndex: PropTypes.number,
    numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
    numberColumnIndices2: PropTypes.arrayOf(PropTypes.number),
    isAggregation: PropTypes.bool,
    tooltipID: PropTypes.string,
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    align: PropTypes.string,
    positions: PropTypes.arrayOf(PropTypes.string),
    isOpen: PropTypes.bool,
    closeSelector: PropTypes.func,
  }

  static defaultProps = {
    changeStringColumnIndex: () => {},
    changeLegendColumnIndex: () => {},
    closeSelector: () => {},
  }

  getAllStringColumnIndices = () => {
    const columnIndices = []
    this.props.columns.forEach((col, i) => {
      if (!col.is_visible) {
        return
      }

      // Check if column is on number axis - use array index i (as tableConfig uses array indices)
      const isOnNumberAxis =
        this.props.tableConfig?.numberColumnIndices?.includes(i) ||
        this.props.numberColumnIndices?.includes(col.index) ||
        this.props.numberColumnIndices?.includes(i)
      const isOnSecondNumberAxis =
        this.props.hasSecondAxis &&
        (this.props.tableConfig?.numberColumnIndices2?.includes(i) ||
          this.props.numberColumnIndices2?.includes(col.index) ||
          this.props.numberColumnIndices2?.includes(i))

      // If using pivot data (isAggregation), only include groupable string columns that are NOT on number axes
      if (this.props.isAggregation) {
        if (col.groupable && isColumnStringType(col) && !isOnNumberAxis && !isOnSecondNumberAxis) {
          columnIndices.push(i)
        }
      } else {
        // Original logic: include columns not on number axes, or groupable string columns
        if ((!isOnNumberAxis && !isOnSecondNumberAxis && col.is_visible) || (col.groupable && col.type === 'STRING')) {
          columnIndices.push(i)
        }
      }
    })
    return columnIndices
  }

  renderSelectorContent = () => {
    // If using pivot data (isAggregation), use getAllStringColumnIndices to only show groupable string columns
    // Otherwise, use the original logic with getStringColumnIndices
    const columnIndices = this.props.isAggregation
      ? this.getAllStringColumnIndices()
      : getStringColumnIndices(this.props.columns, undefined, true)?.stringColumnIndices?.filter(
          (i) =>
            !this.props.tableConfig.numberColumnIndices.includes(i) &&
            !this.props.tableConfig.numberColumnIndices2.includes(i),
        ) ?? []

    return (
      <div
        className='legend-selector-container'
        id='legend-selector-content'
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <CustomScrollbars suppressScrollX>
          <ul className='axis-selector-content'>
            {columnIndices.map((colIndex, i) => {
              return (
                <li
                  className={`legend-select-list-item ${colIndex === this.props.legendColumn.index ? 'active' : ''}`}
                  key={`legend-column-select-${i}`}
                  onClick={() => {
                    this.props.closeSelector()
                    this.props.changeLegendColumnIndex(colIndex)
                  }}
                >
                  {this.props.columns?.[colIndex]?.display_name}
                </li>
              )
            })}
          </ul>
        </CustomScrollbars>
      </div>
    )
  }

  render = () => {
    return (
      <Popover
        isOpen={this.props.isOpen}
        innerRef={this.props.legendSelectorRef}
        content={this.renderSelectorContent}
        onClickOutside={this.props.closeSelector}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={this.props.positions}
        align={this.props.align}
        padding={0}
      >
        {this.props.children}
      </Popover>
    )
  }
}
