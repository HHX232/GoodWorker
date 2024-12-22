import { IUSer } from "../models/IUser";
import { AppDispatch } from "../store"
import axios from 'axios'; // Import axios
import { userSlice } from "./UserSlice";
import { IUser } from "../../interfaces/interfaces";
import { createAsyncThunk } from "@reduxjs/toolkit";

// export const fetchUsers = ()=> async (dispatch: AppDispatch) =>{
//    try{
//       dispatch(userSlice.actions.userFetching())
//       const response = await axios.get<IUser[]>('https://jsonplaceholder.typicode.com/users')
//       dispatch(userSlice.actions.userFetchingSuccess(response.data))
//    }catch(err:any){
//       dispatch(userSlice.actions.userFetchingError(err.message))
//    }
// }

export const fetchUsers = createAsyncThunk('user/fetchAll',
   async (_:any, thunkAPI) => {
      try{
         const response = await axios.get<IUser[]>('https://jsonplaceholder.typicode.com/users')
         return response.data
      }catch(e:any){
         return thunkAPI.rejectWithValue("не удалось получить посты" + e.message)
      }
     
   }
)