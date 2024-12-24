import { FC, useState } from "react"
import { IUser } from "../../interfaces/interfaces"
import style from './UserHeaderCard.module.scss'
import UserRole from "../UserRole/UserRole"
import dotsImage from '../../images/svg/threeDats.svg'
import userImageProp from '../../images/stubs/stub-4.jpg'
import postAPI from "../../services/PostService"
import { Link } from "react-router-dom"

interface somesingBlur extends IUser{
   blurBg?:boolean;
   BlurDots?:boolean;
   accentColor?:string;
   colorTitle?:string;
   cardID:string;
   userID?:string;
}

interface DotsMenuProps {
   activeMenu: boolean;
   togglemenu: (e: React.MouseEvent) => void;
   handleShareClick?: (e: React.MouseEvent<HTMLLIElement>) => void;
   hiddenShare?:boolean;
   maxWidth?:string;
 }
 
 export const DotsMenu: React.FC<DotsMenuProps> = ({ activeMenu, maxWidth , togglemenu, handleShareClick }) => {
   return (
     <div className={`${style.dots_menu_box}`}>
       <img style={{maxWidth:`${maxWidth}px`}} onClick={togglemenu} className={`${style.dots_image}`} src={dotsImage} alt="" />
       {activeMenu ? (
         <ul style={{bottom:`-${Number(maxWidth) * 2.8}px`}} className={`${style.dots_menu}`}>
           <li className={`${style.dots_menu_item}`}>
             <p className={`${style.report}`}>Пожаловаться</p>
           </li>
           <li onClick={handleShareClick} className={`${style.dots_menu_item}`}>
             <p className={`${style.share_item}`}>Поделиться</p>
           </li>
         </ul>
       ) : null}
     </div>
   );
 };

const UserHeaderCard:FC<somesingBlur> = ({image,userID,cardID,colorTitle="141416", accentColor="868897", blurBg=false, BlurDots=false, role, dateActivity, name}) =>{
const [activeMenu,setActiveMenu] = useState(false);
const togglemenu = (e: React.MouseEvent)=>{
   e.stopPropagation();
   e.preventDefault();
   setActiveMenu(!activeMenu);
}


 
const handleShareClick = (e: React.MouseEvent<HTMLLIElement>) => {
   e.stopPropagation();
   //TODO добавить актуальную ссылку
   const urlToCopy = `https://goodworker.com/posts/${cardID}`;
   navigator.clipboard.writeText(urlToCopy)
     .then(() => {
       console.log('Ссылка скопирована в буфер обмена!'); 
     })
     .catch(err => {
       console.error('Ошибка при копировании: ', err);
     });
 };
   return <div className={`${style.user_box}`}>
      <Link to={`users/${userID}`}>
      <img className={`${style.user_image}`} src={image? image : userImageProp} alt="User avatar" />
      </Link>
      <div className={`${style.user_data_box}`}>
         <Link  to={`users/${userID}`} className={`${style.some_text_box}`}>
         <p style={{color: `#${colorTitle}`}} className={`${style.user_name}`}>{name}</p>

         <div className={`${style.user_subdata_box}`}>
               <p style={{color: `#${accentColor}`}}  className={`${style.user_active} ${dateActivity === "Online" ? style.user_active_online : ""}`}>{dateActivity}</p>
               <div className={`${style.user_active_pin} ${dateActivity === "Online" ? style.user_active_pin_online : ""}`}></div>
               
               <UserRole accentColor={accentColor} blurBg={blurBg} userRole={(role ? role : "User")}/>
         </div>
         </Link>
         {!BlurDots ? (
        <DotsMenu activeMenu={activeMenu} togglemenu={togglemenu} handleShareClick={handleShareClick} />
      ) : null}
      </div>
   </div>
}

export default UserHeaderCard