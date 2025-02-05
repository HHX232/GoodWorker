import { IUser } from '../../interfaces/interfaces';

export interface ICard {
   title: string;
   subTitle: string;
   highlightText?: string;
   user: IUser;
   imagesArray: Array<string> | undefined;
   comments: string;
   vues: string;
   stars: string;
   commentsCount?: string;
   cardId: string;
   userId?: string;
}
