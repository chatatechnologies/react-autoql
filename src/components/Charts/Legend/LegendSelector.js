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
      
      // Exclude the column that's selected on the string axis
      const stringColumnIndexToExclude = this.props.tableConfig?.stringColumnIndex ?? this.props.stringColumnIndex
      const isOnStringAxis = stringColumnIndexToExclude !== undefined && 
        (i === stringColumnIndexToExclude || col.index === stringColumnIndexToExclude)

      // If using pivot data (isAggregation), only include groupable string columns that are NOT on number axes
      if (this.props.isAggregation) {
        if (col.groupable && isColumnStringType(col) && !isOnNumberAxis && !isOnSecondNumberAxis && !isOnStringAxis) {
          columnIndices.push(i)
        }
      } else {
        // Original logic: include columns not on number axes, or groupable string columns
        if ((!isOnNumberAxis && !isOnSecondNumberAxis && !isOnStringAxis && col.is_visible) || (col.groupable && col.type === 'STRING' && !isOnStringAxis)) {
          columnIndices.push(i)
        }
      }
    })
    return columnIndices
  }

  renderSelectorContent = () => {
    // If using pivot data (isAggregation), use getAllStringColumnIndices to only show groupable string columns
    // Otherwise, use the original logic with getStringColumnIndices
    let columnIndices = this.props.isAggregation
      ? this.getAllStringColumnIndices()
      : getStringColumnIndices(this.props.columns, undefined, true)?.stringColumnIndices?.filter(
          (i) =>
            !this.props.tableConfig.numberColumnIndices.includes(i) &&
            !this.props.tableConfig.numberColumnIndices2.includes(i),
        ) ?? []
    
    // Exclude the column that's selected on the string axis
    // Since we're using originalColumns, we need to find the column by matching
    // the stringColumnIndex from tableConfig (which is an array index in the columns array)
    const stringColumnIndexToExclude = this.props.tableConfig?.stringColumnIndex ?? this.props.stringColumnIndex
    if (stringColumnIndexToExclude !== undefined && stringColumnIndexToExclude >= 0) {
      // Find the column that's selected on the string axis by matching its index property
      // or by finding it in the originalColumns array at that position
      const stringAxisColumn = this.props.columns[stringColumnIndexToExclude]
      if (stringAxisColumn) {
        // Filter out columns that match by array index OR by column.index property OR by name
        columnIndices = columnIndices.filter((i) => {
          const col = this.props.columns[i]
          return (
            i !== stringColumnIndexToExclude &&
            col?.index !== stringAxisColumn?.index &&
            col?.index !== stringColumnIndexToExclude &&
            col?.name !== stringAxisColumn?.name
          )
        })
      } else {
        // Fallback: just filter by array index
        columnIndices = columnIndices.filter((i) => i !== stringColumnIndexToExclude)
      }
    }

    return (
      <div
        className='legend-selector-container'
        id='legend-selector-content'
        key={`legend-selector-${this.props.stringColumnIndex}`}
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
                  key={`legend-column-select-${colIndex}`}
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
    // Use stringColumnIndex in key to force re-render when string axis selection changes
    const stringColumnIndex = this.props.stringColumnIndex ?? this.props.tableConfig?.stringColumnIndex
    return (
      <Popover
        key={`legend-selector-popover-${stringColumnIndex}`}
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
