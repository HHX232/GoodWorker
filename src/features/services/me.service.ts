import instance from '@/shared/api'

interface BaseProfile {
  id: string
  name: string
  nameTransliterated: string | null
  email: string
  avatarUrl: string | null
  langCode: string
  phone: string | null
  createdAt: string
  updatedAt: string
}

export interface IStudentProfile extends BaseProfile {
  role: 'STUDENT'
}

export interface ITeacherProfile extends BaseProfile {
  role: 'TEACHER'
  pasportConfirmed: boolean | null
  categories: {
    category: {
      id: string
      slug: string
      translations: {langCode: string; name: string}[]
    }
  }[]
}

export type ICurrentUser = IStudentProfile | ITeacherProfile

const MeService = {
  async getMe(): Promise<ICurrentUser> {
    const response = await instance.get<ICurrentUser>('/me')
    return response.data
  }
}

export default MeService
