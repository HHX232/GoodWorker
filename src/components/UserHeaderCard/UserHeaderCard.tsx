import { FC, useState } from "react"
import { IUser } from "../../interfaces/interfaces"
import style from './UserHeaderCard.module.scss'
import UserRole from "../UserRole/UserRole"
import dotsImage from '../../images/svg/threeDats.svg'
import userImageProp from '../../images/stubs/stub-4.jpg'

interface somesingBlur extends IUser{
   blurBg?:boolean;
   BlurDots?:boolean;
   accentColor?:string;
   colorTitle?:string;
}
const UserHeaderCard:FC<somesingBlur> = ({image,colorTitle="141416", accentColor="868897", blurBg=false, BlurDots=false, role, dateActivity, name}) =>{
const [activeMenu,setActiveMenu] = useState(false);
const togglemenu = ()=>{
   setActiveMenu(!activeMenu);
}
   return <div className={`${style.user_box}`}>
      <img className={`${style.user_image}`} src={image? image : userImageProp} alt="User avatar" />
      <div className={`${style.user_data_box}`}>
         <div className={`${style.some_text_box}`}>
         <p style={{color: `#${colorTitle}`}} className={`${style.user_name}`}>{name}</p>

         <div className={`${style.user_subdata_box}`}>
               <p style={{color: `#${accentColor}`}}  className={`${style.user_active} ${dateActivity === "Online" ? style.user_active_online : ""}`}>{dateActivity}</p>
               <div className={`${style.user_active_pin} ${dateActivity === "Online" ? style.user_active_pin_online : ""}`}></div>
               <UserRole accentColor={accentColor} blurBg={blurBg} userRole={(role ? role : "User")}/>
         </div>
         </div>
        { !BlurDots ? <div className={`${style.dots_menu_box}`}>
         <img onClick={togglemenu} className={`${style.dots_image}`} src={dotsImage} alt="" />
         {activeMenu ?  <ul className={`${style.dots_menu}`}>
            <li className={`${style.dots_menu_item}`}>
               <p className={`${style.report}`}>Пожаловаться</p>
            </li>
            <li className={`${style.dots_menu_item}`}>
            <p className={`${style.share_item}`}>Поделиться</p>
            </li>
         </ul> :""}
         </div> : ""}
      </div>
   </div>
}

export default UserHeaderCard