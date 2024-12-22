import { FC, useState } from 'react'
import style from './PostFooterMain.module.scss'

import starSvg from '../../images/svg/gold-star.svg'
import vuesSvg from '../../images/svg/vues.svg'
import commSvg from '../../images/svg/comments_mini.svg'
import shareSvg from '../../images/svg/share.svg'
import { Link } from 'react-router-dom'
import Tooltip from '@mui/material/Tooltip';
interface TPostFooter {
   comments: string ;
   vues: string;
   stars: string;
   parentPostID: string;
}
const PostFooterMain:FC<TPostFooter> =({comments,parentPostID, vues, stars})=>{
const [copyMessage, setCopuMessage] = useState(false);

   const handleShareClick = (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setCopuMessage(true)
      setTimeout(() => {
        setCopuMessage(false)
      }, 2500);
      //TODO добавить актуальную ссылку
      const urlToCopy = `https://goodworker.com/posts/${parentPostID}`;
      navigator.clipboard.writeText(urlToCopy)
        .then(() => {
          console.log('Ссылка скопирована в буфер обмена!'); 
        })
        .catch(err => {
          console.error('Ошибка при копировании: ', err);
        });
    };

return <div className={`${style.post_box}`}>
<Link to={`posts/${parentPostID}`} className={`${style.comm_box}`}>
   <div className={`${style.img_comm_box}`}>
   <img src={commSvg} alt="" className={`${style.comm_img}`} />
   </div>
   <div className={`${style.comm_count}`}>{comments}</div>
</Link>


<div className={`${style.comm_box} ${style.comm_box_2}`}>
   <div onClick={(e)=>{handleShareClick(e)}}  className={`${style.img_comm_box}`}>
   <Tooltip title={copyMessage ? "Copy" : null}>  
   <img src={shareSvg} alt="" className={`${style.comm_img}`} />
   </Tooltip>
   </div>
</div>


<Link to={`posts/${parentPostID}`} className={`${style.vues_box}`}>
   <img src={vuesSvg} alt="" className={`${style.vues_img}`} />
   <div className={`${style.vues_count}`}>{vues}</div>
</Link>
<Link to={`posts/${parentPostID}`} className={`${style.stars_box}`}>
   <img src={starSvg} alt="" className={`${style.star_image}`} />
   <div className={`${style.star_count}`}>{stars}</div>
</Link>
</div>
}
export default PostFooterMain