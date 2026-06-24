#!/bin/sh
# Xcode Cloud build step — runs automatically after the repo is cloned, BEFORE the Archive.
# MeowTarot is a Capacitor app: the iOS web bundle (ios/App/App/public) is generated from www/
# by `cap sync`, it is not fully committed. Without this, Xcode Cloud archives an empty shell.
set -e

# Xcode Cloud images don't ship Node — install it, then build the web bundle into the app.
brew install node

cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci
npx cap sync ios   # copies www/ → ios/App/App/public + refreshes native config
