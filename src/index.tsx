import '@/utils/define';
import { BackHandler, LogBox } from 'react-native';
import { CacheManager } from '@georstat/react-native-image-cache';
import { Dirs } from 'react-native-file-access';
import jssdk from '@htyf-mp/js-sdk';
import { useEffect } from 'react';
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

export default () => {
  useEffect(() => {
    const tryShowInterstitialAd = async () => {
      const INTERSTITIAL_AD_STORAGE_KEY = 'interstitial_ad_last_shown_at';
      /** 冷却时间（毫秒），此时间内只调用一次 showInterstitialAd */
      const INTERSTITIAL_AD_COOLDOWN_MS = 8 * 60 * 1000;
      const storage = jssdk.getStorage();
      const lastShownRaw = await storage.getItem(INTERSTITIAL_AD_STORAGE_KEY);
      const now = Date.now();
      const lastShown = lastShownRaw ? Number(lastShownRaw) : 0;

      if (lastShown && now - lastShown < INTERSTITIAL_AD_COOLDOWN_MS) {
        return;
      }

      await storage.setItem(INTERSTITIAL_AD_STORAGE_KEY, String(now));
      jssdk.showInterstitialAd({
        onOpen: () => {
          console.log('onOpen');
        },
        onClose: () => {
          console.log('onClose');
        },
      });
    };

    tryShowInterstitialAd();
  }, []);
  return <App />;
}

