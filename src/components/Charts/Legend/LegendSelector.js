import React from 'react'
import PropTypes from 'prop-types'
import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

import './LegendSelector.scss'
import { getStringColumnIndices } from 'autoql-fe-utils'

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

      const isOnNumberAxis = this.props.numberColumnIndices?.includes(col.index)
      const isOnSecondNumberAxis = this.props.hasSecondAxis && this.props.numberColumnIndices2?.includes(col.index)
      if ((!isOnNumberAxis && !isOnSecondNumberAxis && col.is_visible) || (col.groupable && col.isStringType)) {
        columnIndices.push(i)
      }
    })
    return columnIndices
  }

  renderSelectorContent = () => {
    const columnIndices =
      getStringColumnIndices(this.props.columns, undefined, true)?.stringColumnIndices?.filter(
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
        <CustomScrollbars>
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
