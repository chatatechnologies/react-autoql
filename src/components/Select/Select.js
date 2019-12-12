import React from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'
import uuid from 'uuid'

import './Select.scss'

export default class Select extends React.Component {
  static propTypes = {
    onOptionClick: PropTypes.func,
    options: PropTypes.arrayOf(PropTypes.shape({})),
    value: PropTypes.string
  }

  static defaultProps = {
    onOptionClick: () => {},
    options: [],
    value: undefined
  }

  state = {
    isOpen: false
  }

  render = () => {
    return (
      <Popover
        isOpen={this.state.isOpen}
        position="bottom" // if you'd like, supply an array of preferred positions ordered by priority
        padding={10} // adjust padding here!
        onClickOutside={() => this.setState({ isOpen: false })}
        // contentLocation={this.state.contextMenuPosition}
        content={({
          position,
          nudgedLeft,
          nudgedTop,
          targetRect,
          popoverRect
        }) => {
          return (
            <div className="chata-select-popup-container">
              <ul className="chata-select-popup">
                {this.props.options.map(option => {
                  return (
                    <li
                      key={uuid.v4()}
                      onClick={() => {
                        this.setState({ isOpen: false })
                        this.props.onOptionClick(option)
                      }}
                    >
                      {option.label}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        }}
      >
        <div
          className={`chata-select ${this.props.className}`}
          onClick={() => this.setState({ isOpen: true })}
        >
          {
            this.props.options.find(option => option.value === this.props.value)
              .label
          }
        </div>
      </Popover>
    )
  }
}
