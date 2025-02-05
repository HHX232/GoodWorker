import { FC, useEffect, useRef, useState } from 'react'
import style from './CommentsBoxLittle.module.scss'
import randAvatar from '../../images/stubs/stub-3.jpg'
import {v4 as uuid} from 'uuid'
import { DotsMenu } from '../UserHeaderCard/UserHeaderCard';
import UserRole from '../UserRole/UserRole';
import CommentsCreate from '../CommentsCreate/CommentsCreate';
import { Link, useLocation, useParams } from 'react-router-dom';
import request from '../../utils/request';
import ModalBox from '../ModalBox/ModalBox';
import { useAppSelector } from '../../hooks/redux';
import { CommentImage } from '../Pages/FullCommentsPage/FullCommentsPage';

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
   fontText?:string;
   avatarWidth?:string;
   miniSize?:boolean;
    dotsMenu?:string;
    images?:string[]
}

interface ICommentsProps {
   commentsCount: number | string;
   comments: Comment[]
}

interface CommentsResponse {
   comments: Comment[];
}

export const responseCommentsFake: CommentsResponse = {
   comments: [
       {
           id: 3,
           message: "Отличная работа!Не хватает некоторых функций, но в целом неплохо.Не хватает некоторых функций, но в целом неплохо.Не хватает некоторых функций, но в целом неплохо.Не хватает некоторых функций, но в целом неплохо.Не хватает некоторых функций, но в целом неплохо.",
           publicationDate: "2024-12-24T06:23:23Z",
           commentsImages:[randAvatar,randAvatar,randAvatar],
           user: {
               avatar: "https://goodworker.onrender.com/images/avatars/avatar_2.webp",
               email: "stanislav@gmail.com",
               id: 1,
               registrationDate: "2006-06-09T11:11:11Z",
               role: "User ",
               username: "Станислав"
           },
        
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
export const CommentItem: FC<Comment> = ({ id, message, publicationDate, user, fontText="12", avatarWidth="24", miniSize=true, dotsMenu="26" }) => {
    const titleSize = Number(fontText ) + 4;
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
           <div style={{ backgroundImage: `url(${randAvatar})`, width: `${avatarWidth}px`, height: `${avatarWidth}px` }} className={`${style.comm_avatar}`}></div>
           <div className={`${style.comm_content}`}>
               <div className={`${style.unic_comm_header}`}>
                <div className={`${style.display_box}`}>
                <div style={{ fontSize: `${fontText === "12" ? "14" : titleSize}px` }} className={`${style.comm_name}`}>{user?.username}</div>
                <div className={`${style.user_subdata_box}` } style={{marginTop:`${fontText === "12" ? "0px" : "5px"}`}}>
                   <p style={{ fontSize: `${fontText}px` }} className={`${style.user_activity}`}>{FinishDate}</p>
                   <div style={{ backgroundColor: `${FinishDate === "Today" ? "#29D32F" : "#868897"}` }} className={`${style.dot_activity}`}></div>
                   <UserRole fontSize={fontText} accentColor='868897' userRole={user.role} />
               </div>
                </div>

                   <DotsMenu  activeMenu={activeMenu} togglemenu={togglemenu} hiddenShare={true} maxWidth={dotsMenu} />
               </div>
               <div style={{ fontSize: `${fontText === "12" ? "14" : (Number(fontText) + 2)}px`, WebkitLineClamp: miniSize ? 2 : 120 }} className={`${style.comments_text}`} ref={textRef}>
                   {(isTruncated && miniSize) ? `${message.substring(0, 80)}... See more` : message}
               </div>
           </div>
       </li>
   );
};

const CommentsBoxLittle:FC<ICommentsProps> = ({commentsCount = "0", comments}) =>{

   const location = useLocation();
   const id = useParams().id;
   const [Realcomments, setRealComments] = useState<Comment[]>([]);

   const images = useAppSelector((state)=>state.comImages.images);
    // console.log(Realcomments )
   useEffect(() => {
       const fetchComments = async () => {
           const response:any = await request(`posts/${id}`).then((res) => res);
        //    console.log("response", response)
           setRealComments(response.comments);
       };
       try{
        fetchComments();
       }catch(e){
        console.log('e')
       }
      
   }, []);
  
  
   

   return <div className={`${style.comments_box}`}>
      <div className={`${style.comments_header}`}>
         <h4 className={`${style.comments_count}`}>{`Comments (${commentsCount})`}</h4>
         <Link 
            to={`${location.pathname}/comments`} 
            state={{ background: location }}
            className={`${style.all_comments_btn}`}
         >
            view all
         </Link>
      </div>
      <ul className={`${style.comments_all_box}`}>
      {responseCommentsFake.comments.length >= 1 && responseCommentsFake.comments?.map((el)=>{
         return <CommentItem id={el.id} message={el.message} publicationDate={el.publicationDate} user={el.user}/>
      })}
      {responseCommentsFake.comments.length === 0 && <p className={`${style.no_comments}`}>Write the first comment</p>}
      </ul>
    
      <div className={`${style.comment_little_box}`}>
        { images.length >0 &&   <div className={`${style.border_box_little}`}> <ul className={`${style.images_little_box}`}>
            {images.map((img, index)=>{
                return <CommentImage widthImage={images.length <= 5 ? "50" : "40"} imageUrl={img} indexUrl={index.toString()}/>
            })}
        </ul></div>}
      <CommentsCreate/>
      </div>


   </div>
}
export default CommentsBoxLittle