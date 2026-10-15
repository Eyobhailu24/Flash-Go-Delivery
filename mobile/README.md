# FlashGo mobile

One Expo / React Native app for customers, businesses, delivery drivers, and administrators. It uses the existing Hono API and Neon database, with native session renewal, payment return links, push delivery, and driver location support.

The website's orange palette, logo, rounded cards, menu browsing, promotional carousels, forms, and role navigation are adapted to phone screens. Shared native components use NativeWind, CVA, and React Native Primitives; lists use FlashList and loading states use animated skeletons. This is runnable source for Android and iOS development builds.

## Run locally

Use Node 24 LTS and npm. Android needs JDK 17, Android Studio, its SDK, and a configured emulator or USB device. Set `JAVA_HOME` to JDK 17, as recommended by the [React Native setup guide](https://reactnative.dev/docs/set-up-your-environment). Local iOS builds need macOS, Xcode, and CocoaPods. Use `npm.cmd` / `npx.cmd` in Windows PowerShell if script execution policy blocks `npm` / `npx`.

From the repository root, prepare the backend:

```sh
cd backend
npm ci
npm run mobile:setup
npm run dev
```

Keep the existing `backend/.env`, including its Neon connection, JWT secrets, and existing service credentials. `mobile:setup` applies migrations and creates the four demo accounts below; rerunning it resets their passwords to the configured demo password. It does not erase unrelated data. Migration `0019_mobile_sessions_push.sql` adds mobile sessions, push devices, and the push outbox. It has already been applied to the configured dummy database.

In a second terminal:

```sh
cd mobile
npm ci
```

Copy `.env.example` to `.env` if `.env` does not already exist. Set `EXPO_PUBLIC_API_URL` to an address reachable from the phone:

| Device                                   | Typical API URL                    |
| ---------------------------------------- | ---------------------------------- |
| Android Studio emulator                  | `http://10.0.2.2:3001`             |
| iOS simulator / browser on this computer | `http://localhost:3001`            |
| Physical phone on the same Wi-Fi         | `http://YOUR_COMPUTER_LAN_IP:3001` |

A blank value infers the Expo development server host. An explicit URL is preferable for native testing. Keep port 3001 reachable from the device. Database URLs, JWT secrets, Cloudinary secrets, SMS keys, and Chapa secrets belong only in the backend environment.

```sh
npm run android
# Or, on macOS:
npm run ios
```

These commands generate the native project and install a development build. For later JavaScript-only work, use `npm start` and open the installed development client. Rebuild after changing native modules, app identity, permissions, or native keys. Expo Go cannot exercise this app's full native feature set.

For a browser preview at phone width:

```sh
npm run web -- --localhost --port 8081
```

The browser preview supports the catalog and role workflows. Native background location, remote push registration, and Apple/Google map rendering need device builds.

To preview the optimized export instead, stop Metro, run `npm run export`, then `npm run preview`. The preview server uses the same port 8081.

On Windows, build from a short physical path without spaces, such as `C:\flashgo\mobile`. CMake/Ninja can fail under this repository's long `WEB PROJECTS` path. A temporary drive mapping was also tested but Expo's resolved module paths caused a mixed-drive error; use a physical checkout or copy instead. See [Reanimated's Windows build guidance](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/).

## Demo sign-ins

All four seeded accounts use **`FlashGoDemo!2026`** unless `MOBILE_DEMO_PASSWORD` was set when seeding. These accounts are for the dummy environment.

| Role     | Phone           |
| -------- | --------------- |
| Customer | `+251900000001` |
| Business | `+251900000002` |
| Driver   | `+251900000003` |
| Admin    | `+251900000004` |

The seed includes FlashGo Demo Kitchen, a customer delivery address, and a discounted Demo Tibs item. The app directs each account to its authorized area. Role restrictions are enforced by the API as well as navigation.

## Map switch

```dotenv
# Google Maps on Android; Apple Maps on iOS
EXPO_PUBLIC_GOOGLE_MAPS=true
GOOGLE_MAPS_ANDROID_API_KEY=your_restricted_android_key

# Or use the website's Leaflet / OpenStreetMap implementation on both:
EXPO_PUBLIC_GOOGLE_MAPS=false
```

Use exactly `true` or `false`. Restart Metro when changing `.env`. Changing the Android API key requires a new native build. Restrict that key to the Android app ID and signing certificate. Apple Maps does not use the Google key. The web preview always uses Leaflet.

Leaflet code and its license are bundled locally; map tiles still require internet. OpenStreetMap attribution remains visible. Routing uses `EXPO_PUBLIC_OSRM_URL`, address search uses `EXPO_PUBLIC_GEOCODING_URL` (Nominatim), and reverse geocoding uses BigDataCloud. Public community endpoints are the development defaults; configure services appropriate for deployment traffic. The backend remains authoritative for delivery fees, regardless of map provider.

## Push and background driver location

In-app notifications work with the existing API. To enable remote push:

1. Associate the app with your Expo EAS project and set `EXPO_PUBLIC_EAS_PROJECT_ID` to its UUID.
2. For Android, add the Firebase client `google-services.json` matching `APP_IDENTIFIER`, set `GOOGLE_SERVICES_JSON_PATH=./google-services.json`, and configure the corresponding FCM v1 credentials in EAS.
3. For iOS, configure APNs credentials for the same app identifier in EAS.
4. Build the app again, install on a physical device, sign in, and use **Enable notifications** on the Notifications screen.

The backend polls its persistent push outbox every five seconds. `PUSH_ENABLED=false` disables sending; `EXPO_ACCESS_TOKEN` is supported if enhanced push security is enabled for the Expo project. Device tokens are bound to the signed-in mobile session. Logout revokes the session and unregisters the token. Tickets and receipts are tracked; expired device tokens are removed.

Drivers explicitly enable location sharing on their dashboard. The app requests foreground and background permission and uses an Android foreground service / iOS background location task. Updates target 25 meters / 15 seconds and skip stale fixes. Tracking stops on logout or completed delivery. Timing is controlled by the OS; force-quitting the app, permission changes, or device power management can interrupt updates. Validate these behaviors on physical Android and iOS devices before deployment.

## Payments and existing placeholders

Cash checkout uses the existing order flow. Telebirr opens the Chapa checkout in a system browser and returns through `flashgo://payment-status`. The server signs mobile return state, verifies with Chapa, and the app reloads the order's actual payment status. `BACKEND_URL` must be publicly reachable over HTTPS for provider callbacks when testing real payments; localhost callbacks will not reach a phone or payment provider. Keep the backend `MOBILE_APP_SCHEME` at `flashgo` unless changing both the native scheme and payment client.

SMS verification/reset uses the existing backend configuration. The dummy environment currently enables `OTP_BYPASS`; the existing backend logs delivery codes in this mode. Demo accounts are already verified. Automated tests mock external payment verification and do not send SMS or charge money.

Home promotional buttons and the admin package-orders placeholder remain as on the website. Customer package creation, estimates, payment, tracking, and driver dispatch are implemented. This does not invent content or functionality behind the website's placeholders.

## Languages and performance

English and Amharic UI strings are bundled in the app, with a persistent language switch and an Ethiopic font. Review [the translation draft](docs/TRANSLATIONS.md); edit `src/locales/am.json` and run `npm run translations:review` to regenerate it. Business names, catalog descriptions, addresses, and arbitrary server messages remain in the language supplied by the backend. Native OS permission prompts currently use the English descriptions in `app.config.ts`.

Performance measures include paginated virtualized lists, cached/resized images, debounced server searches, query caching, screen-aware polling, reduced-motion-aware skeletons, and map layer updates without rebuilding the embedded map. Only three application font weights are imported. Cached data can remain visible while disconnected; checkout and other writes require a working API connection and are not queued for automatic replay. Device frame rate, cold-start time, and battery use still need measurement on target hardware.

## Source and verification

| Location                                          | Purpose                                                        |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `src/app`                                         | Expo Router screens and role guards                            |
| `src/components/ui`                               | Shared native UI and skeletons                                 |
| `src/features`                                    | Catalog, users, cart, and order flows                          |
| `src/lib`                                         | API/session, translations, location, push, and payment helpers |
| `src/components/maps`                             | Native maps and bundled Leaflet adapters                       |
| `../backend/src/lib/mobile-auth.ts`               | Rotating refresh sessions and revocation                       |
| `../backend/src/lib/push-worker.ts`               | Persistent push outbox and receipts                            |
| `../backend/src/tests/mobile.integration.test.ts` | Isolated dummy-database API scenarios                          |

```sh
# mobile/
npm run typecheck
npm test
npx expo install --check
npm run export

# With the API and web preview running; defaults to installed Microsoft Edge:
npm run test:e2e

# backend/ (requires the disposable Neon environment)
npm run build
npm run test:mobile
```

Browser tests use the seeded demo accounts, capture phone-width screenshots, and exercise role access. Integration tests create temporary fixtures and delete those fixtures afterward. They do not reset your database. Set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome instead of Edge.

See [validation results and remaining device checks](docs/VALIDATION.md). No store publishing or signed distribution build is included.
