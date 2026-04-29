import axios from 'axios'
import {getContentType} from './api.helper'
import {getAccessToken} from './auth.helper'

const getBaseURL = () => {
  const explicit = process.env.NEXT_PUBLIC_API_URL_SECOND
  if (explicit) return explicit + '/api'
  if (typeof window === 'undefined') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
    return appUrl + '/api'
  }
  return '/api'
}

export const instance = axios.create({
  baseURL: getBaseURL(),
  headers: getContentType()
})

export const axiosClassic = axios.create({
  baseURL: getBaseURL(),
  headers: getContentType()
})

instance.interceptors.request.use((config) => {
  const accessToken = getAccessToken()
  if (config.headers && accessToken !== null) {
    config.headers.Authorization = `Bearer ${accessToken || 'stasic smotri'}`
  }

  const currentHeaders = getContentType()

  if (!config.headers['Accept-Language'] && currentHeaders['Accept-Language']) {
    config.headers['Accept-Language'] = currentHeaders['Accept-Language']
  }

  if (!config.headers['x-language'] && currentHeaders['Accept-Language']) {
    config.headers['x-language'] = currentHeaders['Accept-Language']
  }

  return config
})

axiosClassic.interceptors.request.use((config) => {
  const currentHeaders = getContentType()

  config.headers['Content-Type'] = currentHeaders['Content-Type']
  config.headers['X-Requested-With'] = currentHeaders['X-Requested-With']
  config.headers['Accept'] = currentHeaders['Accept']

  if (!config.headers['Accept-Language'] && currentHeaders['Accept-Language']) {
    config.headers['Accept-Language'] = currentHeaders['Accept-Language']
  }

  if (!config.headers['x-language'] && currentHeaders['Accept-Language']) {
    config.headers['x-language'] = currentHeaders['Accept-Language']
  }

  return config
})

export default instance
