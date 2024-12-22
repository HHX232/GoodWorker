import { FC, useEffect } from 'react';
import style from './UserDataBox.module.scss';
import { TUserRole } from '../UserRole/UserRole';
import {v4 as uuid} from 'uuid'
import postAPI from '../../services/PostService';
import { useParams } from 'react-router-dom';
interface IUser{
   user:{
      avatar: string;
   name:string;
   email:string;
   role:TUserRole;
   }
   views:string;
   date:string;
   categories:string[];
}
function formatDate(isoDate:string ) {
   // Создаем объект даты из строки ISO
   const date = new Date(isoDate);

   // Определяем опции для форматирования
   const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'GMT' };
   
   // Форматируем дату
   const formattedDate = date.toLocaleString('en-GB', options as any).replace(',', '');

   // Заменяем пробел перед временем на ' - ' и добавляем 'GMT' в конце
   return formattedDate.replace(' ', ' - ') + 'GMT';
}
const UserDataBox:FC<IUser> = ({}) => {

     const paramsUrl = useParams().id;
    const stringPostId: any = (paramsUrl && paramsUrl.toString())
    const { data: post, error, isLoading } = postAPI.useFetchPostByIdQuery(stringPostId);

    useEffect(()=>{
      console.log("post?.user", post)
    },[])
   const formatNewDate = formatDate(post?.publicationDate ? post.publicationDate : "")

   return <div className={`${style.user_box}`}>
      <div className={`${style.user_data_box}`}>
         <div style={{backgroundImage: `url(${post?.user?.avatar})`}} className={`${style.user_image}`} />
         <div className={`${style.user_text_box}`}>
            <h2 className={`${style.user_name}`}>{post?.user?.name}</h2>
            <p className={`${style.user_mail}`}>{post?.user.email}</p>
         </div>
      </div>
      <ul className={`${style.user_list}`}>
         <li key={uuid() + "a"} className={`${style.user_list_item}`}>
            <h6 className={`${style.user_list_item_title}`}>User type:</h6>
            <p className={`${style.user_list_item_text}`}>{post?.user.role}</p>
         </li>
         <li key={uuid() + "b"} className={`${style.user_list_item}`}>
            <h6 className={`${style.user_list_item_title}`}>Total post view:</h6>
            <p className={`${style.user_list_item_text}`}>{post?.viewsCount}</p>
         </li>
         <li key={uuid() + "c"} className={`${style.user_list_item}`}>
            <h6 className={`${style.user_list_item_title}`}>Publication date:</h6>
            <p className={`${style.user_list_item_text}`}>{formatNewDate}</p>
         </li>
         <li key={uuid() + "d"} className={`${style.user_list_item}`}>
            <h6 className={`${style.user_list_item_title}`}>Post category:</h6>
            <div className={`${style.post_category_box}`}>
            {post?.tags?.map((el, index)=>{
               if(index > 1) {
                  return null
               }
               return <p key={uuid()} className={`${style.category}`}>{el + (index === 0 ? "," : "") }</p>
            })}
             { post?.tags && post?.tags.length > 2 ? <p key={uuid()} className={`${style.category}`}>{"+ "  + `${post?.tags.length - 2}`}</p> : null}
             {post?.tags && post?.tags.length === 0 ? <p key={uuid()} className={`${style.category}`}>{"All"}</p> : ""}
            </div>
         </li>
      </ul>
   </div>
}
export default UserDataBox