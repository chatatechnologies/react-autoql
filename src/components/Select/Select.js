import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'
import uuid from 'uuid'
import _get from 'lodash.get'
import ReactTooltip from 'react-tooltip'

import './Select.scss'

export default class Select extends React.Component {
  ID = uuid.v4()

  static propTypes = {
    onChange: PropTypes.func,
    options: PropTypes.arrayOf(PropTypes.shape({})),
    value: PropTypes.string,
    label: PropTypes.string
  }

  static defaultProps = {
    onChange: () => {},
    options: [],
    value: undefined,
    label: undefined
  }

  state = {
    isOpen: false
  }

  render = () => {
    if (!this.props.options) {
      return null
    }

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
              <ReactTooltip
                id={`select-tooltip-${this.ID}`}
                className="chata-drawer-tooltip"
                effect="solid"
                place="right"
                delayShow={500}
              />
              <ul className="chata-select-popup">
                {this.props.options.map(option => {
                  return (
                    <li
                      key={`select-option-${this.ID}-${option.value}`}
                      onClick={() => {
                        this.setState({ isOpen: false })
                        this.props.onChange(option.value)
                      }}
                      data-tip={option.tooltip || null}
                      data-for={`select-tooltip-${this.ID}`}
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
          data-test="chata-select"
          onClick={() => this.setState({ isOpen: !this.state.isOpen })}
        >
          {_get(
            this.props.options.find(
              option => option.value === this.props.value
            ),
            'label'
          ) ||
            _get(
              this.props.options.find(
                option => option.value === this.props.value
              ),
              'value',
              null
            )}
        </div>
      </Popover>
    )
  }
}
