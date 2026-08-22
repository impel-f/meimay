const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const appVersion = JSON.parse(
  fs.readFileSync(path.join(root, 'public', 'app-version.json'), 'utf8')
).version;

test('shared app version is a semantic version', () => {
  assert.match(appVersion, /^\d+\.\d+\.\d+$/);
});

test('drawer and iOS project use the shared app version', () => {
  const indexSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const xcodeSource = fs.readFileSync(
    path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'),
    'utf8'
  );

  assert.match(indexSource, new RegExp(`メイメー v${appVersion.replace(/\./g, '\\.')}`));
  const xcodeVersions = [...xcodeSource.matchAll(/MARKETING_VERSION = ([^;]+);/g)]
    .map((match) => match[1].trim());
  assert.ok(xcodeVersions.length > 0);
  assert.deepEqual([...new Set(xcodeVersions)], [appVersion]);
});

test('Android and Codemagic resolve display versions from the shared file', () => {
  const gradleSource = fs.readFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'utf8');
  const codemagicSource = fs.readFileSync(path.join(root, 'codemagic.yaml'), 'utf8');

  assert.match(gradleSource, /rootProject\.file\('\.\.\/public\/app-version\.json'\)/);
  assert.match(gradleSource, /def androidVersionName = \(new JsonSlurper\(\)\.parse\(appVersionFile\)\.version/);
  assert.doesNotMatch(gradleSource, /def androidVersionName = .*ANDROID_VERSION_NAME/);
  assert.match(codemagicSource, /require\(["']\.\/public\/app-version\.json["']\)\.version/);
  assert.doesNotMatch(codemagicSource, /^\s+IOS_MARKETING_VERSION:/m);
});
