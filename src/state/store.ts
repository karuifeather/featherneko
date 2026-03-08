import { configureStore } from '@reduxjs/toolkit';
import { createTransform, persistReducer, persistStore } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import rootReducer from './rootReducer';

function sanitizeEntries(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e: unknown) => {
    const x = e as { malId?: unknown; title?: unknown; episodeNumber?: unknown; coverImage?: unknown };
    const malId = x.malId;
    const validMalId =
      typeof malId === 'number' && Number.isFinite(malId) && malId > 0;
    return (
      e &&
      validMalId &&
      x.title &&
      typeof x.episodeNumber === 'number' &&
      (x.coverImage == null || typeof x.coverImage === 'string')
    );
  });
}

/** Sanitize continueWatching on persist and rehydration; prevents corrupted data in production */
const sanitizeContinueWatchingTransform = createTransform(
  (state: unknown) => {
    if (!state || typeof state !== 'object') return state;
    const s = state as { entries?: unknown; maxEntries?: number };
    const entries = sanitizeEntries(s.entries);
    return { ...s, entries };
  },
  (state: unknown) => {
    if (!state || typeof state !== 'object') return state;
    const s = state as { entries?: unknown; maxEntries?: number };
    const entries = sanitizeEntries(s.entries);
    return { ...s, entries };
  },
  { whitelist: ['continueWatching'] }
);

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  transforms: [sanitizeContinueWatchingTransform],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }),
});

export const persistor = persistStore(store);
export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
