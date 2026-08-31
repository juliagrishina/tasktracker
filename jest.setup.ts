import { cleanup } from '@testing-library/react-native';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const expoModules = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules;
if (expoModules !== undefined) expoModules.ExpoModulesCoreJSLogger = { addListener: jest.fn() };

afterEach(cleanup);
