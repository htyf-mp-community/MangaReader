import '@/utils/define';
import { BackHandler, LogBox } from 'react-native';
import { CacheManager } from '@georstat/react-native-image-cache';
import { Dirs } from 'react-native-file-access';
import App from './App';
import packageJson from '../package.json';

// @ts-ignore
process.env.NAME = packageJson.name;
// @ts-ignore
process.env.VERSION = 'v' + packageJson.version;
// @ts-ignore
process.env.PUBLISH_TIME = packageJson.publishTime;
console.log(Dirs)

if (typeof (BackHandler as any).removeEventListener !== 'function') {
  // Compatibility shim for legacy libs still using removed RN API.
  (BackHandler as any).removeEventListener = (eventName: string, handler: () => boolean) => {
    const subscription = BackHandler.addEventListener(eventName as any, handler);
    subscription.remove();
  };
}

CacheManager.config = {
  blurRadius: 0,
  baseDir: `${Dirs?.CacheDir}/images_cache/`,
  cacheLimit: 0,
  sourceAnimationDuration: 500,
  thumbnailAnimationDuration: 500,
};

LogBox.ignoreLogs(['Require cycle:', 'Remote debugger']);

export default App;

