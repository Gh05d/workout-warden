#!/bin/bash

# Error handling: exit the script if any command fails
set -e

if [ -z "$1" ]; then
  echo "Usage: ./version-update.sh [patch|minor|major]"
  exit 1
fi

VERSION_TYPE=$1

# Step 1: Update version in package.json
if ! npm version $VERSION_TYPE; then
  echo "Failed to update version in package.json"
  exit 1
fi

# Step 2: Update Android version and build
if ! node update-android-version.js; then
  echo "Failed to update Android version in build.gradle"
  exit 1
fi

# Step 3: Build Android release
if ! cd android && ./gradlew assembleRelease; then
  echo "Failed to build Android release"
  exit 1
fi
cd ..

# Step 4: Commit version changes and push to repository
git add package.json android/app/build.gradle
if ! git commit -m "Updated Android version to $VERSION_TYPE"; then
  echo "Failed to commit version changes"
  exit 1
fi

if ! git push; then
  echo "Failed to push changes to remote repository"
  exit 1
fi

echo "Successfully updated version, committed changes, and created production build with version type: $VERSION_TYPE"
