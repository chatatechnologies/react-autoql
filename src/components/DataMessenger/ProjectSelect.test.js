import React from 'react'
import { mount } from 'enzyme'
import { findByTestAttr } from '../../../test/testUtils'
import ProjectSelect from './ProjectSelect'

jest.mock('react-tooltip', () => ({ Tooltip: () => null, __esModule: true }))

const projects = [
  { projectId: 'project-a', displayName: 'Project A' },
  { projectId: 'project-b', displayName: '<b>Project B</b>' },
]

const setup = (props = {}) => mount(<ProjectSelect projects={projects} value='project-a' {...props} />)

const openMenu = (wrapper) => {
  findByTestAttr(wrapper, 'data-messenger-project-select').simulate('click')
  wrapper.update()
}

describe('ProjectSelect', () => {
  test('renders nothing without projects', () => {
    expect(mount(<ProjectSelect projects={[]} />).isEmptyRender()).toBe(true)
  })

  test('shows the selected project on the pill', () => {
    const wrapper = setup({ value: 'project-b' })
    expect(wrapper.find('.react-autoql-project-select-pill-label').text()).toBe('Project B')
  })

  test('shows a placeholder when no project matches', () => {
    const wrapper = setup({ value: 'missing' })
    expect(wrapper.find('.react-autoql-project-select-pill-label').text()).toBe('Select project')
  })

  test('lists every project with the current one checked', () => {
    const wrapper = setup()
    openMenu(wrapper)

    const rows = wrapper.find('.react-autoql-project-select-row')
    expect(rows).toHaveLength(2)
    expect(rows.at(0).hasClass('is-active')).toBe(true)
    expect(rows.at(1).hasClass('is-active')).toBe(false)
  })

  test('reports the picked project and closes', () => {
    const onChange = jest.fn()
    const wrapper = setup({ onChange })
    openMenu(wrapper)

    wrapper.find('.react-autoql-project-select-row').at(1).simulate('click')
    wrapper.update()

    expect(onChange).toHaveBeenCalledWith('project-b')
    expect(wrapper.find('.react-autoql-project-select-row').exists()).toBe(false)
  })

  test('does not report a change when the current project is picked again', () => {
    const onChange = jest.fn()
    const wrapper = setup({ onChange })
    openMenu(wrapper)

    wrapper.find('.react-autoql-project-select-row').at(0).simulate('click')

    expect(onChange).not.toHaveBeenCalled()
  })
})
