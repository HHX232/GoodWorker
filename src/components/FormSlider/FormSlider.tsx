import style from "./FormSlider.module.scss";
import React, { useEffect, useRef, useState, FC } from 'react';
//@ts-ignore
import { useForm, SubmitHandler } from 'react-hook-form';
//@ts-ignore
import { Toast } from 'primereact/toast';
//@ts-ignore
import { InputText } from 'primereact/inputtext';
//@ts-ignore
import { Password } from 'primereact/password';
//@ts-ignore
import { Link } from 'react-router-dom';
//@ts-ignore
import request from '../../../utils/request';
import Slider from 'react-slick';
import stubImg from '../../images/stubs_4k/stub_2.jpg'
import stubImg2 from '../../images/stubs_4k/Rectangle 3.jpg'
import stubImg3 from '../../images/stubs_4k//stub_3.jpg'
import {v4 as uuid} from 'uuid';
import arrowRight from '../../images/svg/arrow_right.svg'
import arrowLeft from '../../images/svg/arrow_left.svg'

const ArrowLeft:FC<{ onClick?: () => void }> = ({ onClick }) => {
   return <div onClick={onClick} className={`${style.arrow_left_box}`}>
     <img src={arrowLeft} className={`${style.arrow_image}`} alt='arrow left' />
   </div>;
 };
 
 const ArrowRight:FC<{ onClick?: () => void }> = ({ onClick }) => {
   return <div onClick={onClick} className={`${style.arrow_right_box}`}>
     <div className={`${style.pos_box}`}>
     <img src={arrowRight} className={`${style.arrow_image} ${style.arrow_image_pos}`} alt='arrow right' />
     </div>
   </div>;
 };
 interface ISliderItem {
   imageUrl: string;
   title: string;
   subtitle: string;
 }
 
 const SliderItem:React.FC<ISliderItem> = ({imageUrl, title, subtitle}) =>{

   return <li key={uuid()} className={`${style.slider_item_box}`}>
     <div className={`${style.image_box}`}>
     <img className={`${style.slider_image}`} src={imageUrl} alt={title} />
     <img className={`${style.slider_image} ${style.slider_image_blur}`} src={imageUrl} alt={title} />
     </div>
     
     <h2 className={`${style.slider_title}`}>{title}</h2>
     <p className={`${style.slider_subtitle}`}>{subtitle}</p>
   </li>
 }

 
const FormSlider = () => {
   const [settings, setSettings] = useState({
      infinite: true,
      speed: 500,
      slidesToShow: 1,
      slidesToScroll: 1,
      initialSlide:1,
      autoplay:true,
      autoplaySpeed:5000,
      prevArrow: <></>,
      nextArrow: <></>,
      draggable: true,
     swipe:true, 
    });

   return  <Slider className={`${style.swiper_box_form}`} {...settings} >
   <SliderItem imageUrl={stubImg} title="Make money with your templates!" subtitle="Get donations by publishing the best posts and templates" />
   <SliderItem imageUrl={stubImg2} title="Become a hero for millions!" subtitle="Students who need your knowledge" />
   <SliderItem imageUrl={stubImg3} title="Become a better writer!" subtitle="And your posts will rise to the top of the ratings" /> 
</Slider>

}
export default FormSlider