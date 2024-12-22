type TUserRole = "Vip" | "Admin" | "User" | undefined;
export interface IUser{
image: string | null;
name: string;
dateActivity: string;
role: TUserRole | string;
blurBg?:boolean;
}

export interface IUserDefault {
   avatar: string;
   id: string;
   registrationDate?: string; 
   role?: string;
   username?: string;
   name?: string;
   dateActivity?:string;
   image: string;
   email?: string;
}
export interface IDefaultPost {
   body: string; // Текст документа
   commentsCount: string; // Количество комментариев
   id: string; // Уникальный идентификатор документа
   images: string[]; // Массив ссылок на изображения
   publicationDate: string; // Дата публикации в формате ISO
   starsCount: string; // Количество звезд (оценок)
   subtitle: string; // Подзаголовок документа
   title: string; 
   tags?: string[]; 
   user: IUserDefault;
   video: string | null; 
   videoPreview: string | null; 
   viewsCount: string; 
   views?:string;
   date?:string; 

}