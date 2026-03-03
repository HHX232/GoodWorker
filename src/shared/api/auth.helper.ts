/* eslint-disable @typescript-eslint/no-explicit-any */

import Cookies from 'js-cookie'

const isClient = typeof window !== 'undefined'

export const saveTokenStorage = (data: {accessToken: string; refreshToken: string}) => {
  if (!isClient) return

  Cookies.set('accessToken', data.accessToken, {
    expires: 7,
    secure: process.env.NODE_ENV === 'production'
  })
  Cookies.set('refreshToken', data.refreshToken, {
    expires: 30,
    secure: process.env.NODE_ENV === 'production'
  })
}

export const removeFromStorage = (): void => {
  if (!(typeof window !== 'undefined')) return

  console.log('удаляем в removeFromStorage')
  Cookies.remove('accessToken')
  Cookies.remove('refreshToken')
  localStorage.removeItem('user')
}

export const saveToStorage = (data: any): void => {
  if (!isClient) return

  saveTokenStorage(data)
  localStorage.setItem('user', JSON.stringify(data.user))
}

export const getAccessToken = () => {
  if (!isClient) return null

  const accessToken = Cookies.get('accessToken')
  return accessToken || null
}

export const getAccessTokenServer = async () => {
  if (isClient) {
    // Если код выполняется на клиенте, используем обычную функцию
    return getAccessToken()
  }

  try {
    const {cookies} = await import('next/headers')
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('accessToken')
    return accessToken?.value || null
  } catch (error) {
    console.error('Error getting access token on server:', error)
    return null
  }
}

export const getRefreshToken = () => {
  if (!isClient) return null

  const refreshToken = Cookies.get('refreshToken')
  return refreshToken || null
}
