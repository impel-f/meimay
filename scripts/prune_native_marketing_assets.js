const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const targetPaths = {
  android: [
    path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'public', 'marketing-assets'),
  ],
  ios: [
    path.join(projectRoot, 'ios', 'App', 'App', 'public', 'marketing-assets'),
  ],
};

const args = process.argv.slice(2).map((value) => value.toLowerCase());
const requestedPlatforms = args.length === 0 || args.includes('all')
  ? Object.keys(targetPaths)
  : args;

let removedCount = 0;

for (const platform of requestedPlatforms) {
  const paths = targetPaths[platform];
  if (!paths) {
    console.error(`Unknown platform: ${platform}`);
    process.exitCode = 1;
    continue;
  }

  for (const targetPath of paths) {
    if (!fs.existsSync(targetPath)) {
      console.log(`Skipped missing native marketing assets: ${targetPath}`);
      continue;
    }

    fs.rmSync(targetPath, { recursive: true, force: true });
    removedCount += 1;
    console.log(`Removed native marketing assets: ${targetPath}`);
  }
}

if (removedCount === 0 && process.exitCode !== 1) {
  console.log('No native marketing assets needed pruning.');
}
