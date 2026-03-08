import { combineReducers } from 'redux';
import animeReducer from './animeSlice';
import userReducer from './userSlice';
import watchlistReducer from './watchlistSlice';
import continueWatchingReducer from './continueWatchingSlice';
import watchHistoryReducer from './watchHistorySlice';
import settingsReducer from './settingsSlice';
import episodeProgressReducer from './episodeProgressSlice';

const rootReducer = combineReducers({
  anime: animeReducer,
  user: userReducer,
  watchlist: watchlistReducer,
  continueWatching: continueWatchingReducer,
  watchHistory: watchHistoryReducer,
  settings: settingsReducer,
  episodeProgress: episodeProgressReducer,
});

export default rootReducer;
