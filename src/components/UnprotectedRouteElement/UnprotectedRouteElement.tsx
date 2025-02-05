import React, { FC, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { getCookie } from '../cookies/cookies';

interface IUnprotectedRouteElement {
    children: React.ReactNode;
}

const UnprotectedRouteElement: FC<IUnprotectedRouteElement> = ({ children }) => {
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const location = useLocation();
    const refreshToken = getCookie('refreshToken');
    const accessToken = getCookie('accessToken');

    useEffect(()=>{
        console.log(location);
        console.log(refreshToken)
        console.log(accessToken)
    },[])
    useEffect(() => {
        const verifyTokens = async () => {
            if (refreshToken && !accessToken) {
                try {
                    // await checkAndUpdateAccessToken();
                    setIsAuthenticated(true);
                } catch (error) {
                    console.error("Ошибка при обновлении accessToken:", error);
                    setIsAuthenticated(false);
                }
            } else if (refreshToken && accessToken) {
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
            setIsChecking(false);
        };

        verifyTokens();
    }, [refreshToken, accessToken]);

    if (isChecking) {
        return <p> Loading...</p>; 
    }

    
    if (isAuthenticated) {
        return <Navigate to={`${location.state && location.state.from ? location.state.from : "/"}`} replace />;
    }

   
    return <>{children}</>;
};

export default UnprotectedRouteElement;
