import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum UserRoles {
   USER = 'User',
   ADMIN = 'Admin',
   TRUSTED_AUTHOR = 'TrustedAuthor'
}

interface DataUserState {
   avatar: string | null;
   name: string;
   email: string;
   role: UserRoles;
   registrationDate: string;
}

const initialState: DataUserState = {
   avatar: null,
   name: '',
   email: '',
   role: UserRoles.USER,
   registrationDate: ''
};

export const dataUserSlice = createSlice({
   name: 'dataUser',
   initialState,
   reducers: {
      setUserData(state, action: PayloadAction<DataUserState>) {
         state.avatar = action.payload.avatar;
         state.name = action.payload.name;
         state.email = action.payload.email;
         state.role = action.payload.role;
         state.registrationDate = action.payload.registrationDate;
      },
      clearUserData(state) {
         state.avatar = null;
         state.name = '';
         state.email = '';
         state.role = UserRoles.USER;
         state.registrationDate = '';
      }
   }
});

export const { setUserData, clearUserData } = dataUserSlice.actions;
export default dataUserSlice.reducer;