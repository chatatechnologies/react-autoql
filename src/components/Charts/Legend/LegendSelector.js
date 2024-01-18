import React from 'react'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import { Popover } from '../../Popover'
import { axesDefaultProps, axesPropTypes } from '../chartPropHelpers'
import { CustomScrollbars } from '../../CustomScrollbars'
import './LegendSelector.scss'
export default class LegendSelector extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      isOpen: false,
    }
  }

  static propTypes = axesPropTypes
  static defaultProps = axesDefaultProps

  getAllStringColumnIndices = () => {
    const columnIndices = []
    this.props.columns.forEach((col, i) => {
      const isOnNumberAxis = this.props.numberColumnIndices?.includes(col.index)
      const isOnSecondNumberAxis = this.props.hasSecondAxis && this.props.numberColumnIndices2?.includes(col.index)
      if ((!isOnNumberAxis && !isOnSecondNumberAxis && col.is_visible) || (col.groupable && col.isStringType)) {
        columnIndices.push(i)
      }
    })
    return columnIndices
  }
  renderSelectorContent = () => {
    let columnIndices = []
    if (this.props.dateColumnsOnly) {
      columnIndices = this.getDateColumnIndices()
    } else {
      columnIndices = this.getAllStringColumnIndices()
    }
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
                  className={`legend-select-list-item ${colIndex === this.props.stringColumnIndex ? 'active' : ''}`}
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
      >
        {this.props.children}
      </Popover>
    )
  }
}
