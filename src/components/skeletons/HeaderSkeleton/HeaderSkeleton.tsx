import React from 'react';
import Skeleton from '@mui/material/Skeleton';
import style from '../../../components/Header/Header.module.scss'; 
export const SkeletonHeader = () => {
    return (
<>
                <Skeleton variant="rounded" width={190} height={40} className={style.big_main_logo} />
                <div className={`${style.search__box}`}>
                    <Skeleton variant="rounded" width="100%" height={45} className={style.header_input} />
                    <Skeleton variant="rounded" width={190} height={45} className={`${style.header_button_submit} ${style.header_button_submit_skeleton}`} />
                </div>
                <div className={`${style.user__box} `}>
                    <Skeleton variant="circular" width={38} height={38} className={style.user_image} />
                    <div className={`${style.user__data_box} ${style.user__data__skeleton}`}>
                        <Skeleton variant="text" width={130} height={22} className={style.user_name} />
                        <Skeleton variant="text" width={90} height={16} className={style.user_mail} />
                    </div>
                    <Skeleton variant="circular" width={47} height={47} className={style.colocol} />
                </div>
                </> 
      
    );
};
