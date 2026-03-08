import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { authenticate } from '@/state/userSlice';
import bcrypt from 'bcryptjs';
import { PASSWORD_HASH as PASSWORD_HASH_RAW } from '@env';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import Logo from '@/components/logo';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faEye, faEyeSlash, faLock } from '@fortawesome/free-solid-svg-icons';
import BrandButton from '@/components/ui/brand-button';
import { BRAND } from '@/constants/colors';

const AuthPage = () => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bg, cardBg, text, subtext, hex, border } = useThemeColors();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    setError(null);
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Enter your password.');
      return;
    }
    const PASSWORD_HASH = PASSWORD_HASH_RAW?.replace(/\\\$/g, '$');
    if (!PASSWORD_HASH) {
      setError('App not configured. Set PASSWORD_HASH in .env.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const isMatch = await bcrypt.compare(trimmed, PASSWORD_HASH);
      if (isMatch) {
        dispatch(authenticate());
        router.replace('/home');
      } else {
        setError('Wrong password. Try again.');
      }
    } catch (e) {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={insets.top}
      className={`flex-1 ${bg}`}
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingBottom: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-12">
          <View className="mb-4">
            <Logo width={140} color={BRAND.primary} />
          </View>
          <Text className={`${text} text-2xl font-bold text-center`}>
            Sign in
          </Text>
          <Text className={`${subtext} text-base text-center mt-2 max-w-[260px]`}>
            Enter your app password to continue.{'\n'}Need a password? Contact karuifeather.com.
          </Text>
        </View>

        <View className={`rounded-2xl p-6 ${cardBg}`} style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginHorizontal: 4 }}>
          <Text className={`${subtext} text-sm font-medium mb-2`}>Password</Text>
          <View className={`flex-row items-center rounded-xl overflow-hidden border ${border}`} style={{ backgroundColor: hex.inputBg }}>
            <View className="pl-4 flex-row items-center flex-1">
              <FontAwesomeIcon icon={faLock} size={16} color={hex.subtext} />
              <TextInput
                ref={inputRef}
                className="flex-1 py-3.5 px-3 text-base"
                style={{ color: hex.text }}
                placeholder="Enter password"
                placeholderTextColor={hex.subtext}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) setError(null);
                }}
                editable={!loading}
                onSubmitEditing={handleLogin}
              />
            </View>
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              className="pr-4 py-3"
              hitSlop={12}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <FontAwesomeIcon
                icon={showPassword ? faEyeSlash : faEye}
                size={20}
                color={hex.subtext}
              />
            </Pressable>
          </View>

          {error ? (
            <Text className="text-red-500 text-sm mt-2">{error}</Text>
          ) : null}

          <View className="mt-5">
            <BrandButton
              label="Sign in"
              onPress={handleLogin}
              loading={loading}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AuthPage;
