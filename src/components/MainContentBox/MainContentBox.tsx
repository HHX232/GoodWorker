import React, { FC, ReactNode, useEffect, useState } from "react";
import style from './MainContentBox.module.scss'
import Card from "../Card/Card";
import defIm1 from '../../images/pexels-annija-u-492300719-15985570.jpg'
import defIm2 from '../../images/post_big_2.jpg'
import defIm3 from '../../images/pexels-anhdanghihi-16445771.jpg'
import HighlightedPost from "../HighlightedPost/HighlightedPost";
import somebg from '../../images/pexels-inna-yn-551795054-28625534.jpg'
import somebg2 from '../../images/pexels-kaiwalya-limaye-1997844793-29034031.jpg'
import somebg3 from '../../images/backProp3.jpg'
import arrowImage from '../../images/white_arrow.svg'
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { Skeleton } from "@mui/material";

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
  };
  user?:{
    avatar: string | null;
    id: number | string;
    username:string;
    roles: string| string[];
  }

}
const MainContentBox:FC = ({})=>{

  const [highLightedPosts, setHighLightedPosts] = useState<HighlightedPostObj[] | null>(null);
  const [defaultPosts, setDefaultPosts] = useState<HighlightedPostObj[] | null>(null);

    const hPostsReq = async ()=>{
      await fetch("https://goodworker.onrender.com/api/v1/all_posts").then(data => data.json())
      .then(response =>{ setHighLightedPosts(response?.highlightedPosts); setDefaultPosts(response?.posts) }).catch(er=>console.log("error"));
      
    }
  useEffect(()=>{
    const fetchData = async () => {
      await hPostsReq();
    };

    fetchData();
    console.log(highLightedPosts)
  },[])




   let settings = {
      // dots: true,
      infinite: true,
      speed: 500,
      slidesToShow: 2,
      slidesToScroll: 1,
      prevArrow: <CustomArrowLeft />,
      nextArrow: <CustomArrowRight />,
    };
   return <div className={`${style.main_content_box}`}>

      <div className={`${style.swiper_box}`}>
      <Slider {...settings} >

      {!highLightedPosts ? <Skeleton variant="rounded" width={"100%"} height={"auto"} className={`${style.skeleton_card}`}/> : null}
        {!highLightedPosts ? <Skeleton variant="rounded" width={"100%"} height={"auto"} className={`${style.skeleton_card}`}/> : highLightedPosts.map((element,index)=>{
          return <HighlightedPost backgroundImage={element.image} highLightTitle={element.title} defaultTitle={element.title} subtitle=
           // ! хардкордженные данные заменить
          {element.subtitle} user={{image:element.author.avatar, dateActivity:"Online", name:element.author.username, role:"Admin"}}/>
        }) }
        
        
         
      </Slider>
      </div>
      <div className={`${style.title_box}`}>
      <h2 className={`${style.main_content_title}`}>All posts</h2>
      <div className={`${style.title_line}`}></div>
      </div>
       <div className={style.main_box}>
        {!defaultPosts ? <Skeleton variant="rounded" width={"100%"} height={"auto"} className={`${style.skeleton_card}`}/> : null}
        {!defaultPosts ? <Skeleton variant="rounded" width={"100%"} height={"auto"} className={`${style.skeleton_card}`}/> : null}
        {defaultPosts?.map((el)=>{
          // ! хардкордженные данные заменить
          
          return <Card title={el.title} subTitle={el.subtitle} imagesArray={el.images} user={{image:el.user? el.user.avatar:"", dateActivity:"Online", name:el.user ? el.user.username : "NoName", role:"Admin"}}/>
        })}
        
   </div>

   </div>
}
export default MainContentBox