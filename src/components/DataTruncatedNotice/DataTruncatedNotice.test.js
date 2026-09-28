import React from 'react'
import { mount } from 'enzyme'

import DataTruncatedNotice from './DataTruncatedNotice'

const setup = (props = {}) => mount(<DataTruncatedNotice {...props} />)

describe('DataTruncatedNotice', () => {
  describe('banner', () => {
    // Deliberately no total: nothing in the response counts the rows, so any total
    // shown here would be a number nobody measured.
    test('names how much is shown, and claims no total', () => {
      const wrapper = setup({ variant: 'banner', previewRowCount: 10 })

      expect(wrapper.text()).toContain('first 10 rows')
      // No "10 of 4,512" phrasing - there is no second number to put there.
      expect(wrapper.text()).not.toMatch(/\d+ of \d/)
    })

    test('offers the data back', () => {
      const onRestore = jest.fn()
      const wrapper = setup({ variant: 'banner', onRestore })

      wrapper.find('button.react-autoql-data-truncated-restore').simulate('click')

      expect(onRestore).toHaveBeenCalled()
    })
  })

  describe('card', () => {
    test('says the data is gone rather than drawing anything', () => {
      const wrapper = setup({ variant: 'card', displayType: 'column-chart' })

      expect(wrapper.find('.react-autoql-data-truncated-card').exists()).toBe(true)
      expect(wrapper.text()).toContain('Chart data was cleared to save memory')
    })

    test('falls back to a chart icon when the display type is unknown', () => {
      expect(() => setup({ variant: 'card', displayType: undefined })).not.toThrow()
    })
  })

  // The shared Button renders its own spinner in place of the icon and marks itself
  // disabled with a class, so that is what "restoring" looks like here.
  test('while restoring, shows the spinner and disables itself', () => {
    const wrapper = setup({ isRestoring: true })
    const button = wrapper.find('button.react-autoql-data-truncated-restore')

    expect(button.hasClass('disabled')).toBe(true)
    expect(wrapper.find('[data-test="react-autoql-btn-loading"]').exists()).toBe(true)
  })

  // It has to look like every other control in the messenger, not a bespoke one.
  test('uses the shared button rather than a hand-rolled one', () => {
    const wrapper = setup()
    const button = wrapper.find('button.react-autoql-data-truncated-restore')

    expect(button.hasClass('react-autoql-btn')).toBe(true)
    expect(button.hasClass('react-autoql-btn-medium')).toBe(true)
  })

  test('a failed restore is reported next to the control, which becomes a retry', () => {
    const wrapper = setup({ error: 'Data could not be loaded.' })

    expect(wrapper.find('.react-autoql-data-truncated-error').text()).toBe('Data could not be loaded.')
    expect(wrapper.text()).toContain('Try again')
    expect(wrapper.text()).not.toContain('Restore data')
  })
})
