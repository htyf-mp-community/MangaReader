# MangaReader HTYF migration checklist

Source baseline: `4ea8b7e1ac0163e3006e9509268ed434435a9ced` (`master`).

- [x] Eight React Navigation screens and route parameters migrated.
- [x] Fourteen manga source plugins registered; COPY remains the default source.
- [x] Discovery, search, detail, chapter list and reader data flows migrated.
- [x] Favorites, batch updates, downloads, export, backup and restore migrated.
- [x] Assets copied and production bundles include application GIF assets.
- [x] Cookie/WebView authentication flow migrated to `react-native-nitro-cookies`.
- [x] Persistent Redux data uses the explicit `manga-reader-storage` MMKV namespace.
- [x] AsyncStorage removed from runtime and dependencies.
- [x] Native-window modals replaced with the in-tree `InTreeDialog` implementation.
- [x] HTYF capsule coordinates normalized and applied only to intersecting header content.
- [x] React Native and build tooling aligned to 0.86.3.
- [x] TypeScript, Jest, ESLint, iOS bundle and Android bundle verification completed.

External manga websites, authentication challenges and regional access still require ordinary
device smoke testing before publishing because their responses depend on account, proxy,
Cloudflare and current site availability.
