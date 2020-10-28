import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'
import uuid from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'

import { themeConfigType } from '../../props/types'
import { themeConfigDefault, getThemeConfig } from '../../props/defaults'
import { setCSSVars } from '../../js/Util'

import './Select.scss'

export default class Select extends React.Component {
  ID = uuid.v4()

  static propTypes = {
    themeConfig: themeConfigType,
    onChange: PropTypes.func,
    options: PropTypes.arrayOf(PropTypes.shape({})),
    popupClassname: PropTypes.string,
    value: PropTypes.string,
    label: PropTypes.string,
    size: PropTypes.string,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    onChange: () => {},
    options: [],
    popupClassname: undefined,
    value: undefined,
    label: undefined,
    size: 'large',
    style: {},
  }

  state = {
    isOpen: false,
  }

  componentDidMount = () => {
    setCSSVars(getThemeConfig(this.props.themeConfig))
  }

  componentDidUpdate = (prevProps) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
  }

  render = () => {
    if (!this.props.options) {
      return null
    }

    return (
      <Popover
        isOpen={this.state.isOpen}
        position="bottom" // if you'd like, supply an array of preferred positions ordered by priority
        padding={0} // adjust padding here!
        onClickOutside={() => this.setState({ isOpen: false })}
        // contentLocation={this.state.contextMenuPosition}
        content={({
          position,
          nudgedLeft,
          nudgedTop,
          targetRect,
          popoverRect,
        }) => {
          return (
            <div
              className={`react-autoql-select-popup-container ${this.props
                .popupClassname || ''}`}
              style={{ width: this.props.style.width }}
            >
              <ReactTooltip
                id={`select-tooltip-${this.ID}`}
                className="react-autoql-drawer-tooltip"
                effect="solid"
                // place="right"
                delayShow={500}
              />

              <ul className="react-autoql-select-popup">
                {this.props.options.map((option) => {
                  return (
                    <li
                      key={`select-option-${this.ID}-${option.value}`}
                      className={`react-autoql-select-option${
                        option.value === this.props.value ? ' active' : ''
                      }`}
                      onClick={() => {
                        this.setState({ isOpen: false })
                        this.props.onChange(option.value)
                      }}
                      data-tip={option.tooltip || null}
                      data-for={`select-tooltip-${this.ID}`}
                    >
                      {option.listLabel || option.label}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        }}
      >
        <div
          className={`react-autoql-select ${this.props.className}`}
          data-test="react-autoql-select"
          onClick={() => this.setState({ isOpen: !this.state.isOpen })}
          style={this.props.style}
        >
          {_get(
            this.props.options.find(
              (option) => option.value === this.props.value
            ),
            'label'
          ) ||
            _get(
              this.props.options.find(
                (option) => option.value === this.props.value
              ),
              'value',
              <span style={{ color: 'rgba(0,0,0,0.4)', fontStyle: 'italic' }}>
                {this.props.selectionPlaceholder || 'Select an item'}
              </span>
              // null
            )}
        </div>
      </Popover>
    )
  }
}
