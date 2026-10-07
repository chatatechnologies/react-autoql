import { renderedTextBefore, sourceOffsetAfter } from '../components/textCaret'

describe('sourceOffsetAfter', () => {
  const at = (source, printed) => source.slice(0, sourceOffsetAfter(source, printed))

  it('follows plain text', () => {
    expect(at('Growth was uneven.', 'Growth was')).toBe('Growth was')
    expect(sourceOffsetAfter('Growth', '')).toBe(0)
  })

  it('skips Markdown that doesn’t print', () => {
    expect(at('Up **18%** on Q2.', 'Up 18')).toBe('Up **18')
    expect(at('Up **18%** on Q2.', 'Up 18%')).toBe('Up **18%')
    expect(at('- one\n- two', 'onetw')).toBe('- one\n- tw')
    expect(at('## Key points\nMore', 'Key points')).toBe('## Key points')
    expect(at('a \\*literal\\* star', 'a *lit')).toBe('a \\*lit')
    expect(at('Q&amp;A time', 'Q&A')).toBe('Q&amp;A')
  })

  it('goes on to the next word after a space, or to the next line', () => {
    expect(at('Up **18%** on Q2.', 'Up 18% on ')).toBe('Up **18%** on ')
    expect(at('First.\n\nSecond.', 'First.\n')).toBe('First.\n\n')
  })

  it('gives the end when the printed text can’t be followed', () => {
    expect(sourceOffsetAfter('Growth', 'Grow!')).toBe('Growth'.length)
    expect(sourceOffsetAfter(null, 'x')).toBe(0)
  })
})

describe('renderedTextBefore', () => {
  const original = document.caretRangeFromPoint
  afterEach(() => {
    if (original) document.caretRangeFromPoint = original
    else delete document.caretRangeFromPoint
  })

  const mount = () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>Up <strong>18%</strong> on Q2.</p>'
    document.body.appendChild(container)
    return container
  }

  it('is the text before the point clicked', () => {
    const container = mount()
    const node = container.querySelector('p').lastChild // " on Q2."
    document.caretRangeFromPoint = jest.fn(() => {
      const range = document.createRange()
      range.setStart(node, 4)
      range.collapse(true)
      return range
    })
    expect(renderedTextBefore(container, 10, 10)).toBe('Up 18% on ')
    expect(document.caretRangeFromPoint).toHaveBeenCalledWith(10, 10)
    container.remove()
  })

  it('is null outside the container, or when the browser can’t say', () => {
    const container = mount()
    const outside = document.createTextNode('elsewhere')
    document.body.appendChild(outside)
    document.caretRangeFromPoint = () => {
      const range = document.createRange()
      range.setStart(outside, 2)
      return range
    }
    expect(renderedTextBefore(container, 0, 0)).toBeNull()
    delete document.caretRangeFromPoint
    expect(renderedTextBefore(container, 0, 0)).toBeNull()
    expect(renderedTextBefore(null, 0, 0)).toBeNull()
    container.remove()
    outside.remove()
  })
})
