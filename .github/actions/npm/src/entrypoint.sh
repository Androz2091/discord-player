#!/bin/bash

set -e

# Parse the package name and version from the release name
if [[ $GITHUB_REF =~ ^refs/tags/ ]]; then
  RELEASE_NAME=${GITHUB_REF#refs/tags/}
  COMMIT_MESSAGE="chore($PACKAGE_NAME): release v$PACKAGE_VERSION"
elif [[ $GITHUB_REF =~ ^refs/heads/ ]]; then
  echo "Skipping action: this action should only be triggered by a tag, not a branch"
  exit 0
else
  echo "Skipping action: release name is not a tag"
  exit 0
fi

PACKAGE_NAME=$(echo "$RELEASE_NAME" | cut -d'@' -f1)
PACKAGE_VERSION=$(echo "$RELEASE_NAME" | cut -d'@' -f2)

if [[ -z $PACKAGE_NAME || -z $PACKAGE_VERSION ]]; then
  echo "Skipping action: failed to parse package name or version from release name"
  exit 0
fi

# Find the appropriate package directory
if [[ $PACKAGE_NAME =~ ^@[^/]+/ ]]; then
  # Scoped package
  PACKAGE_DIR=${PACKAGE_NAME/@/}
else
  # Unscoped package
  PACKAGE_DIR=$PACKAGE_NAME
fi

PACKAGE_PATH="packages/$PACKAGE_DIR"

if [[ ! -d $PACKAGE_PATH ]]; then
  echo "Skipping action: package directory '$PACKAGE_PATH' not found"
  exit 0
fi

# Set the package version to the one specified in the tag
(cd $PACKAGE_PATH && yarn version --new-version $PACKAGE_VERSION)

# Build the package
(cd $PACKAGE_PATH && yarn build)

# Publish the package
(cd $PACKAGE_PATH && yarn npm publish --access public)

# Configure Git
git config user.name "${GITHUB_ACTOR}"
git config user.email "${GITHUB_ACTOR}@users.noreply.github.com"

# Add all changes and commit with the specified commit message
git add .
git commit -m "$COMMIT_MESSAGE"
git push