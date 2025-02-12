import React from "react";
import "./App.scss";

import {
  Link,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Header from "../../Header/Header";
import NotFoundPage from "../NotFound/NotFound";
import ContentBox from "../../ContentBox/ContentBox";
import MainContentBox from "../../MainContentBox/MainContentBox";
import Card from "../../Card/Card";
import { useAppDispatch, useAppSelector } from "../../../hooks/redux";
import { userSlice } from "../../../services/reducers/UserSlice";
import { postAPI } from "../../../services/PostService";
import MobileBottomMenu from "../../MobileBottomMenu/MobileBottomMenu";
import FullPost from "../../FullPost/FullPost";
import ModalBox from "../../ModalBox/ModalBox";
import FullCommentsPage from "../FullCommentsPage/FullCommentsPage";
import UnprotectedRouteElement from "../../UnprotectedRouteElement/UnprotectedRouteElement";
import SignUp from "../SignUp/SignUp";
import LoginPage from "../LoginPage/LoginPage";
import CreatePost from "../CreatePost/CreatePost";
import ProtectedRouteElement from "../../ProtectedRouteElement/ProtectedRouteElement";

function App() {
  const data = useAppSelector((state) => state.userReducer);

  const location = useLocation();
  const background = location.state && location.state.background;
  const regex = /^\/posts\/\d+$/;
  const navigate = useNavigate();

  const onModalClose = () => {
    navigate(-1);
    location.state.background = null;
  };
  return (
    <>
      <Header />
      <MobileBottomMenu />
      <div className={`overflow_box`}>
        <div
          className={`container__global ${
            regex.test(location.pathname) ? "fullPostGLoabal" : ""
          }`}
        >
          <Routes location={background || location}>
            <Route path="/" element={<ContentBox />}>
              <Route
                index
                element={
                  <>
                    <MainContentBox />
                  </>
                }
              />
              <Route path="/posts/:id" element={<FullPost />} />
              <Route
                path="/3"
                element={
                  <>
                    <Link style={{ flexGrow: "3.95" }} to="1">
                      hi3
                    </Link>
                  </>
                }
              />

             
              <Route path="/create" element={ <ProtectedRouteElement><CreatePost/> </ProtectedRouteElement>} />
             

              <Route
                path="/messages"
                element={
                  <>
                    <Link style={{ flexGrow: "3.95" }} to="1">
                      message
                    </Link>
                  </>
                }
              />
              <Route
                path="/saved"
                element={
                  <>
                    <Link style={{ flexGrow: "3.95" }} to="1">
                      saved
                    </Link>
                  </>
                }
              />
              <Route
                path="/pomodoro"
                element={
                  <>
                    <Link style={{ flexGrow: "3.95" }} to="1">
                      pomodoro
                    </Link>
                  </>
                }
              />
              <Route
                path="/games"
                element={
                  <>
                    <Link style={{ flexGrow: "3.95" }} to="1">
                      lorem*30
                    </Link>
                  </>
                }
              />
              <Route
                path="/rand"
                element={
                  <>
                    <Link style={{ flexGrow: "3.95" }} to="1">
                      rand
                    </Link>
                    <Link style={{ flexGrow: "1.7" }} to="1">
                      pomodoro
                    </Link>
                  </>
                }
              />
            </Route>
            <Route
              path="/signup"
              element={
                <UnprotectedRouteElement>
                  <SignUp />
                </UnprotectedRouteElement>
              }
            />
            <Route
              path="/login"
              element={
                <UnprotectedRouteElement>
                  <LoginPage />
                </UnprotectedRouteElement>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </div>
      {background && (
        <Routes>
          <Route
            path="/posts/:id/comments"
            element={
              <ModalBox
                onClose={onModalClose}
                children={<FullCommentsPage />}
              />
            }
          />
        </Routes>
      )}
    </>
  );
}

export default App;
