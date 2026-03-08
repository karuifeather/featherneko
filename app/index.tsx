import { useSelector } from 'react-redux';
import { Redirect } from 'expo-router';
import { RootState } from '@/state/store';
import './style.css';

export default function HomeScreen(): React.JSX.Element {
  const isAuthenticated = useSelector(
    (state: RootState) => state.user.isAuthenticated
  );

  if (isAuthenticated) {
    return <Redirect href={'/(root)/(tabs)/home'} />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
