import React from 'react'
import PropTypes from 'prop-types'
import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { getStringColumnIndices } from 'autoql-fe-utils'

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
    isAggregated: PropTypes.bool,
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
      const isOnStringAxis =
        stringColumnIndexToExclude !== undefined &&
        (i === stringColumnIndexToExclude || col.index === stringColumnIndexToExclude)

      // If using pivot data, include every groupable column — type doesn't matter (a numeric
      // groupby is a valid legend column), and the column currently on the string axis is kept so
      // selecting it swaps the two axes. The number axis checks don't apply here: in pivot mode
      // numberColumnIndices are pivot column indices, not indices into these (original) columns.
      if (this.props.isAggregated) {
        if (col.groupable) {
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
    const tableConfig = this.props.tableConfig || {}
    const selectedLegendIndex = this.props.legendColumn?.index
    const numberColumnIndices = tableConfig.numberColumnIndices || []
    const numberColumnIndices2 = tableConfig.numberColumnIndices2 || []

    // If using pivot data, use getAllStringColumnIndices to only show groupable columns
    // Otherwise, use the original logic with getStringColumnIndices
    let columnIndices = this.props.isAggregated
      ? this.getAllStringColumnIndices()
      : getStringColumnIndices(this.props.columns, undefined, true)?.stringColumnIndices?.filter(
          (i) =>
            !numberColumnIndices.includes(i) &&
            !numberColumnIndices2.includes(i),
        ) ?? []
    
    // Don't exclude the string column - it will be shown in the list
    // When clicked, onChangeLegendColumnIndex will swap it with the current legend column

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
                  className={`legend-select-list-item ${colIndex === selectedLegendIndex ? 'active' : ''}`}
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
