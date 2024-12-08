import React from 'react';
import logo from './logo.svg';
import './App.scss';
import { Link, Outlet, Route, Routes } from 'react-router-dom';
import Header from '../../Header/Header';
import NotFoundPage from '../NotFound/NotFound';
import ContentBox from '../../ContentBox/ContentBox';
import MainContentBox from '../../MainContentBox/MainContentBox';
import Card from '../../Card/Card';
import defIm1 from '../../../images/post_big_1.jpg'
import defIm2 from '../../../images/post_big_2.jpg'
import defIm3 from '../../../images/pexels-anhdanghihi-16445771.jpg'
const ContentWrapper = () => {
  return <div className='content_box'><Outlet /></div>;
};
function App() {
  return (
    <>
    <Header/>
    <div className="container__global">
    <Routes>
          <Route path="/" element={<ContentBox />}>
            <Route index element={<><MainContentBox /></>} />
            <Route path='/3' element={<><Link style={{flexGrow:"3.95"}} to="1">hi3</Link></>} />
            <Route path='/create' element={<><Link style={{flexGrow:"3.95"}} to="1">create</Link></>} />
            <Route path='/messages' element={<><Link style={{flexGrow:"3.95"}} to="1">message</Link></>} />
            <Route path='/saved' element={<><Link style={{flexGrow:"3.95"}} to="1">saved</Link></>} />
            <Route path='/pomodoro' element={<><Link style={{flexGrow:"3.95"}} to="1">pomodoro</Link></>} />
            <Route path='/games' element={<><Link style={{flexGrow:"3.95"}} to="1">lorem*30</Link></>} />
            <Route path='/rand' element={<><Link style={{flexGrow:"3.95"}} to="1">rand</Link><Link style={{flexGrow:"1.7"}} to="1">pomodoro</Link></>} />
          </Route>


          <Route path="*" element={<NotFoundPage />} />
        </Routes>
    </div>
    </>
  );
}

export default App;
