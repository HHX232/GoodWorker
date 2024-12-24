import { FC, useEffect, useState } from 'react'
import style from './Card.module.scss'
import { IUser } from '../../interfaces/interfaces';
import userImageProp from '../../images/stubs/stub-4.jpg'
import UserHeaderCard from '../UserHeaderCard/UserHeaderCard';
import postImage from '../../images/post_big_1.jpg'
import postImage2 from '../../images/post_big_2.jpg'
import stubImage from '../../images/stubs/stub-1.jpg'
import {v4 as uuid} from 'uuid'
import { Link } from 'react-router-dom';
import PostFooterMain from '../PostFooterMain/PostFooterMain';
import request from '../../utils/request';

interface ICard {
   title:string;
   subTitle:string;
   highlightText?:string;
   user:IUser;
   imagesArray:Array<string> | undefined ;
   comments:string;
   vues:string;
   stars:string;
   commentsCount?:string;
   cardId:string;
   userId?:string;
}

export function AddLocalId(cardId: string): void {

   const storedArray: string[] = JSON.parse(localStorage.getItem('cardIds') || '[]');

   if (storedArray.length === 0) {
       storedArray.push(cardId);
   } else if (storedArray.length === 1) {
       // Если в массиве уже один элемент, добавляем второй
       storedArray.push(cardId);
       storedArray.reverse();
   } else {
       storedArray[1] = cardId;
       storedArray.reverse();
   }
   localStorage.setItem('cardIds', JSON.stringify(storedArray));
}

const Card:FC<ICard> = ({userId,comments="0", cardId ,vues="0",stars="0",title="underfind", subTitle = "", user, imagesArray=[stubImage]})=>{
   
   // useEffect(()=>{
   //    console.log(imagesArray)
   // },[])
  

   return <div onClick={()=>AddLocalId(cardId)} className={`${style.card_box}`}>
     <UserHeaderCard userID={userId} cardID={cardId} image={user.image} role={user.role} dateActivity={user.dateActivity} name={user.name}/>

     <Link to={`posts/${cardId}`} className={`${style.card_text_box}`}>
      <h5 className={`${style.card_title}`}>{title}</h5>
      <p className={`${style.card_subtitle}`}>{subTitle}</p>
     </Link>

   <ul className={`${style.card_images_list}`}>
   {imagesArray.map((image,index) =>{
      if(index > 1){
         return null
      }
      return <li key={uuid()} className={`${index%2  ? style.hidden_image : ""} ${style.card_images_item}`}>
      <Link className={`${style.image_link} `} to={`posts/${cardId}`}>
      <div  style={{ backgroundImage: `url(${image})` }} className={`${style.card_image}`}  />
      </Link>
   </li>
   })}
   </ul>
   <PostFooterMain parentPostID={cardId} comments={comments} vues={vues} stars={stars} />
   <Link to={`posts/${cardId}`} className={`${style.link_button}`}>
   <p className={`${style.link_text}`}>Read full post</p>
   <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M1 8H15M15 8L8 1M15 8L8 15" stroke="#868897" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
   </Link>
   </div>

}

export default Card

