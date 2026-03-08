/**
 * One-time migration: copy anitoer_* AsyncStorage keys to featherneko_*.
 * Ensures existing users keep their data when renaming storage prefixes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATED_FLAG = 'featherneko_keys_migrated_from_anitoer';

export async function migrateAnitoerKeysIfNeeded(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATED_FLAG);
    if (done === '1') return;

    const keys = await AsyncStorage.getAllKeys();
    const toMigrate = keys.filter((k) => k.startsWith('anitoer_'));
    if (toMigrate.length === 0) {
      await AsyncStorage.setItem(MIGRATED_FLAG, '1');
      return;
    }

    for (const oldKey of toMigrate) {
      const value = await AsyncStorage.getItem(oldKey);
      if (value == null) continue;
      const newKey = 'featherneko_' + oldKey.slice(7); // anitoer_ -> featherneko_
      await AsyncStorage.setItem(newKey, value);
      await AsyncStorage.removeItem(oldKey);
    }
    await AsyncStorage.setItem(MIGRATED_FLAG, '1');
  } catch {
    /* ignore */
  }
}
