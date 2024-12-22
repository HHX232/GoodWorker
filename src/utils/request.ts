const BASE_URL = "https://goodworker.onrender.com/api/v1";

type RequestOptions = {
   method?: string; 
   headers?: Record<string, string>; 
   body?: any; 
 };
 
 async function request<T>(
   path: string,
   options: RequestOptions = {}
 ): Promise<T> {
  
   const url = `${BASE_URL}/${path}`;
 
   const defaultHeaders = {
     "Content-Type": "application/json",
   };
 
   try {
     const response = await fetch(url, {
       method: options.method || "GET", 
       headers: { ...defaultHeaders, ...options.headers }, 
       body: options.body ? JSON.stringify(options.body) : undefined, 
     });
 
     if (!response.ok) {
       throw new Error(`Ошибка: ${response.status} - ${response.statusText}`);
     }
 
     const data: T = await response.json();
     return data;
   } catch (error) {
     console.error("Ошибка при выполнении запроса:", error);
     throw error;
   }
 }
 
 export default request