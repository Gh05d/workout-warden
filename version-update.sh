#!/bin/bash

# Error handling: exit the script if any command fails
set -e

if [ -z "$1" ]; then
  echo -e "\033[1;31m❌ Usage: ./version-update.sh [patch|minor|major]\033[0m"
  exit 1
fi

VERSION_TYPE=$1

# Step 1: Update version in package.json
echo -e "\033[1;34mℹ️  Updating version in package.json with type: $VERSION_TYPE\033[0m"
if ! npm version $VERSION_TYPE; then
  echo -e "\033[1;31m❌ Failed to update version in package.json\033[0m"
  exit 1
fi

# Step 2: Update Android version and build
echo -e "\033[1;34mℹ️  Updating Android version in build.gradle\033[0m"
if ! node update-android-version.js; then
  echo -e "\033[1;31m❌ Failed to update Android version in build.gradle\033[0m"
  exit 1
fi

# Step 3: Build Android release
echo -e "\033[1;34mℹ️  Building Android release\033[0m"
cd android
if ! ./gradlew assembleRelease; then
  echo -e "\033[1;31m❌ Failed to build Android release\033[0m"
  exit 1
fi
cd ..

# Step 4: Commit version changes and push to repository
echo -e "\033[1;34mℹ️  Committing version changes\033[0m"
git add package.json android/app/build.gradle
if ! git commit -m "Updated Android version to $VERSION_TYPE"; then
  echo -e "\033[1;31m❌ Failed to commit version changes\033[0m"
  exit 1
fi

echo -e "\033[1;34mℹ️  Pushing changes to remote repository\033[0m"
if ! git push; then
  echo -e "\033[1;31m❌ Failed to push changes to remote repository\033[0m"
  exit 1
fi

echo -e "\033[1;32m✅ Successfully updated version, committed changes, and created production build with version type: $VERSION_TYPE 🎉\033[0m"
