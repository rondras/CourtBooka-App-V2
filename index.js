/**
 * @format
 */
import 'react-native-gesture-handler'; // Must be at the very top
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { AuthProvider } from './src/context/AuthContext';

const Root = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

AppRegistry.registerComponent(appName, () => Root);