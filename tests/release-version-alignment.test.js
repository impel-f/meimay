const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function allMatches(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

test('release versions stay aligned across the app, Android, Xcode, and Codemagic', () => {
  const index = read('public/index.html');
  const gradle = read('android/app/build.gradle');
  const codemagic = read('codemagic.yaml');
  const xcode = read('ios/App/App.xcodeproj/project.pbxproj');

  const appVersion = index.match(/メイメー v(\d+\.\d+\.\d+)/)?.[1];
  const androidVersion = gradle.match(/ANDROID_VERSION_NAME'\) \?: '(\d+\.\d+\.\d+)'/)?.[1];
  const codemagicAndroidVersion = codemagic.match(/ANDROID_VERSION_NAME: "(\d+\.\d+\.\d+)"/)?.[1];
  const codemagicIosVersion = codemagic.match(/IOS_MARKETING_VERSION: "(\d+\.\d+\.\d+)"/)?.[1];
  const xcodeVersions = allMatches(xcode, /MARKETING_VERSION = (\d+\.\d+\.\d+);/g);

  assert.ok(appVersion, 'the sidebar app version must be present');
  assert.equal(androidVersion, appVersion);
  assert.equal(codemagicAndroidVersion, appVersion);
  assert.equal(codemagicIosVersion, appVersion);
  assert.deepEqual([...new Set(xcodeVersions)], [appVersion]);
});

test('release build numbers stay aligned and Codemagic verifies generated artifacts', () => {
  const gradle = read('android/app/build.gradle');
  const codemagic = read('codemagic.yaml');
  const xcode = read('ios/App/App.xcodeproj/project.pbxproj');

  const androidCode = Number(gradle.match(/BUILD_NUMBER', (\d+)\)\)\)/)?.[1]);
  const codemagicAndroidCode = Number(codemagic.match(/ANDROID_VERSION_CODE: "(\d+)"/)?.[1]);
  const iosFloor = Number(codemagic.match(/IOS_BUILD_NUMBER_FLOOR: "(\d+)"/)?.[1]);
  const xcodeBuilds = allMatches(xcode, /CURRENT_PROJECT_VERSION = (\d+);/g).map(Number);

  assert.equal(codemagicAndroidCode, androidCode);
  assert.deepEqual([...new Set(xcodeBuilds)], [iosFloor]);
  assert.match(codemagic, /get-latest-build-number[\s\S]*--all-versions/);
  assert.match(codemagic, /Verify Android bundle contents/);
  assert.match(codemagic, /Verify IPA version before publishing/);
});
