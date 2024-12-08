import React, { FC } from "react";
import style from './ViewedBox.module.scss';
import UserRole, { TUserRole } from "../UserRole/UserRole";
import stub from '../../images/stubs/stub-1.jpg'
import { v4 as uuid } from 'uuid';
import PostFooter from "../PostFooter/PostFooter";
interface IViewedItem{
   user:{
      avatar:string;
      name:string;
      activity:string;
      role:TUserRole;
   };
   title:string;
   images: string[];
   comments:string ;
   vues:string ;
   stars:string ;
}

const ViewedItem: FC<IViewedItem> = ({user, title, images, comments, vues, stars}) =>{

   return <li key={uuid()} className={`${style.item_box}`}>
      <div className={`${style.user_box}`}>
         <img src={user.avatar} alt="" className={`${style.user_avatar}`} />
         <div className={`${style.user_text_box}`}>
            <p className={`${style.user_name}`}>{user.name ? user.name : "No Name"}</p>
            <div className={`${style.user_subtext}`}>
               <p className={`${style.user_active} ${user.activity === "Online" ? style.user_active_online : ""}`}>{user.activity}</p>
               <div className={`${style.user_active_pin} ${user.activity === "Online" ? style.user_active_pin_online : ""}`}></div>
               <UserRole userRole={(user?.role ? user.role : "User")}/>
            </div>
         </div>
      </div>

      <div className={`${style.item_body}`}>
         <div className={`${style.item_body_title}`}>{title}</div>
         { (images.length !== 0 &&  typeof(images[0])=="string" ) ?   <img src={images[0]} alt="" className={`${style.item_body_image}`} /> : "" }
       
      </div>
      <PostFooter comments={comments} vues={vues} stars={stars}/>
   </li>
}
const ViewedBox: FC = ({}) =>{

   return <div className={`${style.viewed_box}`}>
      <h3 className={`${style.viewed_title}`}>Recently viewed</h3>
      <ul className={`${style.viewed_list}`}>
         <ViewedItem comments={"12"} vues={"12k"} stars={"4.9"} images={[stub]} title="Simple Ways to Boost Productivity" user={ {avatar:stub, name: "Savannah Johnson", activity:"1d ago", role:"Admin"} }/>
         <ViewedItem comments={"12"} vues={"12k"} stars={"4.9"} images={[stub]} title="Simple Ways to Boost Productivity" user={ {avatar:stub, name: "Savannah Johnson", activity:"1d ago", role:"Admin"} }/>
      </ul>
   </div>
}

export default ViewedBox