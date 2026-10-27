import React from 'react'
import { shallow } from 'enzyme'
import PerfectScrollbar from 'react-perfect-scrollbar'

import CustomScrollbars from './CustomScrollbars'

describe('CustomScrollbars', () => {
  // Hiding the rail with CSS isn't enough: perfect-scrollbar still scrolls a suppressed axis on wheel
  // and trackpad gestures unless it's told not to
  test('tells perfect-scrollbar which axes are suppressed', () => {
    const wrapper = shallow(
      <CustomScrollbars suppressScrollX options={{ wheelSpeed: 2 }}>
        <div />
      </CustomScrollbars>,
    )
    expect(wrapper.find(PerfectScrollbar).prop('options')).toEqual(
      expect.objectContaining({ suppressScrollX: true, wheelSpeed: 2 }),
    )
  })

  test('leaves both axes scrollable by default', () => {
    const wrapper = shallow(
      <CustomScrollbars>
        <div />
      </CustomScrollbars>,
    )
    const options = wrapper.find(PerfectScrollbar).prop('options')
    expect(options.suppressScrollX).toBeFalsy()
    expect(options.suppressScrollY).toBeFalsy()
  })
})
