# Wordamix for Android (Capacitor 8)

The game is unchanged web code; Capacitor wraps `www/` (a copy of index.html, js/, data/, icons/, manifest, sw.js) in a WebView.
All assets (including both dictionaries) ship inside the app, so it works fully offline.

## One-time setup (your computer)
- Node 20+, JDK 21, Android Studio (installs the Android SDK; accept licences). Set `ANDROID_HOME` if building from the terminal.
- `cd Wordamix && npm install`

## Debug APK (test on your phone)
```
npm run apk:debug            # = build www + cap sync + gradlew assembleDebug
# output: android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk   # phone: USB debugging on
```
Or `npm run open` and press Run in Android Studio. Debug in Chrome via chrome://inspect.

## Signed release AAB for Google Play
1. Create a keystore ONCE and back it up (losing it blocks future updates unless you use Play App Signing):
   `keytool -genkeypair -v -keystore wordamix-release.jks -alias wordamix -keyalg RSA -keysize 2048 -validity 10000`
2. Create `android/keystore.properties` (git-ignored):
```
storeFile=../../wordamix-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=wordamix
keyPassword=YOUR_KEY_PASSWORD
```
3. `npm run aab:release` -> `android/app/build/outputs/bundle/release/app-release.aab`
   (`npm run apk:release` builds a signed APK for sideloading.)
4. Play Console: create app, enrol in Play App Signing, upload the AAB, complete store listing, content rating, data safety (the app collects no data and makes no network calls), then release to internal testing first.

## Before the first Play upload
- `appId` is permanent: `com.albertnainar.wordamix`. Change it in `capacitor.config.json`, `android/app/build.gradle` (namespace + applicationId), `res/values/strings.xml` and move the Java package if you want another id, BEFORE publishing.
- For each update raise `versionCode` (integer) and `versionName` in `android/app/build.gradle`.
- Check Play's current target-API requirement; this project targets API 36 (Capacitor 8 default).
- Add 512x512 store icon, feature graphic and screenshots (not included).

## Behaviour added for Android
- Back button: results -> home; paused -> resume; playing -> pause; how-to/settings -> home; home -> exit.
- App goes to background mid-round -> auto-pause. Portrait only. Dark status/navigation bars. Safe-area insets handled.

## Files changed/added vs the web project
Changed: `index.html` (exports pause/resume/home/show on `window.__wordamix`, loads js/native.js, safe-area CSS vars), `sw.js` (cache v10 + native.js).
Added: `js/native.js`, `package.json`, `package-lock.json`, `capacitor.config.json`, `scripts/build-www.js`, `.gitignore`, `docs/ANDROID.md`, and the whole `android/` project.
Edited inside android/: `AndroidManifest.xml` (portrait), `res/values/styles.xml` (dark theme, splash colour), `res/values/ic_launcher_background.xml`, `app/build.gradle` (versionName 1.0.0, release signing), all `mipmap-*/ic_launcher*.png` and `drawable*/splash.png` (new Wordamix artwork).

## v1.0.0 release-candidate audit notes
- Fixed: template tests moved to `com.albertnainar.wordamix`; instrumented test now asserts the real package id; FileProvider paths reduced to cache-only.
- Package id `com.albertnainar.wordamix` verified in capacitor.config.json, build.gradle (namespace + applicationId), strings.xml, MainActivity, tests.
- versionName 1.0.0, versionCode 1.
- Without `android/keystore.properties`, `aab:release` builds an UNSIGNED bundle (Play will reject it); with it, the bundle is signed with your upload key. `android/keystore.properties.example` shows the format.
- `INTERNET` permission is still the Capacitor template default. The app makes no network calls; after confirming on a device that the game loads, you may remove it from AndroidManifest.xml.
