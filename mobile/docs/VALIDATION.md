# Validation record

This records what was exercised and what still needs device or provider credentials. JavaScript export success is separate from native compilation and physical-device testing.

## Completed checks

| Check                                        | Result                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Backend TypeScript build                     | Passed                                                                                |
| Mobile TypeScript check                      | Passed                                                                                |
| Mobile unit tests                            | 4 passed: phone normalization, fee totals, strict map flag, embedded-map escaping     |
| Backend integration tests against dummy Neon | 6 passed, including the parent suite                                                  |
| Expo SDK compatibility                       | Passed after SDK 57 patch updates                                                     |
| JavaScript exports                           | Android, iOS, and web passed                                                          |
| Browser role tests at 390 × 844              | Guest catalog/language switch and all four role sign-in/dashboard/logout tests passed |

The backend integration scenarios cover role restrictions, existing website cookies, refresh rotation/replay rejection, logout revocation, catalog filtering, cart quantity limits, cash pricing, business approval, driver offer/accept/start/location/delivery, customer tracking and feedback, package estimates, signed mobile payment returns, payment idempotency, and push-token ownership. External payment verification is mocked; these tests do not charge money or send SMS. Fixtures are scoped to each test run and cleaned up.

The mobile export includes approximately 7.3 MB of Android Hermes bytecode, 7.1 MB of iOS Hermes bytecode, and 5.2 MB of web JavaScript before transport compression. These are bundle sizes, not installed app sizes or startup benchmarks. Application fonts are limited to Geist regular/semibold and Noto Sans Ethiopic regular; the router also includes a Material Symbols font.

The final browser run passed all **6 tests** in 32.6 seconds. In addition to the role flows, it searches the menu, adds a meal, checks the server-calculated checkout total, and verifies that a delayed geocoder response cannot overwrite a manually edited address.

Android native compilation also passed: a debug x86_64 APK was built with JDK 17 from the short-path verification copy at `C:\fg-mobile-verify`. The output is `C:\fg-mobile-verify\android\app\build\outputs\apk\debug\app-debug.apk`; it is a development build, not a signed distribution release.

The APK was installed and launched on the Pixel 8 Android emulator. The native home screen rendered with the website logo, fonts, promotional carousel, and categories loaded from the local API. No AndroidRuntime or ReactNativeJS errors appeared in the launch check. The captured screen is [android-smoke.png](../screenshots/android-smoke.png). This is a development-mode launch check, not a release performance benchmark.

The default Leaflet/OpenStreetMap address picker also rendered inside the native Android WebView with tiles and attribution visible: [android-map.png](../screenshots/android-map.png).

For that emulator check, Metro used `--lan --port 8082` with `REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1`, and adb reverse forwarded ports 8082 and 3001. `--localhost` initially bound only IPv6 on this machine, which prevented the emulator's IPv4 connection. The app used `EXPO_PUBLIC_API_URL=http://127.0.0.1:3001` for this forwarded connection.

## Device and service checks still required

- iOS native compilation and simulator/device launch on macOS with Xcode.
- Physical Android and iOS push delivery with the user's EAS project and FCM/APNs credentials, including foreground/background/cold-start delivery and logout.
- Driver tracking with foreground/background permission, locked screen, permission denial, reconnection, battery restrictions, and force-quit behavior on both platforms.
- Google Maps Android rendering with a restricted API key and Apple Maps rendering on iOS. The default Leaflet map was verified in the browser and Android emulator.
- Real Chapa/Telebirr checkout using a publicly reachable HTTPS backend callback, including user cancellation and return to the app. Automated provider responses are mocks.
- Real SMS verification/reset and image-library upload on devices.
- Release-build cold start, list scrolling/frame timing, memory, network, and battery profiling on target devices. No device performance numbers are claimed.
- Amharic terminology review in [TRANSLATIONS.md](TRANSLATIONS.md). Backend content and arbitrary server messages retain their supplied language; native permission descriptions are currently English.

## Environment notes

The original Windows workspace has a long path containing spaces. Android compilation first encountered Java 25 native-access issues, then Ninja/CMake path errors under JDK 17. A drive mapping also produced mixed physical/mapped module paths. Native verification therefore uses a separate physical short-path copy. The source remains under `mobile`.

Use Node 24 LTS and JDK 17 for local setup. The existing machine has Node 23.10.0, which emits React Native engine warnings even though the checks above run successfully.

The dependency installation reported 37 npm audit findings (15 moderate, 22 high), largely through framework/build-tool dependencies. The suggested force fix includes incompatible framework changes, so it was not applied. Review current advisories and compatible patches before production distribution; this record does not claim a clean security audit.

Historical Drizzle migrations in this repository are partly maintained manually. Apply the checked-in migration with `db:migrate`; review any generated future migration before applying it because existing snapshots predate several historical schema changes.

The source preserves the website's promotional CTA and admin package-page placeholders. There is no store submission or signed distribution build in scope.
