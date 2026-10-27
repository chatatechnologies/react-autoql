import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from './components/icons'
import { RS } from './workspace/reportsConstants'
import { REPORTS_STRINGS } from './workspace/reportsStrings'

// ReportBuilder and Reports as the package exports them. Their code (onDemandCode.js: the builder, its text editor,
// page layout and printing) is most of this package's size, so an app fetches it the first time one of them is
// shown rather than with the rest. Meanwhile, and if it can't be fetched, they say so in their place. Props pass
// through unchanged, and a ref reaches the component itself once its code is in (null until then).

const S = REPORTS_STRINGS

let code = null
let loading = null

// Fetches the code once; a failed fetch is tried again by the next one to ask.
export const loadReportsCode = () => {
  if (!loading) {
    loading = import('./onDemandCode').then(
      (module) => {
        code = module
        return module
      },
      (error) => {
        loading = null
        throw error
      },
    )
  }
  return loading
}

class Loader extends React.Component {
  static propTypes = {
    // Which of the code's components to draw, and the props and ref it was given.
    name: PropTypes.oneOf(['ReportBuilder', 'Reports']).isRequired,
    componentProps: PropTypes.object.isRequired,
    forwardedRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
    loadingText: PropTypes.string.isRequired,
    failedText: PropTypes.string.isRequired,
  }

  static defaultProps = {
    forwardedRef: undefined,
  }

  state = { ready: !!code, failed: false }

  componentDidMount() {
    this.mounted = true
    if (!this.state.ready) {
      this.load()
    }
  }

  componentWillUnmount() {
    this.mounted = false
  }

  load = () => {
    this.setState({ failed: false })
    loadReportsCode().then(
      () => {
        if (this.mounted) {
          this.setState({ ready: true })
        }
      },
      (error) => {
        if (this.mounted) {
          this.setState({ failed: true })
          this.props.componentProps.onErrorCallback?.(error)
        }
      },
    )
  }

  render() {
    const { name, componentProps, forwardedRef, loadingText, failedText } = this.props
    if (this.state.ready) {
      const Component = code[name]
      return <Component {...componentProps} ref={forwardedRef} />
    }
    const { className } = componentProps
    return (
      <div className={`${RS}${className ? ` ${className}` : ''}`} data-test='reports-loading'>
        {this.state.failed ? (
          <div className={`${RS}-message`} data-tone='error'>
            <Icon name='alert' size={20} />
            <p role='alert'>{failedText}</p>
            <button type='button' className={`${RS}-button`} onClick={this.load}>
              {S.tryAgain}
            </button>
          </div>
        ) : (
          <div className={`${RS}-message`}>
            <span className={`${RS}-spin`}>
              <Icon name='spinner' size={20} />
            </span>
            <p>{loadingText}</p>
          </div>
        )}
      </div>
    )
  }
}

const onDemand = (name, loadingText, failedText) => {
  const OnDemand = React.forwardRef((props, ref) => (
    <Loader name={name} componentProps={props} forwardedRef={ref} loadingText={loadingText} failedText={failedText} />
  ))
  OnDemand.displayName = name
  return OnDemand
}

export const ReportBuilder = onDemand('ReportBuilder', S.workspace.opening, `${S.errors.lead.open}.`)
export const Reports = onDemand('Reports', S.loadingReports, `${S.errors.lead.load}.`)
