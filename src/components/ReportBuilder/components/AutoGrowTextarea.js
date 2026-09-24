import React from 'react'

// A native textarea that grows with its text, so a heading or paragraph edits in place on the sheet
// without contenteditable (whose caret React can't keep when it re-renders). Its height follows its
// width too: the sheet reflows with the window, the panels and the block's Full/Half width.
export class AutoGrowTextarea extends React.Component {
  ref = React.createRef()

  componentDidMount() {
    this.resize()
    if (typeof ResizeObserver !== 'undefined' && this.ref.current) {
      this.observer = new ResizeObserver(this.onResize)
      this.observer.observe(this.ref.current)
    }
    // Text rewraps when a web font replaces its fallback.
    document.fonts?.addEventListener?.('loadingdone', this.resize)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value || prevProps.style !== this.props.style) {
      this.resize()
    }
  }

  componentWillUnmount() {
    this.observer?.disconnect()
    document.fonts?.removeEventListener?.('loadingdone', this.resize)
  }

  // Only a change of width needs a new height; the height this sets is itself a resize.
  onResize = (entries) => {
    const width = entries[0]?.contentRect?.width
    if (width !== this.lastWidth) {
      this.lastWidth = width
      this.resize()
    }
  }

  resize = () => {
    const el = this.ref.current
    if (!el) return
    el.style.height = 'auto'
    if (el.scrollHeight) {
      el.style.height = `${el.scrollHeight}px`
    }
  }

  onChange = (e) => {
    const { singleLine, onChange } = this.props
    const text = singleLine ? e.target.value.replace(/\s*\n\s*/g, ' ') : e.target.value
    onChange?.(text)
  }

  onKeyDown = (e) => {
    if (this.props.singleLine && e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  render() {
    const { singleLine, onChange, value, ...rest } = this.props
    return (
      <textarea
        {...rest}
        ref={this.ref}
        rows={1}
        value={value || ''}
        onChange={this.onChange}
        onKeyDown={this.onKeyDown}
      />
    )
  }
}
