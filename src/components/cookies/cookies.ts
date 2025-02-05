export function getCookie(name:string) {
   const cookies = document.cookie.split(";");
   for (let i = 0; i < cookies.length; i++) {
     const cookie = cookies[i].trim();
     if (cookie.startsWith(`${name}=`)) {
       return cookie.substring(name.length + 1);
     }
   }
   return null;
 }

 interface CookieOptions {
  expires?: Date | number | string;
  path?: string;
  secure?: boolean;
  samesite?: "lax" | "strict" | "none";
}

export const checkAndUpdateAccessToken = async () => {
  
};

export const setCookie = (name:string, value:string, options: CookieOptions = {}) => {
  options = {
    path: "/",
    secure: true,
    samesite: "strict",
    ...options,
  };

  if (options.expires instanceof Date) {
    options.expires = options.expires.toUTCString();
  }

  let updatedCookie =
    encodeURIComponent(name) + "=" + encodeURIComponent(value);

  for (let optionKey in options) {
    updatedCookie += "; " + optionKey;
    let optionValue = options[optionKey as keyof CookieOptions];
    if (optionValue !== true) {
      updatedCookie += "=" + optionValue;
    }
  }

  document.cookie = updatedCookie;
};

export const clearTokens = () => {
  setCookie("refreshToken", "", { expires: new Date(0) });
  setCookie("accessToken", "", { expires: new Date(0) });
};
