import axios from 'axios'
import { getContentType } from './api.helper'
import { getAccessToken } from './auth.helper'

export const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL_SECOND + '/api/v1',
  headers: getContentType()
})

export const axiosClassic = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL_SECOND + '/api/v1',
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
