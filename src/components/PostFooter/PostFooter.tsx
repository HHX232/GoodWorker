import { FC } from 'react'
import style from './PostFooter.module.scss'
import starSvg from '../../images/svg/gold-star.svg'
import vuesSvg from '../../images/svg/vues.svg'
import commSvg from '../../images/svg/comments_mini.svg'
interface TPostFooter {
   comments: string ;
   vues: string;
   stars: string;
}
const PostFooter:FC<TPostFooter> =({comments, vues, stars})=>{

return <div className={`${style.post_box}`}>
<div className={`${style.comm_box}`}>
   <div className={`${style.img_comm_box}`}>
   <img src={commSvg} alt="" className={`${style.comm_img}`} />
   </div>
   <div className={`${style.comm_count}`}>{comments}</div>
</div>
<div className={`${style.vues_box}`}>
   <img src={vuesSvg} alt="" className={`${style.vues_img}`} />
   <div className={`${style.vues_count}`}>{vues}</div>
</div>
<div className={`${style.stars_box}`}>
   <img src={starSvg} alt="" className={`${style.star_image}`} />
   <div className={`${style.star_count}`}>{stars}</div>
</div>
</div>
}
export default PostFooter