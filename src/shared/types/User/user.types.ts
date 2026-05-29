import {USER_ROLES} from '@/shared/constants'

export type TUserRole = (typeof USER_ROLES)[number]

export type TServerRole = 'STUDENT' | 'TEACHER' | 'ADMIN'

interface IBaseProfile {
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
// ── /me ответы с бэка
export interface IStudentProfile extends IBaseProfile {
  role: 'STUDENT'
}

export interface ITeacherProfile extends IBaseProfile {
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

export interface IUserDefault {
  id: number | string
  name?: string
  role?: string
  image?: string
  dateActivity?: string
}

export interface IUser extends IUserDefault {
  email?: string
  bio?: string
}

export interface IUserBase {
  name?: string
  role?: string
  image?: string
  dateActivity?: string
}

export interface UserHeaderCardProps extends IUserBase {
  userID?: string
  cardID: string
  complaintPostId?: string
  blurBg?: boolean
  BlurDots?: boolean
  accentColor?: string
  colorTitle?: string
  useLink?: boolean
  size?: 'sm' | 'lg'
}

export interface DotsMenuProps {
  activeMenu: boolean
  toggleMenu: (e: React.MouseEvent) => void
  handleShareClick?: (e: React.MouseEvent<HTMLLIElement>) => void
  cardId?: string
  cardTitle?: string
  complaintPostId?: string
  maxWidth?: string
}

export interface IUserRole {
  userRole?: TUserRole | string
  isVip?: boolean
  blurBg?: boolean
  accentColor?: string
  fontSize?: string
}

// ── Хелпер: маппинг ICurrentUser → IUser (для UI-компонентов) ─

export function mapProfileToUser(profile: ICurrentUser): IUser {
  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    image: profile.avatarUrl ?? undefined,
    email: profile.email
  }
}
