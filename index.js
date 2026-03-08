/**
 * Custom entry: set Android nav bar transparent before the app mounts.
 * Import order matters — this runs before expo-router/entry.
 */
import './navigation-bar-init';
import 'expo-router/entry';
