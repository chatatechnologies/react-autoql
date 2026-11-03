import { stickyShift } from '../components/FormattingBar'

// The formatting bar stays in view as the canvas scrolls (RW-346): how far it moves down from its place above the
// block being edited. Screen pixels in, page pixels out.
describe('stickyShift', () => {
  const view = { viewTop: 106, blockBottom: 900, barHeight: 38 }

  it('stays above its block while that place is in view', () => {
    expect(stickyShift({ ...view, naturalTop: 200 })).toBe(0)
    expect(stickyShift({ ...view, naturalTop: 106 })).toBe(0)
  })

  it('moves down to just under the top of the canvas once that place scrolls out of view', () => {
    expect(stickyShift({ ...view, naturalTop: -94 })).toBe(200)
  })

  it('never goes past the bottom of its block', () => {
    // The block's end is in view: the bar sits on it.
    expect(stickyShift({ ...view, naturalTop: -500, blockBottom: 120 })).toBe(582)
    // The block is all but gone: the bar goes with it.
    expect(stickyShift({ ...view, naturalTop: -94, blockBottom: -200 })).toBe(0)
  })

  it('moves in the page’s own pixels when the page is zoomed', () => {
    expect(stickyShift({ ...view, naturalTop: -94, zoom: 0.5 })).toBe(400)
    expect(stickyShift({ ...view, naturalTop: -94, zoom: 2 })).toBe(100)
  })
})
