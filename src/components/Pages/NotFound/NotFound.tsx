import { Link } from 'react-router-dom'
import NotFound4 from '../../../images/404 Error with a cute animal-pana (1).svg'
import NotFound from '../../../images/404 error with a tired person-cuate.svg'
import style from './NotFound.module.scss'
const NotFoundPage = ()=>{
const imagesArray = [NotFound4, NotFound]
   return <div className={`${style.not_found_container}`}>
      <div className={`${style.not_found_box}`}>
         <img className={`${style.not_found_image}`} src={imagesArray[Math.floor(Math.random()*2)]} alt="" />
         <div className={`${style.not_found_links}`}>
            <p>Перейти на  <Link className={`${style.not_found_links_link}`} to="/"> главную страницу</Link> </p>
         </div>
      </div>
   </div>
}
export default NotFoundPage