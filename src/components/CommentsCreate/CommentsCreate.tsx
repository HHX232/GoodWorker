import style from './CommentsCreate.module.scss';
import sendSvg from '../../images/svg/send.svg';
import addFileSvg from '../../images/svg/add_file.svg'
import { useEffect, useRef, useState } from 'react';
import graySvgSend from '../../images/svg/graySend.svg'
const CommentsCreate = () =>{
   const textareaRef = useRef<HTMLTextAreaElement | null>(null); 
   const formRef = useRef<null | HTMLFormElement>(null);
   const [text, setText] = useState('');

   const adjustHeight = () => {

      if (textareaRef.current) {
         textareaRef.current.style.height = 'auto'; 
         textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
      
   };
   const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
      adjustHeight();
   };

   useEffect(() => {
      adjustHeight(); 
   }, []);
   return <form ref={formRef} className={`${style.create_box}`}>
      <div className={`${style.input_box}`}>
      <img src={addFileSvg} alt="" className={`${style.add_img}`}/>
      <textarea ref={textareaRef} onInput={handleInputChange} placeholder='Wite your comment here' className={`${style.text_input}`} id="message" rows={1} style={{overflow:'hidden', resize:"none"}}></textarea>
      </div>
      {/* <img style={{ stroke: text ? '#141416' : 'gray' }} src={sendSvg} alt="" /> */}
      <svg className={`${style.send_img}`} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M21.0477 3.05293C18.8697 0.707363 2.48648 6.4532 2.50001 8.551C2.51535 10.9299 8.89809 11.6617 10.6672 12.1581C11.7311 12.4565 12.016 12.7625 12.2613 13.8781C13.3723 18.9305 13.9301 21.4435 15.2014 21.4996C17.2278 21.5892 23.1733 5.342 21.0477 3.05293Z" stroke={`${text ? "#141416" : "#868897"}`} stroke-width="1.5"/>
<path d="M11.5 12.5L15 9" stroke={`${text ? "#141416" : "#868897"}`} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

   </form>
}

export default CommentsCreate