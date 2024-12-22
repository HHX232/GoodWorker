import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IUser } from "../../interfaces/interfaces"
import { fetchUsers } from "./ActionCreators";

interface UserState{
   users:IUser[];
   isLoading:boolean;
   error:string;
   count:number;
}

const initialState: UserState = {
users: [],
isLoading: false,
error: "",
count:0,
}

export const userSlice = createSlice({
   name:'user',
   initialState,
   reducers:{
      userFetching(state){
         state.isLoading = true;
      },
      userFetchingSuccess(state,action:PayloadAction<IUser[]>){
         state.isLoading = false;
         state.error = '';
         state.users = action.payload;
      },
      userFetchingError(state,action:PayloadAction<string>){
         state.isLoading = false;
         state.error = action.payload;
      }
   },
   
   extraReducers: (builder) => {
      builder
         .addCase(fetchUsers.fulfilled, (state, action: PayloadAction<IUser []>) => {
            state.isLoading = false;
            state.error = '';
            state.users = action.payload;
         })
         .addCase(fetchUsers.pending, (state) => {
            state.isLoading = true;
         })
         .addCase(fetchUsers.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.error.message || 'Failed to fetch users';
         });
   }
})

export default userSlice.reducer;