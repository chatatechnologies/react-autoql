import React, { forwardRef } from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'

import { AGG_TYPES } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { CustomScrollbars } from '../CustomScrollbars'

import './AddColumnBtn.scss'

const AggMenu = forwardRef((props, ref) => {
  const { handleAggMenuItemClick } = props

  const COMPONENT_KEY = React.useMemo(() => uuid(), [])

  return (
    <CustomScrollbars autoHide={false} suppressScrollX>
      <div className='more-options-menu react-autoql-add-column-menu' key={`agg-menu-${COMPONENT_KEY}`}>
        <ul className='context-menu-list'>
          <div className='react-autoql-input-label'>Aggregation</div>
          {Object.keys(AGG_TYPES)
            .filter((aggType) => !!AGG_TYPES[aggType]?.sqlFn)
            .map((aggType, i) => {
              let icon = AGG_TYPES[aggType].symbol
              if (AGG_TYPES[aggType].icon) {
                icon = <Icon type={AGG_TYPES[aggType].icon} />
              }

              return (
                <li
                  key={`agg-menu-item-${i}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleAggMenuItemClick(AGG_TYPES[aggType])
                  }}
                >
                  <div className='react-autoql-add-column-menu-item'>
                    <span className='agg-select-list-symbol'>{icon}</span>
                    <span>{AGG_TYPES[aggType].displayName}</span>
                  </div>
                </li>
              )
            })}
        </ul>
      </div>
    </CustomScrollbars>
  )
})

AggMenu.propTypes = {
  handleAggMenuItemClick: PropTypes.func,
}

AggMenu.defaultProps = {
  handleAggMenuItemClick: () => {},
}

export default AggMenu
