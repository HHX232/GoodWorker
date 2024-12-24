import { FC, useEffect, useRef, useState } from 'react'
import style from './CommentsBoxLittle.module.scss'
import randAvatar from '../../images/stubs/stub-3.jpg'
import {v4 as uuid} from 'uuid'
import { DotsMenu } from '../UserHeaderCard/UserHeaderCard';
import UserRole from '../UserRole/UserRole';
import CommentsCreate from '../CommentsCreate/CommentsCreate';
interface User {
   avatar: string;
   email: string;
   id: number;
   registrationDate: string;
   role: string;
   username: string;
}

interface Comment {
   id: number;
   message: string;
   publicationDate: string; 
   user: User;
   commentsImages?:string[]
}

interface ICommentsProps {
   commentsCount: number | string;
   comments: Comment[]
}

interface CommentsResponse {
   comments: Comment[];
}

const response: CommentsResponse = {
   comments: [
       {
           id: 3,
           message: "Отличная работа!",
           publicationDate: "2024-12-24T06:23:23Z",
           commentsImages:[randAvatar,randAvatar,randAvatar],
           user: {
               avatar: "https://goodworker.onrender.com/images/avatars/avatar_2.webp",
               email: "stanislav@gmail.com",
               id: 1,
               registrationDate: "2006-06-09T11:11:11Z",
               role: "User ",
               username: "Станислав"
           }
       },
       {
           id: 4,
           message: "Мне очень понравилось!",
           publicationDate: "2024-12-21T08:15:30Z",
           commentsImages:[randAvatar,randAvatar],
         
           user: {
               avatar: "https://goodworker.onrender.com/images/avatars/avatar_3.webp",
               email: "anna@example.com",
               id: 2,
               registrationDate: "2010-03-15T09:45:00Z",
               role: "User ",
               username: "Анна"
           }
       },
       {
           id: 5,
           message: "Отличный сервис, буду рекомендовать!",
           publicationDate: "2024-12-22T10:30:00Z",
           user: {
               avatar: "https://goodworker.onrender.com/images/avatars/avatar_4.webp",
               email: "ivan@example.com",
               id: 3,
               registrationDate: "2015-07-20T14:20:00Z",
               role: "User ",
               username: "Иван"
           }
       },
       {
           id: 6,
           message: "Не хватает некоторых функций, но в целом неплохо.",
           publicationDate: "2024-12-23T12:00:00Z",
           user: {
               avatar: "https://goodworker.onrender.com/images/avatars/avatar_5.webp",
               email: "maria@example.com",
               id: 4,
               registrationDate: "2018-11-11T16:30:00Z",
               role: "User ",
               username: "Мария"
           }
       },
       {
         id: 6,
         message: "Не хватает некоторых функций, но в целом неплохо.",
         publicationDate: "2024-12-23T12:00:00Z",
         user: {
             avatar: "https://goodworker.onrender.com/images/avatars/avatar_5.webp",
             email: "maria@example.com",
             id: 4,
             registrationDate: "2018-11-11T16:30:00Z",
             role: "User ",
             username: "Мария"
         }
     },
     {
      id: 6,
      message: "Не хватает некоторых функций, но в целом неплохо Не хватает некоторых функций, но в целом неплохо Не хватает некоторых функций, но в целом неплохо.",
      publicationDate: "2024-12-23T12:00:00Z",
      user: {
          avatar: "https://goodworker.onrender.com/images/avatars/avatar_5.webp",
          email: "maria@example.com",
          id: 4,
          registrationDate: "2018-11-11T16:30:00Z",
          role: "User ",
          username: "Мария"
      }
  },
  {
   id: 6,
   message: "Не хватает некоторых функций, но в целом неплохо.",
   publicationDate: "2024-12-23T12:00:00Z",
   user: {
       avatar: "https://goodworker.onrender.com/images/avatars/avatar_5.webp",
       email: "maria@example.com",
       id: 4,
       registrationDate: "2018-11-11T16:30:00Z",
       role: "User ",
       username: "Мария"
   }
},
{
   id: 6,
   message: "Не хватает некоторых функций, но в целом неплохо.",
   publicationDate: "2024-12-23T12:00:00Z",
   user: {
       avatar: "https://goodworker.onrender.com/images/avatars/avatar_5.webp",
       email: "maria@example.com",
       id: 4,
       registrationDate: "2018-11-11T16:30:00Z",
       role: "User ",
       username: "Мария"
   }
},
{
   id: 6,
   message: "Не хватает некоторых функций, но в целом неплохо.",
   publicationDate: "2024-12-23T12:00:00Z",
   user: {
       avatar: "https://goodworker.onrender.com/images/avatars/avatar_5.webp",
       email: "maria@example.com",
       id: 4,
       registrationDate: "2018-11-11T16:30:00Z",
       role: "User ",
       username: "Мария"
   }
},
   ]
};
const getHowDate = (publicationDate:any) => {
   const today:any = new Date();
   const pubDate:any = new Date(publicationDate);
   
   // Разница в миллисекундах
   const diffTime = today - pubDate;
   
   // Конвертируем разницу в дни
   const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
   
   if (diffDays === 0){
      return `Today`
   }else if (diffDays < 32) {
       return `${diffDays}d`; // Возвращаем дни
   } else if (diffDays < 365) {
       const diffMonths = Math.floor(diffDays / 30);
       return `${diffMonths}m`; // Возвращаем месяцы
   } else {
       const diffYears = Math.floor(diffDays / 365);
       return `${diffYears}y`; // Возвращаем годы
   }
};
const CommentItem: FC<Comment> = ({ id, message, publicationDate, user }) => {
   const FinishDate = getHowDate(publicationDate);
   const [activeMenu, setActiveMenu] = useState(false);
   const [isTruncated, setIsTruncated] = useState(false);
   const textRef = useRef<HTMLDivElement | null>(null);

   const togglemenu = (e: React.MouseEvent) => {
       e.stopPropagation();
       e.preventDefault();
       setActiveMenu(!activeMenu);
   };

   useEffect(() => {
       if (textRef.current) {
           const lineHeight = parseFloat(getComputedStyle(textRef.current).lineHeight);
           const maxHeight = lineHeight * 2; // Высота для двух строк

           if (textRef.current.scrollHeight > maxHeight) {
               setIsTruncated(true);
           }
       }
   }, [message]); 

   return (
       <li key={uuid()} className={`${style.some_com_box}`}>
           <div style={{ backgroundImage: `url(${randAvatar})` }} className={`${style.comm_avatar}`}></div>
           <div className={`${style.comm_content}`}>
               <div className={`${style.unic_comm_header}`}>
                   <div className={`${style.comm_name}`}>{user?.username}</div>
                   <DotsMenu maxWidth={"26"} activeMenu={activeMenu} togglemenu={togglemenu} hiddenShare={true} />
               </div>
               <div className={`${style.user_subdata_box}`}>
                   <p className={`${style.user_activity}`}>{FinishDate}</p>
                   <div style={{ backgroundColor: `${FinishDate === "Today" ? "#29D32F" : "#868897"}` }} className={`${style.dot_activity}`}></div>
                   <UserRole accentColor='868897' userRole={user.role} />
               </div>
               <div className={`${style.comments_text}`} ref={textRef}>
                   {isTruncated ? `${message.substring(0, 100)}... See more` : message}
               </div>
           </div>
       </li>
   );
};

const CommentsBoxLittle:FC<ICommentsProps> = ({commentsCount = "0", comments}) =>{

  
  
   

   return <div className={`${style.comments_box}`}>
      <div className={`${style.comments_header}`}>
         <h4 className={`${style.comments_count}`}>{`Comments (${commentsCount})`}</h4>
         <button className={`${style.all_comments_btn}`}>view all</button>
      </div>
      <ul className={`${style.comments_all_box}`}>
      {response.comments.map((el)=>{
         return <CommentItem id={el.id} message={el.message} publicationDate={el.publicationDate} user={el.user}/>
      })}
      </ul>
      <CommentsCreate/>
   </div>
}
export default CommentsBoxLittle