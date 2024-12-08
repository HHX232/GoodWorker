import React, { FC } from "react";
import { Outlet } from "react-router-dom";
import style from './ContentBox.module.scss'
import NavBar from "../NavBar/NavBar";
import CommunitiesBoard from "../CommunitiesBoard/CommunitiesBoard";
import UserRole from "../UserRole/UserRole";
import ViewedBox from "../ViewedBox/ViewedBox";
const ContentBox: FC = ()=>{
   
   return <div className="content_box">
      <NavBar/>
      <Outlet/>
      <div className="boards_box">
      <CommunitiesBoard/>
   <ViewedBox/>
      </div>
   </div>
}

export default ContentBox