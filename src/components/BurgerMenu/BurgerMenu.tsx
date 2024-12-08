import React from "react"
import style from './BurgerMenu.module.scss'
const BurgerIcon = ()=>{

   return <div className={`${style.burger_box}`}>
         <div className={`${style.burger_line}`}></div>
         <div className={`${style.burger_line}`}></div>
         <div className={`${style.burger_line}`}></div>
   </div>

}
const Burgermenu = () =>{

   return <><BurgerIcon/></>
}

export default Burgermenu