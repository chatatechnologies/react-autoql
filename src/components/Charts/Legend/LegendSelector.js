import React from 'react'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import { Popover } from '../../Popover'
import { axesDefaultProps, axesPropTypes } from '../chartPropHelpers'
import { CustomScrollbars } from '../../CustomScrollbars'

export default class StringAxisSelector extends React.Component {
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
    if (this.state.isOpen) {
      this.setState({ isOpen: false })
    }
  }

  renderSelectorContent = () => {
    return (
      <div
        className='axis-selector-container'
        id='legend-selector-content'
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <CustomScrollbars>
          <ul className='axis-selector-content'>
            {this.props.stringColumnIndices.map((legendItem, i) => {
              return (
                <li
                  className={'string-select-list-item'}
                  key={uuid()}
                  onClick={() => {
                    this.props.onChangeLegendColumnIndex(i)
                    this.closeSelector()
                  }}
                >
                  {legendItem.label}
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
          {...this.props.childProps}
          className='legend-title-border'
          data-test='legend-title-border'
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
