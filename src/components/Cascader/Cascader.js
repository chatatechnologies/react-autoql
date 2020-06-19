import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'

import { Icon } from '../Icon'

import './Cascader.scss'

export default class Cascader extends React.Component {
  COMPONENT_ID = uuid.v4()

  static propTypes = {
    options: PropTypes.arrayOf(PropTypes.shape({})),
    onFinalOptionClick: PropTypes.func,
    onSeeMoreClick: PropTypes.func,
  }

  static defaultProps = {
    options: [],
    onFinalOptionClick: () => {},
    onSeeMoreClick: () => {},
  }

  state = {
    activeKeys: [],
    optionsArray: [{ options: this.props.options }],
  }

  renderOptionsList = ({ options, active, index }) => {
    const isLastGroup = index === _get(this.state.optionsArray, 'length', 0) - 1
    const isFirstGroup = index === 0
    const mostRecentOptionLabel = _get(this.state.mostRecentOption, 'label')
    const hasNoChildren = options.every(option => !option.children)

    return (
      <div
        key={`options-list-${index}-${this.COMPONENT_ID}`}
        className={`options-container
          ${isLastGroup ? 'visible' : 'hidden'}`}
        data-test={`options-list-${index}`}
      >
        {!isFirstGroup && (
          <Fragment>
            <div
              className="cascader-back-arrow"
              data-test={`cascader-back-arrow-${index}`}
              onClick={() => {
                const newArray = [...this.state.optionsArray]
                newArray.pop()
                this.setState({
                  optionsArray: newArray,
                })
              }}
            >
              <Icon type="caret-left" />
            </div>
            <div className="options-title" data-test="options-title">
              {mostRecentOptionLabel}
            </div>
          </Fragment>
        )}
        {options.map((option, i) => {
          return (
            <div
              key={`options-${i}-${this.COMPONENT_ID}`}
              className={`option
                ${option.value === active ? 'active' : ''}`}
              onClick={() => this.onOptionClick(option, index)}
              data-test={`options-item-${index}-${i}`}
            >
              <span data-test={`options-item-${index}-${i}-text`}>
                {option.label}
              </span>
              {!_get(option, 'children.length') && (
                <Icon className="option-execute-icon" type="play" />
              )}
              {!!_get(option, 'children.length') && (
                <Icon className="option-arrow" type="caret-right" />
              )}
            </div>
          )
        })}
        {hasNoChildren && mostRecentOptionLabel && (
          <div
            className="option"
            data-test="see-more-option"
            onClick={() => {
              this.props.onSeeMoreClick(mostRecentOptionLabel)
            }}
          >
            <span>
              <Icon type="light-bulb" /> See more...
            </span>
          </div>
        )}
      </div>
    )
  }

  onOptionClick = (option, index) => {
    if (option.children) {
      // If an earlier option is clicked, reset the options and active keys arrays
      const newOptionsArray = this.state.optionsArray.slice(0, index + 1)
      newOptionsArray[index].active = option.value // set new active option
      newOptionsArray.push({ options: option.children }) // add new option list container
      this.setState({
        optionsArray: newOptionsArray,
        mostRecentOption: option,
      })
    } else {
      this.props.onFinalOptionClick(option)
      const newActiveKeys = [...this.state.activeKeys, option.value]
      this.setState({ activeKeys: newActiveKeys })
    }
  }

  render = () => {
    return (
      <div
        id={`chata-cascader-${this.COMPONENT_ID}`}
        className="chata-cascader"
        data-test="chata-cascader"
      >
        {this.state.optionsArray.map((optionsObject, index) => {
          return this.renderOptionsList({
            options: optionsObject.options,
            active: optionsObject.active,
            index,
          })
        })}
      </div>
    )
  }
}
