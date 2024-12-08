import { FC } from 'react';
import style from './HighlightedPost.module.scss';
import { IUser } from '../../interfaces/interfaces';
import UserHeaderCard from '../UserHeaderCard/UserHeaderCard';

interface IHighlightedPost  {
   highLightTitle: string;
   defaultTitle: string;
   subtitle: string;
   backgroundImage: string | undefined;
   user:IUser;
}

const HighlightedPost: FC<IHighlightedPost> = ({highLightTitle, defaultTitle, subtitle, backgroundImage, user}) => {

   return <div style={{
      background: `
        linear-gradient(0.00deg, rgba(0, 0, 0, 0.5) 0%,rgba(38, 38, 38, 0.54) 34.434%,rgba(58, 58, 58, 0.15) 88.003%,rgba(58, 58, 58, 0) 92.611%),
        url(${backgroundImage})
      `,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }} className={`${style.card}`}>
      <h4 className={`${style.high_title}`}>{highLightTitle}</h4>
      <UserHeaderCard accentColor='FFFFFF' colorTitle="FFFFFF" BlurDots={true} blurBg={true} image={user.image} name={user.name} role={user.role} dateActivity={user.dateActivity}/>
      <h5 className={`${style.card_title}`}>{defaultTitle}</h5>
      <p className={`${style.card_subtitle}`}>{subtitle}</p>
   </div>
}
export default HighlightedPost