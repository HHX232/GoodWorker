import React, { FC, ReactNode, useEffect, useState } from "react";
import style from './MainContentBox.module.scss'
import Card from "../Card/Card";
import defIm1 from '../../images/pexels-annija-u-492300719-15985570.jpg'
import defIm2 from '../../images/post_big_2.jpg'
import defIm3 from '../../images/pexels-anhdanghihi-16445771.jpg'
import HighlightedPost from "../HighlightedPost/HighlightedPost";
import somebg from '../../images/pexels-inna-yn-551795054-28625534.jpg'
import arrowImage from '../../images/white_arrow.svg'
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { Skeleton } from "@mui/material";
import request from "../../utils/request";
import { TUserRole } from "../UserRole/UserRole";
import {v4 as uuid} from 'uuid'
import postAPI, {  } from "../../services/PostService";
import { IDefaultPost } from "../../interfaces/interfaces";
import MobileBottomMenu from "../MobileBottomMenu/MobileBottomMenu";
import { useLocation } from "react-router-dom";


const CustomArrowRight: FC<{ onClick?: () => void }> = ({ onClick }) => {


   return (
     <div className={style.custom_box_right} onClick={onClick}>
       <img className={style.image_tag} src={arrowImage} alt="Next" />
     </div>
   );
 };
 
 const CustomArrowLeft: FC<{ onClick?: () => void }> = ({ onClick }) => {
   return (
     <div className={style.custom_box_left} onClick={onClick}>
       <img className={style.image_tag} src={arrowImage} alt="Previous" />
     </div>
   );
 };
 
 interface HighlightedPostObj {
  title: string;
  subtitle:string;
  image?: string;
  images?: string[];
  publicationDate: string;
  video: string;
  videoPreview:string;
  id: number | string;
  author:{
    avatar: string | null;
    id: number | string;
    username:string;
    roles: string| string[];
    role?:TUserRole;
  };
  user?:{
    avatar: string | null;
    id: number | string;
    username:string;
    roles: string| string[];
    role?:string | undefined;
  }
  commentsCount?:string;
  viewsCount?:string;
  starsCount?:string;
}
const MainContentBox:FC = ({})=>{
  const location = useLocation();
  const [highLightedPosts, setHighLightedPosts] = useState<HighlightedPostObj[] | null>(null);
  const [defaultPosts, setDefaultPosts] = useState<IDefaultPost[] | null>(null);

  const { data, error, isLoading } = postAPI.useFetchAllPostsQuery(undefined, {
    pollingInterval: 300000,
  });
  
  // useEffect(()=>{
  //   try{
  //   request("/all_posts").then(res => console.log(res))
  // }catch(e){
  //   console.log(e)
  // }
  // },[])

  
useEffect(()=>{

  setDefaultPosts(data !== undefined ? data?.posts : null);
  setHighLightedPosts(data !== undefined ? data?.highlightedPosts : null );
},[data])

  useEffect(()=>{
    // console.log("defaultPosts", defaultPosts ? defaultPosts[0].body : "", defaultPosts && defaultPosts[0])
  },[highLightedPosts,setHighLightedPosts])



  const [settings, setSettings] = useState({
    infinite: true,
    speed: 500,
    slidesToShow: 2,
    slidesToScroll: 1,
    initialSlide:1,
    autoplay:true,
    autoplaySpeed:5000,
    prevArrow: <CustomArrowLeft />,
    nextArrow: <CustomArrowRight />,
    draggable: true,
   swipe:true, 
  });

  // Функция для обновления параметров слайдера на основе ширины экрана
  const updateSettings = () => {
    if (window.innerWidth < 1200) {
      setSettings((prev) => ({ ...prev, slidesToShow: 1 }));
    } else {
      setSettings((prev) => ({ ...prev, slidesToShow: 2 }));
    }
  };

  // Отслеживаем изменения ширины экрана
  useEffect(() => {
    updateSettings(); // Устанавливаем параметры при загрузке компонента
    window.addEventListener('resize', updateSettings); // Подписываемся на изменения размера окна
    return () => {
      window.removeEventListener('resize', updateSettings); // Очищаем подписку
    };
  }, []);
   return <div className={`${style.main_content_box}`}>

      <Slider className={`${style.swiper_box}`} {...settings} >

      {(isLoading || error) ? <Skeleton key={uuid()} variant="rounded" width={"100%"} height={"auto"} className={`${style.skeleton_card}`}/> : null}
        {(isLoading || error) ? <Skeleton key={uuid()} variant="rounded" width={"100%"} height={"auto"} className={`${style.skeleton_card}`}/> : highLightedPosts?.map((element,index)=>{
          return <HighlightedPost key={uuid()} cardId={element.id.toString()} backgroundImage={defIm3} highLightTitle={element.title} defaultTitle={element.title} subtitle=
           // TODO хардкордженные данные заменить
          {element.subtitle} user={{image:element.author.avatar ? element.author.avatar : "", dateActivity:"Online", name:element.author.username, avatar:element.author.avatar ? element.author.avatar : "",id: element.author.id ? element.author.id.toString() :"",
            role:(element.author.role as any)}}/>
        }) }
        
        
         
      </Slider>
     
      <div className={`${style.title_box}`}>
      <h2 className={`${style.main_content_title}`}>All posts</h2>
      <div className={`${style.title_line}`}></div>
      </div>
       <div className={style.main_box}>
        {!defaultPosts ? Array(6).fill(0).map(()=>{return <Skeleton key={uuid()} variant="rounded" width={"100%"} height={"auto"} className={`${style.skeleton_card}`}/>})  : null}
       
        {defaultPosts?.map((el)=>{
          //TODO хардкордженные данные заменить
          // console.log("el.starsCount",el.starsCount)
          return <Card key={uuid()} userId={el.user.id ? el.user.id : ""} cardId={el.id.toString()} stars={el.starsCount != null ? el.starsCount :"666"} vues={el.viewsCount != null ? el.viewsCount : "666"} comments={el.commentsCount != null ? el.commentsCount : "666"} title={el.title} subTitle={el.subtitle} imagesArray={el.images?.length === 0 ? undefined : el.images} user={{image: el.user.avatar? el.user.avatar: el.user.avatar, dateActivity:"Online", name:el.user.username ? el.user.username : "NoName", role: el.user ?el.user.role : "User"  }}/>
        })}
        
   </div>


   </div>
}
export default MainContentBox