import { useParams } from 'react-router-dom';
import style from './FullCommentsPage.module.scss'
import postAPI from '../../../services/PostService';
import CommentsCreate from '../../CommentsCreate/CommentsCreate';
import { CommentItem, responseCommentsFake } from '../../CommentsBoxLittle/CommentsBoxLittle';
import {v4 as uuid} from 'uuid';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { useEffect } from 'react';
import crestSvg from '../../../images/svg/crest.svg'
import { removeCommImage } from '../../../services/reducers/CommentImages';

export const CommentImage = ({imageUrl, indexUrl, widthImage="85"}:{imageUrl:string, indexUrl:string, widthImage?: string}) =>{
   const dispatch = useAppDispatch();
const onCrestClick = ()=>{
  dispatch(removeCommImage(parseInt(indexUrl)))
}
   return <div key={uuid()} className={`${style.image_box_element_box}`}>
      <div  style={{backgroundImage: `url(${imageUrl})`, width:`${widthImage}px`, height:`${widthImage}px`}} className={`${style.image_box_element}`}></div>
      <img onClick={()=>{onCrestClick()}} className={`${style.crest_element}`} src={crestSvg} alt="" />

   </div>
}

export const FullCommentsPage = () => {

   const paramsUrl = useParams().id;
const stringPostId: string | undefined = (paramsUrl && paramsUrl.toString())

const { data: post, error, isLoading } = postAPI.useFetchPostByIdQuery(stringPostId ? stringPostId : "");
const postComments = post?.comments ;

   const images = useAppSelector((state)=>state.comImages.images);

   
   return (
      <div className={style.full_box}>
      
         <div className={`${style.comments_full_box}`}>
         {responseCommentsFake.comments.map((comment) => {
            return <CommentItem dotsMenu='32' miniSize={false} avatarWidth='42' fontText='14' key={uuid()} id={comment.id} message={comment.message} publicationDate={comment.publicationDate} user={comment.user} />
         })}
         {responseCommentsFake.comments.map((comment) => {
            return <CommentItem  dotsMenu='32' miniSize={false} avatarWidth='42' fontText='14' key={uuid()} id={comment.id} message={comment.message} publicationDate={comment.publicationDate} user={comment.user} />
         })}
         
         
         </div>
      <div className={`${style.create_box}`}>   

    {images.length > 0 && <div className={`${style.images_box}`}>
           {images.map((image, index)=>{
              return <CommentImage indexUrl={index.toString()} imageUrl={image}/>
           })}
         </div>}

         <CommentsCreate addSvgSize='28px' sendSvgSize='32px' inputWidth='100%' textSize='18px'/>
         </div>   
      </div>
   )

}
export default FullCommentsPage;