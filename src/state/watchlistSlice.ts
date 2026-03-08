import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface WatchlistItem {
  malId: number;
  anilistId?: number;
  title: string;
  coverImage: string;
  addedAt: number;
}

interface WatchlistState {
  items: WatchlistItem[];
}

const initialState: WatchlistState = {
  items: [],
};

const watchlistSlice = createSlice({
  name: 'watchlist',
  initialState,
  reducers: {
    addToWatchlist: (state, action: PayloadAction<WatchlistItem>) => {
      if (state.items.some((i) => i.malId === action.payload.malId)) return;
      state.items.unshift(action.payload);
    },
    removeFromWatchlist: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter((i) => i.malId !== action.payload);
    },
    clearWatchlist: (state) => {
      state.items = [];
    },
  },
});

export const { addToWatchlist, removeFromWatchlist, clearWatchlist } =
  watchlistSlice.actions;
export default watchlistSlice.reducer;
