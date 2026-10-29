import React from 'react'
import { SelectBox } from '../components/controls'
import { TEMPLATE_DESCRIPTION_MAX, TEMPLATE_TAG_MAX, TEMPLATE_TAGS_MAX, TEMPLATE_TITLE_MAX } from '../run/templatesApi'
import { RS } from './reportsConstants'
import { REPORTS_STRINGS } from './reportsStrings'

// A template's details as its managers set them — title, description, category and tags — in Save as template and in
// Manage templates alike. While they're being edited they're { title, description, categoryId, tags }, `tags` the
// text typed (comma-separated); detailsToSend turns them into what the service takes.

const S = REPORTS_STRINGS.saveAsTemplate
const E = REPORTS_STRINGS.errors

let fieldIds = 0

// Tags as typed, "Quarterly, AUM": each once (whatever its case), without the spaces around it.
export const parseTags = (text) => {
  const seen = new Set()
  return String(text || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag && !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()))
}

// A template's details for editing.
export const detailsOf = (template) => ({
  title: template?.title || '',
  description: template?.description || '',
  categoryId: template?.categoryId || '',
  tags: (template?.tags || []).join(', '),
})

// What the service would turn down, said before asking it; null when it would take them.
export const detailsProblem = (details) => {
  const title = details.title.trim()
  const tags = parseTags(details.tags)
  if (
    !title ||
    Array.from(title).length > TEMPLATE_TITLE_MAX ||
    details.description.length > TEMPLATE_DESCRIPTION_MAX
  ) {
    return E.templateNameInvalid
  }
  if (tags.length > TEMPLATE_TAGS_MAX) {
    return E.tooManyTemplateTags
  }
  if (tags.some((tag) => Array.from(tag).length > TEMPLATE_TAG_MAX)) {
    return E.templateNameInvalid
  }
  return null
}

// The details as the service takes them. An empty description, category or set of tags is null, which takes one
// away (or leaves it out of a new template).
export const detailsToSend = (details) => {
  const tags = parseTags(details.tags)
  return {
    title: details.title.trim(),
    description: details.description.trim() || null,
    categoryId: details.categoryId || null,
    tags: tags.length ? tags : null,
  }
}

// The fields. `categories` are those a template can take: the organization's and the integrator's.
export class TemplateDetailsFields extends React.Component {
  constructor(props) {
    super(props)
    fieldIds += 1
    const id = `${RS}-template-details-${fieldIds}`
    this.ids = {
      title: `${id}-title`,
      description: `${id}-description`,
      category: `${id}-category`,
      tags: `${id}-tags`,
    }
  }

  change = (key, value) => this.props.onChange({ ...this.props.value, [key]: value })

  render() {
    const { value, categories, disabled, titleRef } = this.props
    return (
      <div className={`${RS}-template-details`}>
        <div className={`${RS}-template-field`}>
          <label className={`${RS}-label`} htmlFor={this.ids.title}>
            {S.templateTitle}
          </label>
          <input
            ref={titleRef}
            id={this.ids.title}
            type='text'
            className={`${RS}-input`}
            value={value.title}
            maxLength={TEMPLATE_TITLE_MAX}
            disabled={disabled}
            data-test='reports-template-title'
            onChange={(e) => this.change('title', e.target.value)}
          />
        </div>
        <div className={`${RS}-template-field`}>
          <label className={`${RS}-label`} htmlFor={this.ids.description}>
            {S.description}
          </label>
          <textarea
            id={this.ids.description}
            className={`${RS}-input`}
            rows={2}
            value={value.description}
            maxLength={TEMPLATE_DESCRIPTION_MAX}
            disabled={disabled}
            data-test='reports-template-description'
            onChange={(e) => this.change('description', e.target.value)}
          />
        </div>
        {categories?.length ? (
          <div className={`${RS}-template-field`}>
            <label className={`${RS}-label`} htmlFor={this.ids.category}>
              {S.category}
            </label>
            <SelectBox prefix={RS}>
              <select
                id={this.ids.category}
                className={`${RS}-select`}
                value={value.categoryId}
                disabled={disabled}
                data-test='reports-template-category'
                onChange={(e) => this.change('categoryId', e.target.value)}
              >
                <option value=''>{S.noCategory}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </SelectBox>
          </div>
        ) : null}
        <div className={`${RS}-template-field`}>
          <label className={`${RS}-label`} htmlFor={this.ids.tags}>
            {S.tags}
          </label>
          <input
            id={this.ids.tags}
            type='text'
            className={`${RS}-input`}
            value={value.tags}
            placeholder={S.tagsPlaceholder}
            disabled={disabled}
            data-test='reports-template-tags'
            onChange={(e) => this.change('tags', e.target.value)}
          />
          <p className={`${RS}-note`}>{S.tagsNote}</p>
        </div>
      </div>
    )
  }
}
