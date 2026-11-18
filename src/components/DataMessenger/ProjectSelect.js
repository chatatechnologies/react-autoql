import React, { useState } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'
import { Popover } from '../Popover'

/**
 * Project switcher for the Data Messenger header.
 *
 * Sits with the window controls as its own pill rather than standing in for the
 * header title, so the page name stays visible whichever project is active. Built on
 * the shared Popover for the same reason as the agent's ModelSelect: the shared
 * Select's trigger is a form control, and the header wants a quiet chip.
 */
const ProjectSelect = ({ projects, value, onChange, popoverParentElement, tooltipID }) => {
  const [isOpen, setIsOpen] = useState(false)

  if (!projects?.length) {
    return null
  }

  const selected = projects.find((project) => project?.projectId === value)

  const selectProject = (project) => {
    setIsOpen(false)
    if (project.projectId !== value) {
      onChange(project.projectId)
    }
  }

  const content = (
    <div className='react-autoql-project-select-menu' role='menu'>
      <div className='react-autoql-project-select-menu-title'>Projects</div>
      <div className='react-autoql-project-select-menu-list'>
        {projects.map((project) => {
          const isActive = project.projectId === value
          return (
            <div
              key={project.projectId}
              role='menuitemradio'
              aria-checked={isActive}
              tabIndex={0}
              className={`react-autoql-project-select-row${isActive ? ' is-active' : ''}`}
              onClick={() => selectProject(project)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  selectProject(project)
                }
              }}
            >
              {/* Display names can carry markup from the host, as they did in the old Select. */}
              <span
                className='react-autoql-project-select-row-name'
                dangerouslySetInnerHTML={{ __html: project.displayName }}
              />
              {isActive && <Icon type='check' className='react-autoql-project-select-check' />}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <Popover
      isOpen={isOpen}
      content={content}
      containerClassName='react-autoql-project-select-popover'
      positions={['bottom', 'left', 'top', 'right']}
      align='end'
      padding={6}
      parentElement={popoverParentElement}
      onClickOutside={() => setIsOpen(false)}
    >
      <button
        className={`react-autoql-project-select-pill${isOpen ? ' is-open' : ''}`}
        data-test='data-messenger-project-select'
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup='menu'
        aria-expanded={isOpen}
        data-tooltip-content={isOpen ? undefined : 'Switch project'}
        data-tooltip-id={tooltipID}
      >
        <Icon type='layers' className='react-autoql-project-select-pill-icon' />
        {selected ? (
          <span
            className='react-autoql-project-select-pill-label'
            dangerouslySetInnerHTML={{ __html: selected.displayName }}
          />
        ) : (
          <span className='react-autoql-project-select-pill-label is-placeholder'>Select project</span>
        )}
        <Icon type='caret-down' className='react-autoql-project-select-pill-caret' />
      </button>
    </Popover>
  )
}

ProjectSelect.propTypes = {
  projects: PropTypes.arrayOf(
    PropTypes.shape({
      projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      displayName: PropTypes.string,
    }),
  ),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  popoverParentElement: PropTypes.any,
  tooltipID: PropTypes.string,
}

ProjectSelect.defaultProps = {
  projects: [],
  value: undefined,
  onChange: () => {},
  popoverParentElement: undefined,
  tooltipID: undefined,
}

export default ProjectSelect
