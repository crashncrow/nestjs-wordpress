#!/usr/bin/env bash
# Runs PHPCS (WordPress Coding Standards) and the signature test vectors in the official
# Composer image, so no local PHP is needed. Everything is mounted read-only; dependencies are
# installed inside the container.
set -euo pipefail
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd -P)"
VECTORS="$PLUGIN_DIR/../packages/nestjs-wordpress/test/fixtures/signature-vectors.json"
docker run --rm -v "$PLUGIN_DIR":/src:ro -v "$VECTORS":/vectors.json:ro composer:2 sh -c '
  mkdir /work && cp -r /src/composer.json /src/phpcs.xml.dist /src/nestjs-wordpress-webhooks /src/tests /work/ &&
  cd /work && composer install --no-interaction --quiet && vendor/bin/phpcs &&
  php tests/signature-vectors.php /vectors.json'
