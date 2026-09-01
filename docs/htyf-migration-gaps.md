# HTYF migration gaps

No feature currently requires deferred manual iOS or Android source changes.

The remaining release check is device-level smoke testing of external manga providers. This is
not a native implementation gap: availability varies by region, proxy, login state and
Cloudflare challenge. Verify search, detail, first chapter and first image for every enabled
provider on the intended release network.
