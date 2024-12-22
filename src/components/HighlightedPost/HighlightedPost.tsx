import { FC, useEffect } from 'react';
import style from './HighlightedPost.module.scss';
import { IUser, IUserDefault } from '../../interfaces/interfaces';
import UserHeaderCard from '../UserHeaderCard/UserHeaderCard';
import { Link } from 'react-router-dom';

interface IHighlightedPost  {
   highLightTitle: string;
   defaultTitle: string;
   subtitle: string;
   backgroundImage: string | undefined;
   user:IUserDefault;
   cardId: string;
}

const HighlightedPost: FC<IHighlightedPost> = ({cardId,highLightTitle, defaultTitle, subtitle, backgroundImage, user}) => {

   return <Link to={`/posts/${cardId}`} style={{
      background: `
        linear-gradient(0.00deg, rgba(0, 0, 0, 0.5) 0%,rgba(38, 38, 38, 0.54) 34.434%,rgba(58, 58, 58, 0.15) 88.003%,rgba(58, 58, 58, 0) 92.611%),
        url(${backgroundImage})
      `,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }} className={`card_class`}>
      <h4 className={`${style.high_title}`}>{highLightTitle}</h4>
      <div className={`${style.box_for_user}`}>
      <UserHeaderCard userID={user.id.toString()} cardID={cardId} accentColor='FFFFFF' colorTitle="FFFFFF" BlurDots={true} blurBg={true} image={user.image} name={user.name ? user.name : ""} role={user.role} dateActivity={user.dateActivity ? user.dateActivity : ""}/>
      </div>
      <h5 className={`${style.card_title}`}>{defaultTitle}</h5>
      <p className={`${style.card_subtitle}`}>{subtitle}</p>
   </Link>
}
export default HighlightedPost