import React from 'react'
import { mount } from 'enzyme'
import OptionsToolbar from '../../OptionsToolbar/OptionsToolbar'
import VizToolbar from '../../VizToolbar/VizToolbar'
import { Tooltip } from '../../Tooltip'

describe('Drilldown tooltip deduplication', () => {
  test('when parent provides shared tooltipID, toolbars do not mount local Tooltip and buttons use shared ID', () => {
    const sharedID = 'shared-drilldown-tooltip'

    const optionsWrapper = mount(<OptionsToolbar tooltipID={sharedID} />)
    const vizWrapper = mount(<VizToolbar tooltipID={sharedID} />)

    // Toolbars should not mount local Tooltip instances when parent manages the ID
    expect(optionsWrapper.find(Tooltip).exists()).toBe(false)
    expect(vizWrapper.find(Tooltip).exists()).toBe(false)

    // Buttons inside the toolbars should still receive the shared tooltipID
    optionsWrapper.find('Button').forEach((btn) => {
      expect(btn.prop('tooltipID')).toBe(sharedID)
    })
    vizWrapper.find('Button').forEach((btn) => {
      expect(btn.prop('tooltipID')).toBe(sharedID)
    })

    optionsWrapper.unmount()
    vizWrapper.unmount()
  })
})
