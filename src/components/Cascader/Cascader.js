import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Cascader.scss'

export default class Cascader extends React.Component {
  COMPONENT_ID = uuid()

  static propTypes = {
    options: PropTypes.arrayOf(PropTypes.shape({})),
    onFinalOptionClick: PropTypes.func,
    onSeeMoreClick: PropTypes.func,
    showSeeMoreButton: PropTypes.bool,
  }

  static defaultProps = {
    options: [],
    onFinalOptionClick: () => {},
    onSeeMoreClick: undefined,
    showSeeMoreButton: true,
  }

  state = {
    activeKeys: [],
    optionsArray: [{ options: this.props.options }],
  }

  renderOptionsList = ({ options, active, index }) => {
    const isLastGroup = index === (this.state.optionsArray?.length ?? 0) - 1
    const isFirstGroup = index === 0
    const mostRecentOptionLabel = this.state.mostRecentOption?.label
    const hasNoChildren = options.every((option) => !option.children)

    return (
      <div
        key={`options-list-${index}-${this.COMPONENT_ID}`}
        className={`options-container
            ${isLastGroup ? 'visible' : 'hidden'}`}
        data-test={`options-list-${index}`}
      >
        {!isFirstGroup && (
          <div
            className='options-title'
            data-test='options-title'
            onClick={() => {
              const newArray = [...this.state.optionsArray]
              newArray.pop()
              this.setState({
                optionsArray: newArray,
              })
            }}
          >
            <span data-test={`cascader-back-arrow-${index}`}>
              <Icon className='cascader-back-arrow' type='caret-left' /> {mostRecentOptionLabel}
            </span>
          </div>
        )}
        {options.map((option, i) => {
          return (
            <div
              key={`options-${i}-${this.COMPONENT_ID}`}
              className={`option
                  ${option.value === active ? 'active' : ''}
                  ${option.disableHover ? 'react-autoql-cascader-option-disable-hover' : ''}`}
              onClick={() => this.onOptionClick(option, index)}
              data-test={`options-item-${index}-${i}`}
            >
              <span data-test={`options-item-${index}-${i}-text`}>{option.label}</span>
              {!option?.children?.length && this.props.action ? this.props.action : null}
              {!!option?.children?.length && <Icon className='option-arrow' type='caret-right' />}
            </div>
          )
        })}
        {this.props.showSeeMoreButton && hasNoChildren && mostRecentOptionLabel && this.props.onSeeMoreClick && (
          <div
            className='option'
            data-test='see-more-option'
            onClick={() => {
              this.props.onSeeMoreClick(mostRecentOptionLabel)
            }}
          >
            <span>
              <Icon type='light-bulb' /> See more...
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
      <ErrorBoundary>
        <div
          id={`react-autoql-cascader-${this.COMPONENT_ID}`}
          className='react-autoql-cascader'
          data-test='react-autoql-cascader'
        >
          {this.state.optionsArray.map((optionsObject, index) => {
            return this.renderOptionsList({
              options: optionsObject.options,
              active: optionsObject.active,
              index,
            })
          })}
        </div>
      </ErrorBoundary>
    )
  }
}
