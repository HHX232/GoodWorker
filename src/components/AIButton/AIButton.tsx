import { FC } from 'react'
import style from './AIButton.module.scss'
import AIButtonSVG from '../../images/svg/AIButton.svg'
import { useParams } from 'react-router-dom'

const AIButton:FC = () => {

   const params = useParams()

   const onClick = () => {
      console.log(params);
   }
   return <div onClick={()=>{onClick()}} className={`${style.ai_button_box}`}>
       <img src={AIButtonSVG} className={`${style.ai_svg}`} alt="" />
      <p className={`${style.ai_text}`}>Get AI generated post summary </p>
   </div>
}
export default AIButton