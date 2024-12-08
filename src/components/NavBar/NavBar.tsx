import React, { useEffect, useState } from "react";
import style from './NavBar.module.scss'
import { Link, useLocation, useParams } from "react-router-dom";
import searchSVG from '../../images/svg/home.svg'
import searchSVGActive from '../../images/svg/homeACtive.svg'
import plusSVG from '../../images/svg/plus.svg'
import plusSVGActive from '../../images/svg/plusActive.svg'
import messageSVG from '../../images/svg/messages.svg'
import messageSVGActive from '../../images/svg/messageActive.svg'
import saveSVG from '../../images/svg/saved.svg'
import saveSVGActive from '../../images/svg/savedActive.svg'
import timeSVGActive from '../../images/svg/clockActive.svg'
import timeSVG from '../../images/svg/clock.svg'
import pomodoroSVG from '../../images/svg/pomodoro.svg'
import pomodoroSVGActive from '../../images/svg/pomodoroActive.svg'
import randSVGActive from '../../images/svg/randomActive.svg'
import randSVG from '../../images/svg/random.svg'
import { v4 as uuidv4 } from 'uuid';

const firstForImages = [searchSVG, plusSVG, messageSVG, saveSVG];
const firstForImagesActive = [searchSVGActive, plusSVGActive, messageSVGActive, saveSVGActive];
const firstForText = ["home", "Create post", "Messages", "Saved items"]
const firstForLinks = ["/", "/create", "/messages", "/saved"]

const secondForImages = [timeSVG, pomodoroSVG,randSVG]
const secondForImagesActive = [timeSVGActive, pomodoroSVGActive,randSVGActive]
const secondForText = ["Time Killer", 'Pomodoro', 'Randomizer']
const secondForLinks = ['/games', '/pomodoro', '/rand']

const ListItem = ({imageUrl, activateLink="/", activeImageUrl, itemText="someText"}:{activateLink:string,imageUrl:string, activeImageUrl:string, itemText:string})=>{
   const [itemActive, setItemActive] = useState(false);
   const location = useLocation();
   const activePathName = location.pathname;

  useEffect(()=>{
   if(activePathName === activateLink){
      setItemActive(true)
   }else{
      setItemActive(false)
   }
  },[location, useLocation])


   return <li key={uuidv4()} className={`${style.navbar_item}`}>

   <Link className={`${itemActive ? style.navbar_item_link_active : style.navbar_item_link}  `} to={activateLink}>
   <img className={`${style.imageSvg}`} src={itemActive ? activeImageUrl : imageUrl} alt=""/>
   <p className={`${style.text}`}>{itemText}</p>
   </Link>
   
</li>
}


const NavBar = () =>{
   const [isLoading, setIsLoading] = useState(false)


   return <nav className={`${style.navbar_box}`}>
      <ul className={`${style.navbar_list}`}>
          {firstForText.map((item,index)=>{
      return <ListItem key={uuidv4()} itemText={item} activateLink={firstForLinks[index]} imageUrl={firstForImages[index]} activeImageUrl={firstForImagesActive[index]}  />
   })}
      </ul>
      <ul className={`${style.navbar_list}`}>
          {secondForText.map((item,index)=>{
      return <ListItem key={uuidv4()} itemText={item} activateLink={secondForLinks[index]} imageUrl={secondForImages[index]} activeImageUrl={secondForImagesActive[index]}  />
   })}
      </ul>
   </nav>
}
export default NavBar