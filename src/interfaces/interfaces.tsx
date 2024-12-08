type TUserRole = "Vip" | "Admin" | "User" | undefined;
export interface IUser{
image: string | null;
name: string;
dateActivity: string;
role: TUserRole;
blurBg?:boolean;
}
