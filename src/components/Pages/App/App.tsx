import React from 'react';
import './App.scss';

import { Link, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Header from '../../Header/Header';
import NotFoundPage from '../NotFound/NotFound';
import ContentBox from '../../ContentBox/ContentBox';
import MainContentBox from '../../MainContentBox/MainContentBox';
import Card from '../../Card/Card';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { userSlice } from '../../../services/reducers/UserSlice';
import { postAPI } from '../../../services/PostService';
import MobileBottomMenu from '../../MobileBottomMenu/MobileBottomMenu';
import FullPost from '../../FullPost/FullPost';


// const PostContainer = ()=>{

//   //автоматически генерируется хук
//   const {data:posts, error, isLoading} = postAPI.useFetchAllPostsQuery(10)
//   return (
//     <div >
//       {isLoading ?  <p style={{color:"red"}}>HELLO</p> : ""}
//      {posts?.map((el)=>
//       {console.log(el)
//       return <p>{el.title}</p>}
//      )}
//     </div>
//   );
// }
function App() {

const data = useAppSelector(state => state.userReducer)

// const {count} = useAppSelector(state => state.userReducer)
// const dispatch = useAppDispatch()
const location = useLocation();
const regex = /^\/posts\/\d+$/;

  return (
    <>
    <Header/>
    <MobileBottomMenu/>
    <div className={`container__global ${regex.test(location.pathname) ? "fullPostGLoabal" : ""}`}>
    <Routes>
          <Route path="/" element={<ContentBox />}>
            <Route index element={<><MainContentBox /></>} />
            <Route path='/3' element={<><Link style={{flexGrow:"3.95"}} to="1">hi3</Link></>} />
            <Route path='/create' element={<></>} />
            <Route path='/messages' element={<><Link style={{flexGrow:"3.95"}} to="1">message</Link></>} />
            <Route path='/saved' element={<><Link style={{flexGrow:"3.95"}} to="1">saved</Link></>} />
            <Route path='/pomodoro' element={<><Link style={{flexGrow:"3.95"}} to="1">pomodoro</Link></>} />
            <Route path='/games' element={<><Link style={{flexGrow:"3.95"}} to="1">lorem*30</Link></>} />
            <Route path='/rand' element={<><Link style={{flexGrow:"3.95"}} to="1">rand</Link><Link style={{flexGrow:"1.7"}} to="1">pomodoro</Link></>} />
            <Route path="/posts/:id" element={<FullPost/>} />
          </Route>


          <Route path="*" element={<NotFoundPage />} />
        </Routes>
    </div>
    </>
  );
}

export default App;
