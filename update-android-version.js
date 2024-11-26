const fs = require('fs');
const path = require('path');

// Paths to the relevant files
const packageJsonPath = path.join(__dirname, 'package.json');
const buildGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');

// Step 1: Read the version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const newVersionName = packageJson.version;

if (!newVersionName) {
  console.error('Version not found in package.json');
  process.exit(1);
}

// Step 2: Read and update build.gradle
let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

// Use a regular expression to find and replace the versionName and versionCode
const versionNameRegex = /versionName\s+"[\d\.]+"/;
const versionCodeRegex = /versionCode\s+\d+/;

// Update versionName with the new version
buildGradle = buildGradle.replace(
  versionNameRegex,
  `versionName "${newVersionName}"`,
);

// Increment versionCode by 1
const currentVersionCodeMatch = buildGradle.match(versionCodeRegex);
if (currentVersionCodeMatch) {
  const currentVersionCode = parseInt(
    currentVersionCodeMatch[0].split(' ')[1],
    10,
  );
  const newVersionCode = currentVersionCode + 1;
  buildGradle = buildGradle.replace(
    versionCodeRegex,
    `versionCode ${newVersionCode}`,
  );
} else {
  console.error('versionCode not found in build.gradle');
  process.exit(1);
}

// Step 3: Write the updated build.gradle back to the file
fs.writeFileSync(buildGradlePath, buildGradle, 'utf8');

console.log(`Successfully updated build.gradle:
  - versionName: ${newVersionName}
  - versionCode incremented by 1`);
