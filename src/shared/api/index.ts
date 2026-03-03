import { getContentType } from "./api.helper"
import instance, { axiosClassic } from "./api.interceptor"
import { getAccessTokenServer, removeFromStorage, saveTokenStorage, saveToStorage } from "./auth.helper"

export default instance
export { axiosClassic, getAccessTokenServer, getContentType, removeFromStorage, saveTokenStorage, saveToStorage }

