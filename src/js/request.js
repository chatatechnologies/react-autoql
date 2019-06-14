import axios from 'axios'

const client = axios.create({
  // baseURL: 'https://backend-staging.chata.ai/api/v1'
})

const request = options => {
  const newOptions = {
    // ...options,
    project: options.project,
    url: options.url,
    // data: options.data,
    headers: {
      // options.headers,
      Authorization: `Bearer ${options.token}`
    }
  }

  const onSuccess = response => {
    return response.data
  }

  const onError = error => {
    if (error.config) {
      // console.error('Request Failed:', error.config);
    }

    if (error.response) {
      // Request was made but server responded with something
      // other than 2xx
      if (error.response) {
        // console.error('Status:',  error.response.status);
        // console.error('Headers:', error.response.headers);
        // console.error('Data:',    error.response.data);
      }
    } else {
      // Something else happened while setting up the request
      // triggered the error
      if (error.message) {
        // console.error('Error Message:', error.message);
      } else {
        // console.error('Error:', error)
      }
    }

    return Promise.reject(error.response || error.message || error)
  }

  return client(newOptions)
    .then(onSuccess)
    .catch(onError)
}

export default request
