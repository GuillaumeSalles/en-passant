#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/check-native-ios.mjs
# CocoaPods already includes xcodeproj. Homebrew installs its Ruby gems privately.
if command -v brew >/dev/null 2>&1; then
  native_pods_root="$(brew --prefix cocoapods)/libexec"
  native_ruby="$(brew --prefix ruby)/bin/ruby"
  GEM_HOME="$native_pods_root" "$native_ruby" scripts/prepare-native-ios-tests.rb
else
  ruby scripts/prepare-native-ios-tests.rb
fi
native_destination="${NATIVE_IOS_DESTINATION:-platform=iOS Simulator,name=iPhone 17 Pro}"
xcodebuild test \
  -workspace apps/native/ios/EnPassant.xcworkspace \
  -scheme NativeUITests -configuration Release \
  -destination "$native_destination" \
  -parallel-testing-enabled NO -jobs 4 \
  ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO
