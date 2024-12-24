import React, { FC, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import style from './ContentBox.module.scss'
import NavBar from "../NavBar/NavBar";
import CommunitiesBoard from "../CommunitiesBoard/CommunitiesBoard";
import UserRole from "../UserRole/UserRole";
import ViewedBox from "../ViewedBox/ViewedBox";
import UserDataBox from "../UserDataBox/UserDataBox";
import avatarRole from '../../images/avatar-ulkar-batista-3827543-27427385.jpg'
import CommentsBoxLittle from "../CommentsBoxLittle/CommentsBoxLittle";
const ContentBox: FC = ()=>{

   const location = useLocation()
   const contentBoxRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
    
      if (location.pathname.includes('/posts')) {
        if (contentBoxRef.current) {
          contentBoxRef.current.scrollTop = 0;
        }
      }
    }, [location.pathname]);

   return <div className="content_box" ref={contentBoxRef}>
      <NavBar/>
      <Outlet/>
      <div className="boards_box">

  { !location.pathname.includes('posts') ?    <CommunitiesBoard/> :  <UserDataBox user={{avatar: avatarRole,name:"Ekaterina Ivanova", email:"@Ekaterina.com" , role:"Admin"}} views="50,000" date="20 Jul 2024 - 04:21GMT" categories={['Science' ,'IT','IT','IT']}/> 
  }
  { !location.pathname.includes('posts') ?      <ViewedBox/> :  <CommentsBoxLittle commentsCount={400} comments={[]}/> 
  }


 
      </div>
   </div>
}

export default ContentBox