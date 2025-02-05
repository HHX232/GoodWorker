import style from './CommentsCreate.module.scss';
import sendSvg from '../../images/svg/send.svg';
import addFileSvg from '../../images/svg/add_file.svg'
import { useEffect, useRef, useState } from 'react';
import graySvgSend from '../../images/svg/graySend.svg';
import {v4 as uuid} from 'uuid';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { addCommImages, setComImagesError } from '../../services/reducers/CommentImages';
import { useLocation } from 'react-router-dom';

interface ICommentsCreate {
   inputWidth?: string;
   textSize?: string;
   addSvgSize?: string;
   sendSvgSize?: string;
   
}
const CommentsCreate = ({inputWidth="232px", textSize="15px", addSvgSize="25px", sendSvgSize="24px"}: ICommentsCreate) =>{

   const textareaRef = useRef<HTMLTextAreaElement | null>(null); 
   const formRef = useRef<null | HTMLFormElement>(null);
   const [text, setText] = useState('');
   const refImg = useRef<HTMLInputElement | null>(null);
   const [isLoading, setIsLoading] = useState(false);
   const [imagesArray, setImagesArray] = useState<string[]>([]);
   const dispatch = useAppDispatch();
   const images = useAppSelector((state)=>state.comImages.images)
   const location = useLocation()
   useEffect(()=>{
      console.log("imagesArray", imagesArray)
      try{
         if (imagesArray.length > 0) {
            dispatch(addCommImages(imagesArray[imagesArray.length - 1]));
         }
      }catch(e){
   dispatch (setComImagesError(true))
      }

   },[])

   useEffect(()=>{
      if(isLoading){
         console.log("isLoading...")
      }else{
         console.log("not isLoading...")
      }
   },[isLoading])


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

   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
   
      if (files) {
         const validImageTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif'];
         const maxFileSize = 4 * 1024 * 1024; // 4 MB
         const newImages: string[] = [];
   
         Array.from(files).forEach((file) => {
            if (!validImageTypes.includes(file.type)) {
               console.warn(`Unsupported file type: ${file.type}`);
               alert(`Unsupported file format: ${file.name}. Allowed formats are: PNG, JPG, SVG, GIF.`);
               return;
            }
   
            if (file.size > maxFileSize) {
               console.warn(`File size too large: ${file.size} bytes`);
               alert(`File "${file.name}" exceeds the size limit of 4 MB.`);
               return;
            }
   
            const imageUrl = URL.createObjectURL(file);
            newImages.push(imageUrl);
            dispatch(addCommImages(imageUrl)); 
         });
   
         setImagesArray((prev) => [...prev, ...newImages]);
      } else {
         console.log('No files selected');
      }
   };
   

   
   

   return <form ref={formRef} className={`${style.create_box}`}>
    
      <div style={{width:`${inputWidth}`}} className={`${style.input_box}`}>
         <label htmlFor="file" className={`${style.add_img_label}`}>
            <img style={{width:`${addSvgSize}`,  height:`${addSvgSize}`}} src={addFileSvg} alt="" className={`${style.add_img}`} />
         </label>
         <input
   className={`${style.file_input}`}
   onChange={handleFileChange}
   ref={refImg}
   type="file"
   id="file"
   multiple
   accept="image/*"
/>        

            <textarea style={{width:`${inputWidth}`, fontSize:`${textSize}`, overflow:'hidden', resize:"none", maxHeight:`${location.pathname.includes('comments') ? "220px" :"100px"}`}} ref={textareaRef} onInput={handleInputChange} placeholder='Wite your comment here' className={`${style.text_input}`} id="message" rows={1} ></textarea>
      </div>
      <svg className={`${style.send_img}`} width={sendSvgSize} height={sendSvgSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M21.0477 3.05293C18.8697 0.707363 2.48648 6.4532 2.50001 8.551C2.51535 10.9299 8.89809 11.6617 10.6672 12.1581C11.7311 12.4565 12.016 12.7625 12.2613 13.8781C13.3723 18.9305 13.9301 21.4435 15.2014 21.4996C17.2278 21.5892 23.1733 5.342 21.0477 3.05293Z" stroke={`${(text || images.length > 0) ? "#141416" : "#868897"}`} stroke-width="1.5"/>
<path d="M11.5 12.5L15 9" stroke={`${(text || images.length > 0) ? "#141416" : "#868897"}`} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

   </form>
}

export default CommentsCreate