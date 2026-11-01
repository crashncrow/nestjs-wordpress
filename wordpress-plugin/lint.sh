#!/usr/bin/env bash
# Runs PHPCS (WordPress Coding Standards) in the official Composer image, so no local PHP is needed.
# Dependencies are installed inside the container: the plugin directory is mounted read-only.
set -euo pipefail
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd -P)"
docker run --rm -v "$PLUGIN_DIR":/src:ro composer:2 sh -c '
  mkdir /work && cp -r /src/composer.json /src/phpcs.xml.dist /src/nestjs-wordpress-webhooks /work/ &&
  cd /work && composer install --no-interaction --quiet && vendor/bin/phpcs'
