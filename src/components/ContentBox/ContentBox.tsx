import React, { FC } from "react";
import { Outlet, useLocation } from "react-router-dom";
import style from './ContentBox.module.scss'
import NavBar from "../NavBar/NavBar";
import CommunitiesBoard from "../CommunitiesBoard/CommunitiesBoard";
import UserRole from "../UserRole/UserRole";
import ViewedBox from "../ViewedBox/ViewedBox";
import UserDataBox from "../UserDataBox/UserDataBox";
import avatarRole from '../../images/avatar-ulkar-batista-3827543-27427385.jpg'
const ContentBox: FC = ()=>{
   const location = useLocation()
   return <div className="content_box">
      <NavBar/>
      <Outlet/>
      <div className="boards_box">

  { !location.pathname.includes('posts') ?    <CommunitiesBoard/> : <UserDataBox user={{avatar: avatarRole,name:"Ekaterina Ivanova", email:"@Ekaterina.com" , role:"Admin"}} views="50,000" date="20 Jul 2024 - 04:21GMT" categories={['Science' ,'IT','IT','IT']}/>}
   <ViewedBox/>
      </div>
   </div>
}

export default ContentBox