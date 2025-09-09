import React from 'react'
import { shallow } from 'enzyme'
import { QueryOutput as QueryOutputWithoutTheme } from './QueryOutput'

describe('QueryOutput displayType restoration', () => {
  let wrapper, instance

  beforeEach(() => {
    wrapper = shallow(<QueryOutputWithoutTheme />)
    instance = wrapper.instance()
    instance.setState = jest.fn()
  })

  test('refreshLayout does not throw if ReverseTranslation ref is missing', () => {
    instance.reverseTranslationRef = null
    expect(() => instance.refreshLayout()).not.toThrow()
  })
})
