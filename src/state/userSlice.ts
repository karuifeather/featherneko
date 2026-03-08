import { createSlice } from '@reduxjs/toolkit';

interface UserState {
  isAuthenticated: boolean;
}

const initialState: UserState = {
  isAuthenticated: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    authenticate: (state) => {
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.isAuthenticated = false;
    },
  },
});

export const { authenticate, logout } = userSlice.actions;
export default userSlice.reducer;
