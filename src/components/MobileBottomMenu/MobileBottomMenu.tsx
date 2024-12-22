import { FC, useEffect, useState } from 'react'
import style from './MobileBottomMenu.module.scss'
import { Link, useLocation } from 'react-router-dom'
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
import arrowImage from '../../images/white_arrow.svg';
import arrowImageBlack from '../../images/svg/grayArrow.svg';
import { SearchForm } from '../Header/Header'
import timeKillerSvh from '../../images/svg/timekiller.svg';
import timeKillerSvgActive from '../../images/svg/clockActive.svg'
import pomodoroSvg from '../../images/svg/pomodoro.svg'
import pomodoroSvgActive from '../../images/svg/pomodoroActive.svg'
import randimSvg from '../../images/svg/random.svg'
import randimSvgActive from '../../images/svg/randomActive.svg'
import settingsSvg from '../../images/svg/settings.svg'
import settingsSvgActive from '../../images/svg/settingActive.svg'
import supportSvg from '../../images/svg/support.svg'
import supportSvgActive from '../../images/svg/supportActive.svg'


const firstForImages = [searchSVG, plusSVG, messageSVG, saveSVG];
const firstForImagesActive = [searchSVGActive, plusSVGActive, messageSVGActive, saveSVGActive];


const secondForImages = [timeSVG, pomodoroSVG,randSVG]
const secondForImagesActive = [timeSVGActive, pomodoroSVGActive,randSVGActive]

const CreatItem = ()=>{
const location = useLocation()

   return <Link to="create">
      <div className={`${style.plus_box} ${(location && location.pathname !== "/create") ? style.home_bg : style.another_bg}`}>
         <img src={plusSVGActive} className={`${style.plus_svg}`} alt="" />
      </div>
   </Link>
}
const ListItem = ({imageUrl, activateLink="/", activeImageUrl}:{activateLink:string,imageUrl:string, activeImageUrl:string})=>{
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
   </Link>
   
</li>
}
const MenuArrow = ({someF}:{someF:()=>void}) =>{
   const [itemActive, setItemActive] = useState(false);
   const onDivClick = () =>{
      someF()
      setItemActive(!itemActive);
   }
   return <li onClick={()=>{onDivClick()}} key={uuidv4()} className={`${style.navbar_item}`}>
   <div className={`${itemActive ? style.navbar_item_link_active : style.navbar_item_link} `} >
   <img className={`${style.imageSvg} ${style.arrow_image} ${itemActive ?   style.arrow_active : ""}`} src={itemActive ? arrowImage : arrowImageBlack} alt=""/>
   </div>
   
</li>
}
const MobileBottomMenu:FC = ()=>{
const [openMenu, setOpenMenu] = useState(false);
const [filterText, setFilterText] = useState('');
const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
   setFilterText(event.target.value); 
   console.log(filterText)
};

const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
   event.preventDefault(); 
   console.log('Search term:', filterText);
};
const toggleMenu = ()=>{
   setOpenMenu(!openMenu);
}

   return <div className={`${style.menu_box}`}>
      <ul className={`${style.menu_links_list}`}>
         <li className={`${style.menu_link}`}>
            <Link to="/">
   <ListItem imageUrl={searchSVG} activateLink='/' activeImageUrl={searchSVGActive}/>
            </Link>
         </li>
         <li className={`${style.menu_link}`}>
            <Link to="/">
   <ListItem imageUrl={messageSVG} activateLink='/2' activeImageUrl={messageSVGActive}/>
            </Link>
         </li>
         <li className={`${style.menu_link}`}>
            <Link to="/create">
  <CreatItem/>
            </Link>
         </li>
         <li className={`${style.menu_link}`}>
            <Link to="/">
   <ListItem imageUrl={saveSVG} activateLink='/2' activeImageUrl={saveSVGActive}/>
            </Link>
         </li>
         <li className={`${style.menu_link}`}>
   <MenuArrow someF={toggleMenu} />
            
         </li>

      </ul>


      <ul className={`${style.full_menu} ${openMenu ? style.full_menu_active : ""}`}>
      <li style={{width:'100%'}} className={`${style.menu_link}`}>
      <SearchForm dopStyle={{width:"100%", display:'flex', margin:"0"}} filterText={filterText} onInputChange={handleInputChange} onSubmit={handleSubmit} />
      </li>
      <li className={`${style.menu_link}`}>
            <Link to="/timeKiller">
   <ListItem imageUrl={timeKillerSvh} activateLink='/timeKiller' activeImageUrl={timeKillerSvgActive}/>
            </Link>
            <p className={`${style.link_text}`}>Time Killer</p>
         </li>

      <li className={`${style.menu_link}`}>
            <Link to="/pomodoro">
   <ListItem imageUrl={pomodoroSvg} activateLink='/pomodoro' activeImageUrl={pomodoroSvgActive}/>
            </Link>
            <p className={`${style.link_text}`}>Pomodoro</p>
         </li>
      <li className={`${style.menu_link}`}>
            <Link to="/random">
   <ListItem imageUrl={randimSvg} activateLink='/random' activeImageUrl={randimSvgActive}/>
            </Link>
            <p className={`${style.link_text}`}>Randomizer</p>
         </li>
      <li className={`${style.menu_link}`}>
            <Link to="/settings">
   <ListItem imageUrl={settingsSvg} activateLink='/settings' activeImageUrl={settingsSvgActive}/>
            </Link>
            <p className={`${style.link_text}`}>Settings</p>
         </li>

      <li className={`${style.menu_link}`}>
            <Link to="/support">
   <ListItem imageUrl={supportSvg} activateLink='/support' activeImageUrl={supportSvgActive}/>
            </Link>
            <p className={`${style.link_text}`}>Support</p>
         </li>
    
      </ul>
   </div>
}
export default MobileBottomMenu