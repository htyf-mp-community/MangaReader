import { configureStore } from '@reduxjs/toolkit';
import { reducer } from './slice';
import createSagaMiddleware from 'redux-saga';
import saga from './saga';

const sagaMiddleware = createSagaMiddleware();

const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) => {
    const defaultMiddleware = getDefaultMiddleware({
      thunk: false, // 使用 saga 替代 thunk
    });

    // 开发模式下添加 logger
    if (__DEV__) {
      const { createLogger } = require('redux-logger');
      const logger = createLogger({
        collapsed: true,
        duration: true,
        timestamp: true,
        logErrors: true,
      });
      return defaultMiddleware.concat(sagaMiddleware, logger);
    }

    return defaultMiddleware.concat(sagaMiddleware);
  },
  devTools: __DEV__,
});

sagaMiddleware.run(saga);

export default store;
