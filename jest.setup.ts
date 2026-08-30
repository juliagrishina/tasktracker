import '@testing-library/react-native';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'test-publishable-key';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
