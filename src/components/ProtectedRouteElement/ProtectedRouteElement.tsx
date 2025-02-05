import React, { useEffect, useState, FC } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { getCookie } from '../cookies/cookies';

interface IProtectedRouteElement{
    children: React.ReactNode;
}
const ProtectedRouteElement: FC<IProtectedRouteElement> = ({ children }) => {
    const location = useLocation();
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const refreshToken = getCookie('refreshToken');
    const accessToken = getCookie('accessToken');

    useEffect(() => {
        const verifyAccess = async () => {
            if (refreshToken && !accessToken) {
                try {
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

        verifyAccess();
    }, [refreshToken, accessToken]);

    if (isChecking) {
        return <p>Loading...</p>
    }

    if (!refreshToken) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (isAuthenticated) {
        return <>{children}</>;
    } else {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
};

export default ProtectedRouteElement;
