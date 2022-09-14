import React from 'react'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import { Popover } from 'react-tiny-popover'
import { axesDefaultProps, axesPropTypes } from '../helpers'
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
    this.setState({ isOpen: false })
  }

  renderSelectorContent = ({ position, childRect, popoverRect }) => {
    return (
      <CustomScrollbars
        autoHide={false}
        autoHeight
        autoHeightMin={0}
        autoHeightMax={this.props.chartContainerRef?.clientHeight}
      >
        <div
          className="axis-selector-container"
          id="string-column-selector-content"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <ul className="axis-selector-content">
            {this.props.stringColumnIndices.map((colIndex, i) => {
              return (
                <li
                  className={`string-select-list-item ${
                    colIndex === this.props.stringColumnIndex ? 'active' : ''
                  }`}
                  key={uuid()}
                  onClick={() => {
                    this.closeSelector()
                    this.props.changeStringColumnIndex(colIndex)
                  }}
                >
                  {_get(this.props.columns, `[${colIndex}].title`)}
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
          className="axis-label-border"
          data-test="axis-label-border"
          onClick={this.openSelector}
          fill="transparent"
          stroke="transparent"
          strokeWidth="1px"
          rx="4"
        />
      </Popover>
    )
  }
}
