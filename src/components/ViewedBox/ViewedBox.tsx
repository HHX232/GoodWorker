import React, { FC, useEffect, useState } from "react";
import style from './ViewedBox.module.scss';
import UserRole, { TUserRole } from "../UserRole/UserRole";
import stub from '../../images/stubs/stub-1.jpg'
import { v4 as uuid, validate } from 'uuid';
import PostFooter from "../PostFooter/PostFooter";
import request from "../../utils/request";
import { Skeleton } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { IUserDefault } from "../../interfaces/interfaces";
import stubImage from '../../images/stubs/stub-1.jpg'
interface IViewedItem{
   postId:string;
   setLoad:any;
   user:{
      avatar:string;
      name:string;
      activity:string;
      role:TUserRole;
      id?:string;
   };
}

interface IUser {
   avatar: string;
   id: number;
   registrationDate: string; 
   role: string;
   username: string;
}

interface IPostLocal {
   body: string;
   commentsCount: string;
   id: number;
   images: string[];
   publicationDate: string; 
   starsCount: string;
   subtitle: string;
   title: string;
   user: IUserDefault;
   video: string;
   videoPreview: string | null; 
   viewsCount: string;
}

const ViewedItem: FC<IViewedItem> = ({postId ,setLoad,user}) =>{
const [postObject, setPostObject] = useState<IPostLocal>()


useEffect(() => {
   const fetchPostData = async () => {
       try {
           const response = await request<any>(`posts/${postId}`);
           setPostObject(response);
           setLoad(false)
       } catch (error) {
           console.error('Error fetching post data:', error);
       }
   };

   fetchPostData();
}, [postId]);

   return (postObject ? <Link to={`posts/${postObject.id}`} key={uuid()} className={`${style.item_box}`}>
      <Link to={`users/${postObject.user.id}`} className={`${style.user_box}`}>
         <img src={ (postObject && postObject.user.avatar) ?  postObject.user.avatar : stub} alt="" className={`${style.user_avatar}`} />
         <div className={`${style.user_text_box}`}>
            <p className={`${style.user_name}`}>{postObject.user.username ? postObject.user.username : "No Name"}</p>
            <div className={`${style.user_subtext}`}>
               <p className={`${style.user_active} ${user.activity === "Online" ? style.user_active_online : ""}`}>{user.activity}</p>
               <div className={`${style.user_active_pin} ${user.activity === "Online" ? style.user_active_pin_online : ""}`}></div>
               <UserRole userRole={(postObject.user.role ? postObject.user.role : "User")}/>
            </div>
         </div>
      </Link>

      <div className={`${style.item_body}`}>
         <div className={`${style.item_body_box}`}>
         <div className={`${style.item_body_title}`}>{postObject.title}</div>
         {postObject.title.length <=25 ? <div className={`${style.item_body_subtitle}`}>{postObject.subtitle}</div> : null}
         </div>
         { (postObject.images.length > 0 && typeof(postObject.images[0]) === "string") 
    ? <img src={postObject.images[0] !== undefined ? postObject.images[0] : stub} alt="" className={`${style.item_body_image}`} /> 
    : <img src={stub} alt="" className={`${style.item_body_image}`} /> 
}
       
      </div>
      <PostFooter comments={postObject.commentsCount} vues={postObject.viewsCount} stars={postObject.starsCount}/>
   </Link> : <Skeleton variant="rounded" style={{minWidth:"250px"}} width={"100%"} height={"100px"} className={`${style.item_box}`}/>)
}
const ViewedBox: FC = ({}) =>{
   const [postsIds, setPostsids] = useState<string[]>()
   const [isLoading, setIsLoading] = useState(true)
   const location = useLocation();

   useEffect(()=>{
      const storedArray: string[] = JSON.parse(localStorage.getItem('cardIds') || '[]');
      setPostsids(storedArray)
   },[location])

   if(postsIds?.length === 0){
      return <div className={`${style.viewed_box}`}><h3 className={`${style.viewed_title}`}>Recently viewed</h3>
       <ul className={`${style.viewed_list}`}>
         <p>No viewed</p>
       </ul>
      </div> 
   }
   return <div className={`${style.viewed_box}`}>
      {!isLoading ? <h3 className={`${style.viewed_title}`}>Recently viewed</h3> : <Skeleton variant="rounded" width={"100%"} height={"auto"} className={`${style.item_box}`}/>}
      <ul className={`${style.viewed_list}`}>
        
         {postsIds && postsIds.map((el)=>{
            return <ViewedItem setLoad={setIsLoading} key={uuid()} postId={el} user={ {avatar:stub, name: "Savannah Johnson", activity:"1d ago", role:"Admin"} }/>
         })}
      </ul>
   </div>
}

export default ViewedBox