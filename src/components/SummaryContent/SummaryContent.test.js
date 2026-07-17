import React from 'react'
import { shallow } from 'enzyme'
import SummaryContent from './SummaryContent'

const setup = (props = {}) => {
  return shallow(<SummaryContent content='Test summary content' {...props} />)
}

describe('SummaryContent', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const wrapper = setup()
      expect(wrapper.find('.summary-content').exists()).toBe(true)
    })

    test('renders Analysis title by default', () => {
      const wrapper = setup()
      expect(wrapper.find('.summary-content-title').exists()).toBe(true)
    })

    test('does not render title when showTitle=false', () => {
      const wrapper = setup({ showTitle: false })
      expect(wrapper.find('.summary-content-title').exists()).toBe(false)
    })

    test('renders focusPrompt section when focusPromptUsed is provided', () => {
      const wrapper = setup({ focusPromptUsed: 'Filter by region' })
      expect(wrapper.find('.summary-content-focus-prompt').exists()).toBe(true)
    })

    test('does not render focusPrompt section when focusPromptUsed is not provided', () => {
      const wrapper = setup({ focusPromptUsed: undefined })
      expect(wrapper.find('.summary-content-focus-prompt').exists()).toBe(false)
    })

    test('applies custom className', () => {
      const wrapper = setup({ className: 'my-class' })
      expect(wrapper.find('.summary-content').hasClass('my-class')).toBe(true)
    })

    test('applies custom titleClassName', () => {
      const wrapper = setup({ titleClassName: 'title-class' })
      expect(wrapper.find('.summary-content-title').hasClass('title-class')).toBe(true)
    })

    test('renders ReactMarkdown for content', () => {
      const wrapper = setup({ content: '**Bold text**' })
      expect(wrapper.find('ReactMarkdown').exists()).toBe(true)
    })

    test('passes content string to ReactMarkdown', () => {
      const wrapper = setup({ content: 'Hello world' })
      expect(wrapper.find('ReactMarkdown').prop('children')).toBe('Hello world')
    })
  })
})
