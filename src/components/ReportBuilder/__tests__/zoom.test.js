import React from 'react'
import { render } from '@testing-library/react'
import { FIT, fitScale, readZoom, storeZoom, ZoomFrame } from '../components/ZoomFrame'
import { getUnscaledClientRect } from '../../Charts/measureScale'

// jsdom lays nothing out: these give the frame's container and its content a size.
const layout = ({ available, width, height }) => {
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
    return this.getAttribute('data-test') === 'zoom-host' ? available : 0
  })
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () {
    return this.classList.contains('react-autoql-report-builder-zoom-content') ? width : 0
  })
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function () {
    return this.classList.contains('react-autoql-report-builder-zoom-content') ? height : 0
  })
}

const frameIn = (props) => {
  const utils = render(
    <div data-test='zoom-host'>
      <ZoomFrame {...props}>
        <div className='page'>page</div>
      </ZoomFrame>
    </div>,
  )
  const frame = utils.container.querySelector('.react-autoql-report-builder-zoom-frame')
  const content = utils.container.querySelector('.react-autoql-report-builder-zoom-content')
  return { ...utils, frame, content }
}

afterEach(() => {
  jest.restoreAllMocks()
  window.localStorage.clear()
})

describe('fit', () => {
  it('fits the width in whole percents, rounded down, never above true size or below a quarter', () => {
    expect(fitScale(408, 816)).toBe(0.5)
    expect(fitScale(800, 1056)).toBe(0.75)
    expect(fitScale(2000, 816)).toBe(1)
    expect(fitScale(100, 1056)).toBe(0.25)
    expect(fitScale(0, 816)).toBe(1)
    expect(fitScale(408, 0)).toBe(1)
  })
})

describe('the remembered zoom', () => {
  it('starts at fit, and remembers a level picked in this browser', () => {
    expect(readZoom()).toBe(FIT)
    storeZoom(0.75)
    expect(readZoom()).toBe(0.75)
    storeZoom(FIT)
    expect(readZoom()).toBe(FIT)
  })

  it('ignores a value it doesn’t offer', () => {
    window.localStorage.setItem('react-autoql-report-builder-zoom', '0.6')
    expect(readZoom()).toBe(FIT)
    window.localStorage.setItem('react-autoql-report-builder-zoom', 'huge')
    expect(readZoom()).toBe(FIT)
  })
})

describe('ZoomFrame', () => {
  it('shows its content as it is when nothing can be measured', () => {
    const { frame, content } = frameIn({ zoom: 0.5 })
    expect(frame.getAttribute('style')).toBeNull()
    expect(content.getAttribute('style')).toBeNull()
    expect(content.hasAttribute('data-react-autoql-scale')).toBe(false)
  })

  it('fits the content to the space it’s in, takes the fitted size, and says what fit came to', () => {
    layout({ available: 408, width: 816, height: 1056 })
    const onFit = jest.fn()
    const { frame, content } = frameIn({ zoom: FIT, onFit })
    expect(content.style.transform).toBe('scale(0.5)')
    expect(content.getAttribute('data-react-autoql-scale')).toBe('0.5')
    expect(frame.style.width).toBe('408px')
    expect(frame.style.height).toBe('528px')
    expect(onFit).toHaveBeenLastCalledWith(0.5)
  })

  it('shows a picked zoom whatever the space, and leaves true size untransformed', () => {
    layout({ available: 408, width: 816, height: 1056 })
    const big = frameIn({ zoom: 1.5 })
    expect(big.content.style.transform).toBe('scale(1.5)')
    expect(big.frame.style.width).toBe('1224px')
    big.unmount()

    const actual = frameIn({ zoom: 1 })
    expect(actual.content.getAttribute('style')).toBeNull()
    expect(actual.content.hasAttribute('data-react-autoql-scale')).toBe(false)
  })

  it('doesn’t enlarge content that already fits', () => {
    layout({ available: 1200, width: 816, height: 1056 })
    const onFit = jest.fn()
    const { content } = frameIn({ zoom: FIT, onFit })
    expect(content.getAttribute('style')).toBeNull()
    expect(onFit).toHaveBeenLastCalledWith(1)
  })

  it('lets a chart inside measure at true size', () => {
    layout({ available: 408, width: 816, height: 1056 })
    const { container } = frameIn({ zoom: FIT })
    const page = container.querySelector('.page')
    page.getBoundingClientRect = () => ({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 210,
      bottom: 120,
      width: 200,
      height: 100,
    })
    expect(getUnscaledClientRect(page)).toMatchObject({ width: 400, height: 200 })
  })
})
