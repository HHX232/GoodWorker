import { useLocation, useNavigate, useParams } from 'react-router-dom'
import style from './ModalBox.module.scss'
import { FC, useEffect } from 'react';
import ReactDOM from "react-dom";
import postAPI from '../../services/PostService';
import { ICustomPost } from '../../interfaces/interfaces';

const ModalHeader = ({onClose}: {onClose: () => void}) =>{
   const location = useLocation();
   const isCommentsPath = /posts\/\d+\/comments/.test(location.pathname);


   const paramsUrl = useParams().id;
   const stringPostId: string | undefined = (paramsUrl && paramsUrl.toString())
   const { data: post, error, isLoading } = postAPI.useFetchPostByIdQuery(stringPostId ? stringPostId : "");
   const postComments = post?.comments ;

   return <div className={style.modal_header}>
      <h4 className={style.modal_header_title}>{`Comments (${postComments?.length})`}</h4>
      <button className={style.modal_header_close} onClick={onClose}></button>
   </div>
}

interface IModalOverlayProps {
   children: React.ReactNode;
   onClose: () => void;
}

const ModalOverlay:FC<IModalOverlayProps> = ({children, onClose}) =>{

   const onOverlayClick = (e:React.MouseEvent<HTMLDivElement, MouseEvent>) =>{
   if(e.target === e.currentTarget){
      onClose();
      console.log("CLOSE")
   }
   }
   return <div className={style.modal_overlay_back} onClick={onOverlayClick}>
      <div className={`${style.modal_overlay}`}>
         {children}
      </div>
   </div>
}

interface IModalBoxProps {
   onClose: () => void;
   children: React.ReactNode;
}
const ModalBox:FC<IModalBoxProps> = ({onClose, children}) =>{
const navigate = useNavigate();

const modalRoot = document.getElementById('modal-root') ;

const handleKeyDown = (event: KeyboardEvent) => {
   if (event.key === 'Escape') {
      onClose();
   }
};
const handleOutsideClick = (event: MouseEvent) => {
   if (event.target === modalRoot) {
      onClose();
   }
};

//! для фуллкомментспэйдж



// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(()=>{
   if (modalRoot != null && modalRoot.childNodes.length > 1) {
      modalRoot.childNodes.forEach((elem, index) => {
        if (index !== 0) {
          elem.remove();
        }
      });
      return ;
    }
})

useEffect(()=>{
   document.addEventListener('keydown', handleKeyDown);
   document.addEventListener('click', handleOutsideClick);
   return ()=>{
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleOutsideClick);
   }
},[])

if (!modalRoot) throw new Error('modalRoot is null')

return ReactDOM.createPortal (
  <div className={`${style.modal}`}>
     <ModalOverlay onClose={onClose}>
      <ModalHeader onClose={onClose}/>
        {children}
     </ModalOverlay>
  </div>
, modalRoot )
}
export default ModalBox