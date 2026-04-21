import React, { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import { Icon } from '../../Icon'
import { Popover } from '../../Popover'

const SankeyFilterButton = ({
  sourceValues,
  targetValues,
  selectedSources,
  selectedTargets,
  onSourcesChange,
  onTargetsChange,
  showDropdown,
  setShowDropdown,
  buttonY,
  buttonX,
  chartTooltipID,
  sourceLabel,
  targetLabel,
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredSourceValues = useMemo(() => {
    if (!searchTerm) return sourceValues
    return sourceValues.filter((val) => val.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [sourceValues, searchTerm])

  const filteredTargetValues = useMemo(() => {
    if (!searchTerm) return targetValues
    return targetValues.filter((val) => val.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [targetValues, searchTerm])

  const handleSourceToggle = (value) => {
    if (selectedSources.includes(value)) {
      onSourcesChange(selectedSources.filter((v) => v !== value))
    } else {
      onSourcesChange([...selectedSources, value])
    }
  }

  const handleTargetToggle = (value) => {
    if (selectedTargets.includes(value)) {
      onTargetsChange(selectedTargets.filter((v) => v !== value))
    } else {
      onTargetsChange([...selectedTargets, value])
    }
  }

  const handleShowAllSources = () => {
    onSourcesChange([...sourceValues])
  }

  const handleHideAllSources = () => {
    onSourcesChange([])
  }

  const handleShowAllTargets = () => {
    onTargetsChange([...targetValues])
  }

  const handleHideAllTargets = () => {
    onTargetsChange([])
  }

  const tooltipHtml = `<strong>Filter Flows</strong><br/>Show/hide specific ${sourceLabel.toLowerCase()} and ${targetLabel.toLowerCase()}`

  const renderFilterSection = (title, values, selectedValues, onToggle, onShowAll, onHideAll) => {
    return (
      <div className='sankey-filter-section'>
        <div className='sankey-filter-section-header'>
          <span className='sankey-filter-section-title'>{title}</span>
          <div className='sankey-filter-section-buttons'>
            <button className='sankey-filter-quick-btn' onClick={onShowAll}>
              All
            </button>
            <button className='sankey-filter-quick-btn' onClick={onHideAll}>
              None
            </button>
          </div>
        </div>
        <div className='sankey-filter-items'>
          {values.length === 0 ? (
            <div className='sankey-filter-empty'>No matches found</div>
          ) : (
            values.map((value) => {
              const isSelected = selectedValues.includes(value)
              return (
                <label key={value} className='sankey-filter-item'>
                  <input
                    type='checkbox'
                    checked={isSelected}
                    onChange={() => onToggle(value)}
                    className='sankey-filter-checkbox'
                  />
                  <span className='sankey-filter-label'>{value}</span>
                </label>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <g className='sankey-filter-button-group'>
      <Popover
        isOpen={showDropdown}
        onClickOutside={() => setShowDropdown(false)}
        content={
          <div className='sankey-filter-dropdown-popover-content'>
            <div className='sankey-filter-dropdown-title'>Filter Flows</div>
            <div className='sankey-filter-search'>
              <input
                type='text'
                placeholder='Search...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='sankey-filter-search-input'
                autoFocus
              />
            </div>
            <div className='sankey-filter-dropdown-container'>
              {renderFilterSection(
                sourceLabel,
                filteredSourceValues,
                selectedSources,
                handleSourceToggle,
                handleShowAllSources,
                handleHideAllSources,
              )}
              {renderFilterSection(
                targetLabel,
                filteredTargetValues,
                selectedTargets,
                handleTargetToggle,
                handleShowAllTargets,
                handleHideAllTargets,
              )}
            </div>
          </div>
        }
        positions={['left', 'bottom', 'top']}
        align='start'
        padding={5}
      >
        <g className='sankey-filter-button' transform={`translate(${buttonX}, ${buttonY})`}>
          <rect
            className='sankey-filter-button-rect'
            width='35'
            height='35'
            rx='4'
            strokeWidth='1'
            onClick={(e) => {
              e.stopPropagation()
              setShowDropdown(!showDropdown)
            }}
            data-tooltip-id={chartTooltipID}
            data-tooltip-html={tooltipHtml}
            style={{ cursor: 'pointer' }}
          />
          <g transform='translate(8, 8)' className='sankey-filter-button-icon' style={{ pointerEvents: 'none' }}>
            <foreignObject width='19' height='19'>
              <Icon type='filter' />
            </foreignObject>
          </g>
        </g>
      </Popover>
    </g>
  )
}

SankeyFilterButton.propTypes = {
  sourceValues: PropTypes.arrayOf(PropTypes.string).isRequired,
  targetValues: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedSources: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedTargets: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSourcesChange: PropTypes.func.isRequired,
  onTargetsChange: PropTypes.func.isRequired,
  showDropdown: PropTypes.bool.isRequired,
  setShowDropdown: PropTypes.func.isRequired,
  buttonY: PropTypes.number,
  buttonX: PropTypes.number,
  chartTooltipID: PropTypes.string,
  sourceLabel: PropTypes.string,
  targetLabel: PropTypes.string,
}

SankeyFilterButton.defaultProps = {
  buttonY: 10,
  buttonX: 10,
  chartTooltipID: undefined,
  sourceLabel: 'Sources',
  targetLabel: 'Targets',
}

export default SankeyFilterButton

