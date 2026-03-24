import { USER_ROLES } from "@/shared/constants";

export interface IUserDefault {
  id: number | string;
  name?: string;
  role?: string;
  image?: string;
  dateActivity?: string;
}

export interface IUser extends IUserDefault {
  email?: string;
  bio?: string;
}

export interface IUserBase {
  name?: string;
  role?: string;
  image?: string;
  dateActivity?: string;
}

export interface UserHeaderCardProps extends IUserBase {
  userID?: string;
  cardID: string;
  blurBg?: boolean;
  BlurDots?: boolean;
  accentColor?: string;
  colorTitle?: string;
  useLink?:boolean
  size?: 'sm' | 'lg'
}

export interface DotsMenuProps {
  activeMenu: boolean;
  toggleMenu: (e: React.MouseEvent) => void;
  handleShareClick?: (e: React.MouseEvent<HTMLLIElement>) => void;
  maxWidth?: string;
}

export type TUserRole = (typeof USER_ROLES)[number];

export interface IUserRole {
  userRole?: TUserRole | string;
  isVip?: boolean;
  blurBg?: boolean;
  accentColor?: string;
  fontSize?: string;
}
