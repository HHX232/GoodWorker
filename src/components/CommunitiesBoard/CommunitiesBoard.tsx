import React, { FC } from "react";
import style from './CommunitiesBoard.module.scss'
import { v4 as uuid } from 'uuid';
import com1Jpg from '../../images/com1.jpg'
import com2Jpg from '../../images/com-2.jpg'
import com3Jpg from '../../images/com3.jpg'
import com4Jpg from '../../images/com4.jpg'
import com5Jpg from '../../images/com5.jpg'
import { Link } from "react-router-dom";
interface IComItem{
   image: string;
   title:string;
   online:string;
   newPosts:string;
   linkTo:string;
}
const communityItems:IComItem[] = [
   {
     image: com1Jpg,
     title: "UX InsightUX InsightUX InsightUX InsightUX InsightUX InsightUX InsightUX InsightUX InsightUX InsightUX InsightUX Insight",
     online: "850",
     newPosts: "120",
     linkTo:'/'
   },
   {
     image: com2Jpg,
     title: "CodeCraft",
     online: "1,500",
     newPosts: "300",
     linkTo:'/'
   },
   {
     image: com3Jpg,
     title: "AI Nexus",
     online: "1,050",
     newPosts: "90",
     linkTo:'/'
   },
   {
     image: com4Jpg,
     title: "Science Sphere",
     online: "600",
     newPosts: "45",
     linkTo:'/'
   },
   {
     image: com5Jpg,
     title: "Art & Sketches-international",
     online: "1,200",
     newPosts: "180",
     linkTo:'/'
   },
 
   // Additional data
   {
     image: com1Jpg,
     title: "Design Haven",
     online: "900",
     newPosts: "150",
     linkTo:'/'
   },
   {
     image: com3Jpg,
     title: "Dev Talks",
     online: "1,700",
     newPosts: "320",
     linkTo:'/'
   },
   {
     image: com5Jpg,
     title: "Tech Frontier",
     online: "800",
     newPosts: "60",
     linkTo:'/'
   },
   {
     image: com2Jpg,
     title: "Future AI",
     online: "950",
     newPosts: "110",
     linkTo:'/'
   },
   {
     image: com4Jpg,
     title: "Creative Works",
     online: "1,300",
     newPosts: "200",
     linkTo:'/'
   },
 ];

const ComItem:FC<IComItem> = ({image,title,online,newPosts, linkTo})=>{

   return <li key={uuid()} className={`${style.com_item_box}`}>
      <Link  to={linkTo} className={`${style.com_box_link}`}>
      <img className={`${style.com_box_image}`} src={image} alt="" />
      <div className={`${style.com_text_box}`}>
      <h4 className={`${style.com_item_title}`}>{title}</h4>
      <div className={`${style.com_item_mini_box}`}>
         <div className={`${style.online_box}`}>
            <div className={`${style.online_point}`}></div>
            <div className={`${style.online_text}`}>{`${online} Online`}</div>
         </div>
         <div className={`${style.new_posts_box}`}>
            <div className={`${style.new_posts_point}`}></div>
            <div className={`${style.new_posts_text}`}>{`${newPosts} New Posts`}</div>
         </div>
      </div>
      </div>
      </Link>
   </li>

}

const CommunitiesBoard:FC = ()=>{

   return <div className={`${style.com_box}`}>
      <h2 className={`${style.com_title}`}>My communities</h2>
      <ul className={`${style.com_list}`}>
         {communityItems.map((item,index)=>{
            return  <ComItem key={uuid()} newPosts={item.newPosts} online={item.online} linkTo={item.linkTo} title={item.title} image={item.image}/>
         })}
        
      </ul>
   </div>
}
export default CommunitiesBoard