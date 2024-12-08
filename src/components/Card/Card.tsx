import { FC } from 'react'
import style from './Card.module.scss'
import { IUser } from '../../interfaces/interfaces';
import userImageProp from '../../images/stubs/stub-4.jpg'
import UserHeaderCard from '../UserHeaderCard/UserHeaderCard';
import postImage from '../../images/post_big_1.jpg'
import postImage2 from '../../images/post_big_2.jpg'
import {v4 as uuid} from 'uuid'
import { Link } from 'react-router-dom';
import PostFooterMain from '../PostFooterMain/PostFooterMain';
interface ICard {
   title:string;
   subTitle:string;
   highlightText?:string;
   user:IUser;
   imagesArray:Array<string> | undefined;
}



const Card:FC<ICard> = ({title="underfind", subTitle = "", user, imagesArray=[postImage,postImage2]})=>{

   return <div className={`${style.card_box}`}>
     <UserHeaderCard image={userImageProp} role={user.role} dateActivity={user.dateActivity} name={user.name}/>

     <div className={`${style.card_text_box}`}>
      <h5 className={`${style.card_title}`}>{title}</h5>
      <p className={`${style.card_subtitle}`}>{subTitle}</p>
     </div>

   <ul className={`${style.card_images_list}`}>
   {imagesArray.map((image,index) =>{
      if(index > 1){
         return
      }
      return <li key={uuid()} className={`${style.card_images_item}`}>
      <Link className={`${style.image_link}`} to="/">
      <div  style={{ backgroundImage: `url(${image})` }} className={`${style.card_image}`}  />
      </Link>
   </li>
   })}
   </ul>
   <PostFooterMain comments='123' vues='333' stars='4.9' />
   <Link to="" className={`${style.link_button}`}>
   <p className={`${style.link_text}`}>Read full post</p>
   <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M1 8H15M15 8L8 1M15 8L8 15" stroke="#868897" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
   </Link>
   </div>

}

export default Card