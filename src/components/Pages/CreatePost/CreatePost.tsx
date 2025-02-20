import { Editor, EditorTextChangeEvent } from "primereact/editor";
import { FC, useRef, useState } from 'react';
import request from '../../../utils/request';
import { getCookie } from '../../cookies/cookies';
import style from './CreatePost.module.scss';
import { Toast } from 'primereact/toast';
const CreatePost: FC = () => {
   const [text, setText] = useState<string>('');
   const accessToken = getCookie('accessToken');

   const h1Regex = /<h1[^>]*>(?:<[^>]+>)*([^<]+)(?:<\/[^>]+>)*<\/h1>/;
   const h2Regex = /<h2[^>]*>(?:<[^>]+>)*([^<]+)(?:<\/[^>]+>)*<\/h2>/;
 
   const h1Match = text.match(h1Regex);
   const h2Match = text.match(h2Regex);
 
   const h1Content = h1Match ? h1Match[1].trim() : ''; 
   const h2Content = h2Match ? h2Match[1].trim() : '';

  const toast = useRef<Toast>(null);

  const showSuccess = () => {
    toast.current?.show({
      severity: 'success',
      summary: 'Congratulations',
      detail: 'Post successfully created!',
      life: 2500,
    });
  };

  const showError = () => {
    toast?.current?.show({severity:'error', summary: 'Error', detail:`Create Post Failed: \n Should be Title and Subtitle`, life: 6000});
}
  const showCustomError = (e:string) => {
    toast?.current?.show({severity:'error', summary: 'Error', detail:`Create Post Failed: \n ${e}`, life: 6000});
}

   const onCreatePost = async () =>{
      // console.log("h1Content", h1Content, "h2Content",h2Content);
      try{
         //Потом добавить проверку
        const data:any = await fetch('https://good-worker-ai.onrender.com/bun_word',{
            method: 'POST',
            headers: {
               'Content-Type': 'application/json'
            },
            body: JSON.stringify({text: text})
         })

         if(!data.ok){
            showCustomError(`Исправьте ошибки: \n ${data.bad_sentense.map((el:string)=> `\n ${el}`)}`)
            return
         }
         
      await request('posts',{
         method: 'POST',
         body: {
            body: text,
            title: h1Content,
            subtitle: h2Content
         },
         headers: {
            'Authorization': `Bearer ${accessToken}`
         }
      })
      showSuccess()
   }catch(e){
      console.error(e)
      showError()
   }
   }
   return (
    <div className={`${style.editor_box}`}>
              <Toast ref={toast} />
                  <Editor value={text} onTextChange={(e: EditorTextChangeEvent) => {setText(e.htmlValue ? e.htmlValue : ""); console.log(text)}} className={`${style.editor}`} />
                     <button onClick={onCreatePost} className={`${style.editor_button}`}>Create post</button>
    </div>
  )
}

export default CreatePost