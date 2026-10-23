# MangaReader HTYF migration checklist

Source baseline: `4ea8b7e1ac0163e3006e9509268ed434435a9ced` (`master`).

## JSON manga source v1 increment

- [x] Keep missing chapter pagination/image URLs empty instead of resolving them to the homepage.
- [x] Resolve chapter image and pagination links against the chapter request domain.
- [x] Settle timed-out source requests even when AbortController is unavailable.
- [x] Derive plugin membership from the live registry, preserving order/toggles without resurrecting unloaded sources; cover external-only and empty registries.

- [x] Define a MangaReader JSON source protocol without arbitrary JavaScript.
- [x] Implement CSS, JSONPath, URL-template and safe transformation primitives.
- [x] Register and order all fourteen built-in sources from a JSON manifest.
- [x] Retain explicit built-in extensions for signing, decryption and image transforms.
- [x] Persist user JSON imports in MMKV and register them without restarting.
- [x] Execute declarative search, discovery, detail, chapter-list and image rules.
- [x] Switch every BZM stage to actual JSON-rule execution, including multi-page chapters.
- [x] Switch NH discovery to JSON rules while preserving its built-in request headers.
- [x] Preserve the original metadata and disabled state for all fourteen source manifests.
- [ ] Add visual editing, remote subscription, batch export and step-by-step source debugging.

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
