import React from 'react'
import PropTypes from 'prop-types'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'

import { Icon } from '../Icon'

import './SummaryContent.scss'

export default class SummaryContent extends React.Component {
  static propTypes = {
    content: PropTypes.string.isRequired,
    focusPromptUsed: PropTypes.string,
    className: PropTypes.string,
    titleClassName: PropTypes.string,
    focusPromptClassName: PropTypes.string,
    markdownClassName: PropTypes.string,
    showTitle: PropTypes.bool,
  }

  static defaultProps = {
    focusPromptUsed: undefined,
    className: '',
    titleClassName: '',
    focusPromptClassName: '',
    markdownClassName: '',
    showTitle: true,
  }

  renderMarkdown = (content) => {
    if (!content) return null

    // Convert content to string if it's not already
    let contentStr = typeof content === 'string' ? content : String(content)

    // Replace literal "\n" strings with actual newlines if they exist
    // (in case the API returns escaped newlines)
    contentStr = contentStr.replace(/\\n/g, '\n')

    // Pass content directly to react-markdown without any manipulation
    return (
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          // Handle lists
          ul: ({ children }) => <ul>{children}</ul>,
          li: ({ children }) => <li>{children}</li>,
          // Handle formatting
          strong: ({ children }) => <strong>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          // Handle line breaks (remark-breaks will create these automatically)
          br: () => <br />,
        }}
      >
        {contentStr}
      </ReactMarkdown>
    )
  }

  render = () => {
    const {
      content,
      focusPromptUsed,
      className,
      titleClassName,
      focusPromptClassName,
      markdownClassName,
      showTitle,
    } = this.props

    return (
      <div className={`summary-content ${className}`}>
        {showTitle && (
          <div className={`summary-content-title ${titleClassName}`}>
            <Icon type='magic-wand' />
            <strong>Summary:</strong>
          </div>
        )}
        {focusPromptUsed && (
          <div className={`summary-content-focus-prompt ${focusPromptClassName}`}>
            Focused on: {focusPromptUsed}
          </div>
        )}
        <div className={`summary-content-markdown ${markdownClassName}`}>
          {this.renderMarkdown(content)}
        </div>
      </div>
    )
  }
}
