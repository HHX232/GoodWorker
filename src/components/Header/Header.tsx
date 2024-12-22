import React, { FC, memo, useEffect, useState } from "react";
import style from './Header.module.scss'
import big_main_logo_png from '../../images/logos/Logo-GoodWorker.png'
import big_main_logo_svg from '../../images/logos/Logo-GoodWorker.svg'
import mobile_logo_png from '../../images/logos/MobileLogo.png'
import mobile_logo_svg from '../../images/logos/MobileLogo.svg'
import searchSVG from '../../images/svg/search.svg'
import arrow from '../../images/svg/arrow.svg'
import messageSvg from '../../images/svg/colocol.svg'
import  stub1 from '../../images/stubs/stub-1.jpg'
import  stub2 from '../../images/stubs/stub-2.jpg'
import  stub3 from '../../images/stubs/stub-3.jpg'
import  stub4 from '../../images/stubs/stub-4.jpg'
import { Link, useSearchParams } from "react-router-dom";
import { SkeletonHeader } from "../skeletons/HeaderSkeleton/HeaderSkeleton";
import Burgermenu from "../BurgerMenu/BurgerMenu";

type TFilter = "All posts" | "Several" | "IT" | "Files" | "Литература" | "Развлечение" 
const FiltersList: FC = () =>{
   const [activeFilters, setActiveFilters] = useState<TFilter[]>([]);
   const [active, setActive] = useState(false)
   const [searchParams, setSearchParams] = useSearchParams()
   

 

   const onPrevClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); 
    setActive(!active);
};

   useEffect(() => {
    const handleClick = () => {
        setActive(false);
    };

    if (active) {
        window.addEventListener('click', handleClick);
    } else {
        window.removeEventListener('click', handleClick);
    }
console.log("message")
    return () => {
        window.removeEventListener('click', handleClick);
    };
}, [active]);

const toggleFilter = (filter: TFilter, event: React.MouseEvent<HTMLLIElement>) => {
    event.stopPropagation(); // Останавливаем всплытие события
    setActiveFilters(prevFilters => {
        if (filter === "All posts") {
            return [];
        }
        if (prevFilters.includes(filter)) {
            return prevFilters.filter(f => f !== filter);
        } else {
            return [...prevFilters, filter];
        }
    });
};

  useEffect(() => {
   const filtersParam = searchParams.get('filters');
   if (filtersParam) {
       const params: TFilter[] = filtersParam.split(',') as TFilter[];
       setActiveFilters(params);
   } else {
       setActiveFilters([]); 
   }
}, []); 


useEffect(() => {
   const currentFilters = activeFilters.length === 0 ? [] : activeFilters;
   const filtersString = currentFilters.join(',');
   const currentFiltersInParams = searchParams.get('filters');

   if (currentFiltersInParams !== filtersString) {
       setSearchParams({ filters: filtersString });
   }
}, [activeFilters]);


  const getCurrentFilterText = (): TFilter => {
   if (activeFilters.length === 0) {
       return "All posts";
   }
   if(activeFilters.length === 1){
       return activeFilters[0];
   }
   return "Several";
};

return (
   <div className={`${style.tags__list_box}`}>
       <button onClick={onPrevClick} className={`${style.tags__prev}`}>
           <p className={`${style.tags__prev_text}`}>{getCurrentFilterText()}</p>
           <img className={`${style.arrow_img}  ${ active ? style.arrow_img_active : ""} `} src={arrow} alt="arrow" />
       </button>
       <ul className={`${style.tags__list} ${!active ? "none" : ""}`}>
       <li
                   key={"All posts"}
                   className={`${style.tags__list_item} ${activeFilters.length === 0 ? style.tags__list_item__active : ""} ${activeFilters.includes("All posts") ? style.tags__list_item__active : ""}`}
                   onClick={(event) => toggleFilter("All posts" as TFilter, event)}
               >
                   {"All posts"}
               </li>

           {["IT", "Files","Литература", "Развлечение"].map(filter => (
               <li
                   key={filter}
                   className={`${style.tags__list_item} ${activeFilters.includes(filter as TFilter) ? style.tags__list_item__active : ""}`}
                   onClick={(event) => toggleFilter(filter as TFilter, event)}
               >
                   {filter}
               </li>
           ))}
       </ul>
   </div>
);
}




const allStubs = [stub1, stub2, stub3, stub4]
const UserDataBox = memo(({ userName, userMail, userImage }: { userName: string, userMail: string, userImage: string }) => {
   return (
       <div className={`${style.user__data_box}`}>
           <div className={`${style.user_text_box}`}>
               <p className={`${style.user_name}`}>{userName}</p>
               <p className={`${style.user_mail}`}>{userMail}</p>
           </div>
           <img className={`${style.user_image}`} src={userImage ? userImage : allStubs[Math.floor(Math.random() * 4)]} alt="User  Avatar" />
       </div>
   );
});


export const SearchForm = memo(({dopStyle, filterText, onInputChange, onSubmit }: { dopStyle?:any, filterText: string, onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void, onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) => {
   return (
       <form style={dopStyle} className={`${style.form_box}`} role="search" method="get" onSubmit={onSubmit}>
           <label className={`${style.header_label}`} htmlFor="search-text">
               <img className={`${style.input_image}`} src={searchSVG} alt="" />
           </label>
           <input
               value={filterText}
               onChange={onInputChange}
               className={`${style.header_input}`}
               type="text"
               name="filterText"
               placeholder={`Search for communities, files, or post`}
               id="search-text"
           />
           <button type="submit" className={`${style.header_button_submit} ${filterText !== "" ? style.header_button_submit_active : ""}`}>
               поиск
           </button>
       </form>
   );
});


const Colocol = ({CountNumber = ""}:{CountNumber: number | string | null}) =>{
const [boolMessage, setBoolMessage] = useState(true);


   return <div className={`${style.image__box}`}>
   <img className={`${style.colocol}`} src={messageSvg} alt="" />
   <div className={`${style.number_box}`}>

   {boolMessage ? <div className={`${style.redPoint}`}></div> : ""}
   </div>
 </div>
}


const Header = () => {
   const [filterText, setFilterText] = useState('');
   const [loading, setLoading] = useState(false); // Флаг загрузки

   //  useEffect(() => {
   //      // Симуляция загрузки данных
   //      const timer = setTimeout(() => {
   //          setLoading(false);
   //      }, 2000); // Задержка 2 секунды для имитации загрузки

   //      return () => clearTimeout(timer);
   //  }, []);

   const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
       setFilterText(event.target.value); 
       console.log(filterText)
   };

   const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
       event.preventDefault(); 
       console.log('Search term:', filterText);
   };


   return (
      <div className={`${style.header_bg}`}>
       <header className={`${style.header} container__global`}>
         {loading ? (
                    <SkeletonHeader />
                ) : 
           (<>
           {/* <Burgermenu /> */}
               <Link to="/">
           <picture>

           <source
    media="(max-width: 1300px)"
    type="image/svg+xml"
    srcSet={mobile_logo_svg}
  />
  <source
    media="(max-width: 1300px)"
    srcSet={mobile_logo_png}
  /> 
  <source
    type="image/svg+xml"
    srcSet={big_main_logo_svg}
  />
  <img
    className={style.main_logo}
    src={big_main_logo_png}
    alt="Good Worker Logo png"
  />
               </picture>
               </Link>

               <div className={`${style.search__box}`}>
                   <SearchForm filterText={filterText} onInputChange={handleInputChange} onSubmit={handleSubmit} />
                   {/* <FiltersList/> */}
               </div>
               <div className={`${style.user__box}`}>
                <Colocol CountNumber={""}/>
                <div className={`${style.user__box}`}>
                  <UserDataBox userImage={""} userMail={"@ekaterina"} userName={"Ekaterina Ivanova"}/>
                </div>
               </div></>)
               }

       </header>
       </div>
   );
};
export default Header