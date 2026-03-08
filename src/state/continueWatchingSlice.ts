import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ContinueWatchingEntry {
  malId: number;
  anilistId?: number;
  title: string;
  coverImage: string;
  episodeNumber: number;
  episodeId?: string;
  lastWatchedAt: number;
  /** Resume position in seconds for this episode */
  progressSeconds?: number;
}

interface ContinueWatchingState {
  entries: ContinueWatchingEntry[];
  maxEntries: number;
}

const initialState: ContinueWatchingState = {
  entries: [],
  maxEntries: 20,
};

const continueWatchingSlice = createSlice({
  name: 'continueWatching',
  initialState,
  reducers: {
    upsertContinueWatching: (state, action: PayloadAction<ContinueWatchingEntry>) => {
      const entry = action.payload;
      state.entries = state.entries.filter((e) => e.malId !== entry.malId);
      state.entries.unshift(entry);
      state.entries = state.entries.slice(0, state.maxEntries);
    },
    removeContinueWatching: (state, action: PayloadAction<number>) => {
      state.entries = state.entries.filter((e) => e.malId !== action.payload);
    },
    clearContinueWatching: (state) => {
      state.entries = [];
    },
  },
});

export const {
  upsertContinueWatching,
  removeContinueWatching,
  clearContinueWatching,
} = continueWatchingSlice.actions;
export default continueWatchingSlice.reducer;
