import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'

import { Icon } from '../Icon'
import { CustomScrollbars } from '../CustomScrollbars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { CustomColumnTypes } from 'autoql-fe-utils'

import './Cascader.scss'

export default class Cascader extends React.Component {
  COMPONENT_ID = uuid()

  static propTypes = {
    options: PropTypes.arrayOf(PropTypes.shape({})),
    onFinalOptionClick: PropTypes.func,
    onSeeMoreClick: PropTypes.func,
    showSeeMoreButton: PropTypes.bool,
    customContent: PropTypes.element || PropTypes.func,
  }

  static defaultProps = {
    options: [],
    onFinalOptionClick: () => {},
    onSeeMoreClick: undefined,
    showSeeMoreButton: true,
    customContent: null,
  }

  state = {
    activeKeys: [],
    mostRecentOption: undefined,
    optionsArray: [{ options: this.props.options }],
  }

  componentDidUpdate = (prevProps) => {
    const optionValues = this.props.options.map((option) => option.value)
    const prevOptionValues = prevProps.options.map((option) => option.value)
    if (!_isEqual(optionValues, prevOptionValues)) {
      this.setState({ optionsArray: [{ options: this.props.options }], activeKeys: [], mostRecentOption: undefined })
    }
  }

  renderOptionsList = ({ options, active, index }) => {
    if (!options?.length) {
      return null
    }

    const isLastGroup = index === (this.state.optionsArray?.length ?? 0) - 1
    const isFirstGroup = index === 0
    const mostRecentOptionLabel = this.state.mostRecentOption?.label
    const hasNoChildren = options?.every((option) => !option.children)

    return (
      <div
        key={`options-list-${index}-${this.COMPONENT_ID}`}
        className={`options-container
            ${isLastGroup ? 'cascader-options-container-visible' : 'cascader-options-container-hidden'}`}
        data-test={`options-list-${index}`}
      >
        {!isFirstGroup && (
          <div
            className='options-title'
            onClick={() => {
              const newArray = this.state.optionsArray.slice(0, index).map((opt, i) => {
                if (i === index - 1) {
                  return {
                    ...opt,
                    active: undefined,
                  }
                }
                return opt
              })

              this.setState({ optionsArray: newArray })
              this.props.onBackClick?.()
            }}
          >
            <span data-test={`cascader-back-arrow-${index}`}>
              <Icon className='cascader-back-arrow' type='caret-left' />{' '}
              <span data-test='options-title'>{mostRecentOptionLabel}</span>
            </span>
          </div>
        )}
        <div className='react-autoql-cascader-scrollbar-container'>
          <CustomScrollbars autoHide={false}>
            {options.map((option, i) => {
              return (
                <div
                  key={`options-${i}-${this.COMPONENT_ID}`}
                  className={`option
                  ${option.value === active ? 'react-autoql-cascader-option-active' : ''}
                  ${option.customContent ? 'react-autoql-cascader-option-custom-content' : ''}`}
                  onClick={() => this.onOptionClick(option, index)}
                  data-test={`options-item-${index}-${i}`}
                >
                  {option.customContent ? (
                    typeof option.customContent === CustomColumnTypes.FUNCTION ? (
                      option.customContent()
                    ) : (
                      option.customContent
                    )
                  ) : (
                    <>
                      <span className='react-autoql-cascader-option-item' data-test={`options-item-${index}-${i}-text`}>
                        {option.label}
                      </span>
                      {!option?.children?.length && this.props.action ? this.props.action : null}
                      {!!option?.children?.length && (
                        <Icon className='react-autoql-cascader-option-arrow' type='caret-right' />
                      )}
                    </>
                  )}
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
          </CustomScrollbars>
        </div>
      </div>
    )
  }

  onOptionClick = (option, index) => {
    if (!option.customContent) {
      this.props.onOptionClick?.(option)
    }

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
