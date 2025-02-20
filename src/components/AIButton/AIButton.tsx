import { FC, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AIButtonSVG from '../../images/svg/AIButton.svg'
import request from '../../utils/request'
import style from './AIButton.module.scss'

const AIButton:FC = () => {

   const [postText, setPostText] = useState('')

   const {id} = useParams()

   const takeText = ()=>{
      request(`posts/${id}`).then((res :any)=>{
         // console.log("res", res);
         setPostText(res?.body ? res?.body : "")
      })
      
   }
   useEffect(()=>{
   takeText()
   },[id])

   const minifyText = async () =>{
      try{
      const data = await fetch('https://good-worker-ai.onrender.com/reduction_post',{
         method: 'POST',
         headers: {
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({text: postText})
      })
      console.log("data", data)
      return data
   }catch(e){
      console.error(e)
   }
     
   }
   const onClick = async () => {
     const data = await minifyText()
     console.log("data mini text", data)
   }
   
   return <div onClick={()=>{onClick()}} className={`${style.ai_button_box}`}>
       <img src={AIButtonSVG} className={`${style.ai_svg}`} alt="" />
      <p className={`${style.ai_text}`}>Get AI generated post summary </p>
   </div>
}
export default AIButton