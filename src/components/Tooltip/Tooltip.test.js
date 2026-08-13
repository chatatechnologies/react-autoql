import React from 'react'
import { mount } from 'enzyme'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { Tooltip } from './Tooltip'

// A stacking context that would trap an inline-rendered tooltip beneath body-level portals
const Host = ({ children }) => <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>

// react-tooltip renders no DOM at all until it has something to show
const openTooltipProps = { isOpen: true, content: 'hello' }

describe('Tooltip portalling', () => {
  it('renders into document.body rather than inside its parent stacking context', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const wrapper = mount(
      <Host>
        <Tooltip tooltipId='portal-test-id' {...openTooltipProps} />
      </Host>,
      { attachTo: container },
    )

    expect(container.querySelector('#portal-test-id')).toBeNull()
    expect(document.body.querySelector('#portal-test-id')?.parentElement).toBe(document.body)

    wrapper.detach()
    document.body.removeChild(container)
  })

  it('portals to document.body specifically', () => {
    const wrapper = mount(<Tooltip tooltipId='container-test-id' {...openTooltipProps} />)

    const portal = wrapper.find('Portal')
    expect(portal).toHaveLength(1)
    expect(portal.at(0).prop('containerInfo')).toBe(document.body)

    wrapper.unmount()
  })

  it('cleans the portalled node out of the body on unmount', () => {
    const wrapper = mount(<Tooltip tooltipId='unmount-test-id' {...openTooltipProps} />)
    expect(document.body.querySelector('#unmount-test-id')).not.toBeNull()

    wrapper.unmount()
    expect(document.body.querySelector('#unmount-test-id')).toBeNull()
  })

  it('keeps the generated fallback id stable across re-renders so anchors are not lost', () => {
    const wrapper = mount(<Tooltip />)
    const initialId = wrapper.find(ReactTooltip).prop('id')

    expect(initialId).toMatch(/^react-autoql-tooltip-default-id-/)

    wrapper.setProps({ className: 'changed' })
    wrapper.update()

    expect(wrapper.find(ReactTooltip).prop('id')).toBe(initialId)

    wrapper.unmount()
  })

  it('uses the caller-provided tooltipId when given', () => {
    const wrapper = mount(<Tooltip tooltipId='explicit-id' />)
    expect(wrapper.find(ReactTooltip).prop('id')).toBe('explicit-id')
    wrapper.unmount()
  })

  it('forwards extra props through to react-tooltip', () => {
    const wrapper = mount(<Tooltip tooltipId='strategy-id' positionStrategy='fixed' />)
    expect(wrapper.find(ReactTooltip).prop('positionStrategy')).toBe('fixed')
    wrapper.unmount()
  })
})
