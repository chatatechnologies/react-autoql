import React from 'react'
import { shallow } from 'enzyme'
import Menu, { MenuItem } from './Menu'

describe('MenuItem', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const wrapper = shallow(<MenuItem title='Test' />)
      expect(wrapper.find('.react-autoql-menu-item').exists()).toBe(true)
    })

    test('renders title text', () => {
      const wrapper = shallow(<MenuItem title='My Item' />)
      expect(wrapper.text()).toContain('My Item')
    })

    test('renders subtitle when provided', () => {
      const wrapper = shallow(<MenuItem title='Item' subtitle='Sub' />)
      expect(wrapper.text()).toContain('Sub')
      expect(wrapper.find('.select-option-value-subtitle').exists()).toBe(true)
    })

    test('does not render subtitle element when subtitle not provided', () => {
      const wrapper = shallow(<MenuItem title='Item' />)
      expect(wrapper.find('.select-option-value-subtitle').exists()).toBe(false)
    })

    test('renders icon when provided', () => {
      const wrapper = shallow(<MenuItem title='Item' icon='edit' />)
      expect(wrapper.find('.react-autoql-menu-icon').exists()).toBe(true)
    })

    test('does not render icon element when icon not provided', () => {
      const wrapper = shallow(<MenuItem title='Item' />)
      expect(wrapper.find('.react-autoql-menu-icon').exists()).toBe(false)
    })

    test('applies active class when active=true', () => {
      const wrapper = shallow(<MenuItem title='Item' active={true} />)
      expect(wrapper.find('.react-autoql-menu-item').hasClass('active')).toBe(true)
    })

    test('does not apply active class when active=false', () => {
      const wrapper = shallow(<MenuItem title='Item' active={false} />)
      expect(wrapper.find('.react-autoql-menu-item').hasClass('active')).toBe(false)
    })

    test('applies disabled class when disabled=true', () => {
      const wrapper = shallow(<MenuItem title='Item' disabled={true} />)
      expect(wrapper.find('.react-autoql-menu-item').hasClass('react-autoql-menu-item-disabled')).toBe(true)
    })
  })

  describe('interaction', () => {
    test('calls onClick when clicked and not disabled', () => {
      const onClick = jest.fn()
      const wrapper = shallow(<MenuItem title='Item' onClick={onClick} />)
      wrapper.find('.react-autoql-menu-item').simulate('click', { stopPropagation: jest.fn() })
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    test('does not call onClick when disabled', () => {
      const onClick = jest.fn()
      const wrapper = shallow(<MenuItem title='Item' onClick={onClick} disabled={true} />)
      wrapper.find('.react-autoql-menu-item').simulate('click', { stopPropagation: jest.fn() })
      expect(onClick).not.toHaveBeenCalled()
    })

    test('stopPropagation is called on click', () => {
      const stopPropagation = jest.fn()
      const wrapper = shallow(<MenuItem title='Item' onClick={jest.fn()} />)
      wrapper.find('.react-autoql-menu-item').simulate('click', { stopPropagation })
      expect(stopPropagation).toHaveBeenCalled()
    })
  })
})

describe('Menu', () => {
  test('renders without crashing', () => {
    const wrapper = shallow(<Menu />)
    expect(wrapper.find('.react-autoql-menu').exists()).toBe(true)
  })

  test('renders children', () => {
    const wrapper = shallow(
      <Menu>
        <MenuItem title='Item 1' />
        <MenuItem title='Item 2' />
      </Menu>,
    )
    expect(wrapper.find(MenuItem).length).toBe(2)
  })

  test('applies custom className', () => {
    const wrapper = shallow(<Menu className='my-custom-menu' />)
    expect(wrapper.find('.react-autoql-menu').hasClass('my-custom-menu')).toBe(true)
  })
})
