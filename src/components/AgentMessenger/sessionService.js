import axios from 'axios'
import { getAuthentication, GENERAL_QUERY_ERROR, UNAUTHENTICATED_ERROR, REQUEST_CANCELLED_ERROR } from 'autoql-fe-utils'

export const SESSIONS_ENDPOINT = '/autoql/api/v1/sessions'
export const MODELS_ENDPOINT = '/autoql/api/v1/models'

// Used when the models endpoint isn't available yet. The selector still renders from
// this list, so the control never silently disappears; the first entry is the default
// a new thread starts on, and is the model name the API is known to accept.
export const FALLBACK_MODELS = [
  { id: 'gpt-4.1', label: 'GPT-4.1', description: 'Faster, good for direct lookups' },
  { id: 'gpt-5', label: 'GPT-5', description: 'Best for multi-step analysis' },
]

export const isCancelError = (error) => {
  return axios.isCancel?.(error) || error?.message === REQUEST_CANCELLED_ERROR
}

const getRequestConfig = ({ authentication, cancelToken }) => {
  const { token } = getAuthentication(authentication)

  const config = { headers: {} }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (cancelToken) {
    config.cancelToken = cancelToken
  }

  return config
}

const getUrl = ({ authentication, path }) => {
  const { domain, apiKey } = getAuthentication(authentication)
  const url = `${domain}${path}`
  return apiKey ? `${url}?key=${apiKey}` : url
}

// Every error the UI sees goes through here, so a failure always has a message we
// can put in an error item rather than an empty bubble. The status and the request
// that caused it are logged and carried on the rejection, because the server's own
// text ("Internal Service Error…") says nothing about which call failed or why.
const normalizeError = (error, context = {}) => {
  if (isCancelError(error)) {
    return { message: REQUEST_CANCELLED_ERROR, isCancelled: true }
  }

  const status = error?.response?.status
  const responseData = error?.response?.data

  console.error(
    `[AgentMessenger] ${context.method ?? 'request'} failed` +
      `${status ? ` with HTTP ${status}` : ''} — ${context.path ?? ''}`,
    { requestBody: context.body, responseData, error },
  )

  if (status === 401 || status === 403) {
    return { message: UNAUTHENTICATED_ERROR, status }
  }

  // The API puts a sentence written for the person reading it on `detail` ("Session
  // has already completed…"). That reads as the agent talking, so it's flagged to be
  // spoken as an agent message rather than boxed up as a failure. Other error shapes
  // are internal text, and keep the error item. `detail` can also be a validation
  // array, which is not something to say out loud - hence the string check.
  const detail = typeof responseData?.detail === 'string' ? responseData.detail.trim() : ''

  // 409 means the session the thread was resuming has closed. The caller recovers by
  // starting a new one, so this is flagged separately from the message itself.
  const isSessionExpired = status === 409

  if (detail) {
    return { message: detail, status, responseData, isConversational: true, isSessionExpired }
  }

  const responseMessage = responseData?.message ?? responseData?.error

  return { message: responseMessage || GENERAL_QUERY_ERROR, status, responseData, isSessionExpired }
}

/**
 * The create response carries a top level session_id; the resume response carries
 * response_items only. Returning null (not undefined) for a missing session_id lets
 * the reducer tell "no id in this response" apart from "the id is gone", so a resume
 * never clears the session the thread already established.
 */
const normalizeSessionResponse = (response) => {
  const data = response?.data ?? {}

  return {
    sessionId: data.session_id ?? null,
    responseItems: Array.isArray(data.response_items) ? data.response_items : [],
  }
}

// llm_model is left out for now - the backend picks the model.
export const createSession = ({ userInquiry, authentication, cancelToken }) => {
  const path = SESSIONS_ENDPOINT
  const url = getUrl({ authentication, path })
  const body = { user_inquiry: userInquiry }

  return axios
    .post(url, body, getRequestConfig({ authentication, cancelToken }))
    .then(normalizeSessionResponse)
    .catch((error) => Promise.reject(normalizeError(error, { method: 'createSession', path, body })))
}

export const resumeSession = ({ sessionId, userInquiry, authentication, cancelToken }) => {
  const path = `${SESSIONS_ENDPOINT}/${sessionId}/resume`
  const url = getUrl({ authentication, path })
  const body = { user_inquiry: userInquiry }

  return axios
    .post(url, body, getRequestConfig({ authentication, cancelToken }))
    .then(normalizeSessionResponse)
    .catch((error) => Promise.reject(normalizeError(error, { method: 'resumeSession', path, body })))
}

/**
 * The models endpoint isn't finalized yet, so accept either a list of plain strings
 * or a list of objects, and read the id from whichever key it turns up under.
 */
export const normalizeModels = (data) => {
  const list = Array.isArray(data) ? data : data?.models ?? data?.data?.models ?? []

  if (!Array.isArray(list)) {
    return []
  }

  return list
    .map((model) => {
      if (typeof model === 'string') {
        return { id: model, label: model }
      }

      const id = model?.id ?? model?.llm_model ?? model?.name
      if (!id) {
        return null
      }

      return {
        id,
        label: model.display_name ?? model.label ?? id,
        description: model.description,
      }
    })
    .filter(Boolean)
}

export const fetchModels = ({ authentication, endpoint, cancelToken }) => {
  const url = getUrl({ authentication, path: endpoint || MODELS_ENDPOINT })

  return axios
    .get(url, getRequestConfig({ authentication, cancelToken }))
    .then((response) => normalizeModels(response?.data))
    .catch((error) =>
      Promise.reject(normalizeError(error, { method: 'fetchModels', path: endpoint || MODELS_ENDPOINT })),
    )
}
