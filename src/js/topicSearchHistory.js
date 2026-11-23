import { parseJwt } from 'autoql-fe-utils'

// Recent Quick Topics searches (topics, values and text), most recent first. Kept
// under the key the Data Explorer used, so history carries over from it.
export const MAX_RECENT_TOPIC_SEARCHES = 3

const getStorageKey = (authentication) => {
  if (!authentication?.token) {
    return
  }

  try {
    const { user_id, project_id } = parseJwt(authentication.token)
    return `data-explorer-recent-${user_id}-${project_id}`
  } catch {
    return
  }
}

// What makes two searches the same: a topic and a value can share a name, so the
// type and the topic's context (or the value's canonical form) are part of it.
const getSearchKey = (search) =>
  [search?.type, search?.context ?? search?.valueLabel?.canonical ?? search?.displayName].join('|')

export const getRecentTopicSearches = (authentication) => {
  try {
    const key = getStorageKey(authentication)
    const searches = key ? JSON.parse(localStorage.getItem(key)) : undefined
    if (!Array.isArray(searches)) {
      return []
    }

    return searches
      .filter((search, i) => searches.findIndex((other) => getSearchKey(other) === getSearchKey(search)) === i)
      .slice(0, MAX_RECENT_TOPIC_SEARCHES)
  } catch {
    return []
  }
}

const saveRecentTopicSearches = (authentication, searches) => {
  try {
    const key = getStorageKey(authentication)
    if (key) {
      localStorage.setItem(key, JSON.stringify(searches))
    }
  } catch {
    // Storage can be unavailable in privacy modes and non-browser environments.
  }
}

/** Moves (or adds) a search to the top of the history, and returns the new list. */
export const addRecentTopicSearch = (authentication, search) => {
  const searches = [
    search,
    ...getRecentTopicSearches(authentication).filter((other) => getSearchKey(other) !== getSearchKey(search)),
  ].slice(0, MAX_RECENT_TOPIC_SEARCHES)

  saveRecentTopicSearches(authentication, searches)
  return searches
}

export const clearRecentTopicSearches = (authentication) => {
  saveRecentTopicSearches(authentication, [])
  return []
}
