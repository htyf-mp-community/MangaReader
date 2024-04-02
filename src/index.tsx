import '~/utils/define';
import { AppRegistry, LogBox } from 'react-native';
import { CacheManager } from '@georstat/react-native-image-cache';
import { Dirs } from 'react-native-file-access';
import App from './App';
import * as packageJson from '../package.json';

process.env.NAME = packageJson.name;
process.env.VERSION = 'v' + packageJson.version;
process.env.PUBLISH_TIME = packageJson.publishTime;
console.log(Dirs)

CacheManager.config = {
  baseDir: `${Dirs?.CacheDir}/images_cache/`,
  cacheLimit: 0,
  sourceAnimationDuration: 500,
  thumbnailAnimationDuration: 500,
};

LogBox.ignoreLogs(['Require cycle:', 'Remote debugger']);

export default App;

