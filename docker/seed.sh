#!/usr/bin/env bash
# Seeds the local WordPress with deterministic demo content. Safe to run repeatedly:
# every step checks for existing data first (lookups by slug / name).
#
# The WP-CLI commands run inside ONE short-lived `wpcli` container (piped script),
# which is much faster than one `docker compose run` per command. The host side only
# collects the generated application password and writes apps/demo/.env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "$ROOT_DIR/docker/docker-compose.yml")
ENV_FILE="$ROOT_DIR/apps/demo/.env"
WP_URL="${WP_URL:-http://localhost:8080}"
WEBHOOK_SECRET="${NWP_WEBHOOK_SECRET:-dev-webhook-secret-change-me}"

echo "→ Seeding WordPress at $WP_URL"

OUTPUT="$("${COMPOSE[@]}" --profile seed run --rm -T -e WP_URL="$WP_URL" wpcli sh -s <<'INNER'
set -eu
wp() { command wp --quiet "$@"; }

# --- core -------------------------------------------------------------------
if ! command wp core is-installed 2>/dev/null; then
  wp core install --url="$WP_URL" --title="nestjs-wordpress demo" \
    --admin_user=admin --admin_password=admin --admin_email=admin@example.com --skip-email
fi
wp option update blogdescription "Headless WordPress for NestJS"
wp option update timezone_string "UTC"
wp option update posts_per_page 10
wp rewrite structure '/%postname%/'
wp plugin activate nestjs-wordpress-webhooks
# Remove default "Hello world!" / "Sample Page" so counts are deterministic.
for id in $(command wp post list --post_type=post,page --name=hello-world --field=ID) \
          $(command wp post list --post_type=page --name=sample-page --field=ID); do
  wp post delete "$id" --force
done

# --- helpers ----------------------------------------------------------------
term_id() { # taxonomy slug name [parent_id]
  id=$(command wp term list "$1" --slug="$2" --field=term_id)
  if [ -z "$id" ]; then
    if [ -n "${4:-}" ]; then
      id=$(command wp term create "$1" "$3" --slug="$2" --parent="$4" --porcelain)
    else
      id=$(command wp term create "$1" "$3" --slug="$2" --porcelain)
    fi
  fi
  echo "$id"
}
post_id() { # type slug [parent_id] -> prints ID or nothing (any status)
  if [ -n "${3:-}" ]; then
    command wp post list --post_type="$1" --name="$2" --post_parent="$3" --post_status=any --field=ID | head -n1
  else
    command wp post list --post_type="$1" --name="$2" --post_status=any --field=ID | head -n1
  fi
}
upsert_post() { # type slug title status parent_id author content excerpt
  id=$(post_id "$1" "$2" "$5")
  if [ -z "$id" ]; then
    id=$(command wp post create --post_type="$1" --post_name="$2" --post_title="$3" \
      --post_status="$4" --post_parent="$5" --post_author="$6" \
      --post_content="$7" --post_excerpt="$8" --porcelain)
  fi
  echo "$id"
}
image_id() { # slug r g b
  id=$(command wp post list --post_type=attachment --name="$1" --field=ID | head -n1)
  if [ -z "$id" ]; then
    php -r '$i = imagecreatetruecolor(1200, 630);
            imagefill($i, 0, 0, imagecolorallocate($i, (int)$argv[2], (int)$argv[3], (int)$argv[4]));
            imagepng($i, $argv[1]);' "/tmp/$1.png" "$2" "$3" "$4"
    id=$(command wp media import "/tmp/$1.png" --title="$1" --alt="Cover image $1" --porcelain)
  fi
  echo "$id"
}

# --- users ------------------------------------------------------------------
ADMIN_ID=$(command wp user get admin --field=ID)
WRITER_ID=$(command wp user get writer --field=ID 2>/dev/null || true)
if [ -z "$WRITER_ID" ]; then
  WRITER_ID=$(command wp user create writer writer@example.com --role=author \
    --display_name="Jane Writer" --user_pass=writer --porcelain)
fi

# --- taxonomies -------------------------------------------------------------
CAT_NEWS=$(term_id category news "News")
CAT_TUTORIALS=$(term_id category tutorials "Tutorials")
CAT_NESTJS=$(term_id category nestjs "NestJS" "$CAT_TUTORIALS")
term_id post_tag nestjs "nestjs" >/dev/null
term_id post_tag wordpress "wordpress" >/dev/null
term_id post_tag headless "headless" >/dev/null
GENRE_SCIFI=$(term_id genre sci-fi "Sci-Fi")
GENRE_ESSAY=$(term_id genre essay "Essay")

# --- media ------------------------------------------------------------------
IMG_A=$(image_id cover-blue 37 99 235)
IMG_B=$(image_id cover-green 22 163 74)
IMG_C=$(image_id cover-orange 234 88 12)

# --- posts (12 published + 1 draft, enough for pagination) -------------------
i=1
while [ $i -le 12 ]; do
  slug="demo-post-$i"
  author=$ADMIN_ID; [ $((i % 2)) -eq 0 ] && author=$WRITER_ID
  cat=$CAT_NEWS; tags="wordpress"
  [ $((i % 3)) -eq 0 ] && cat=$CAT_NESTJS && tags="nestjs,headless"
  content="<p>This is demo post number $i.</p><p>Read the <a href=\"$WP_URL/about/\">about page</a> or <a href=\"$WP_URL/demo-post-1/\">the first post</a>.</p><!--more--><p>More content for post $i.</p>"
  id=$(post_id post "$slug")
  if [ -z "$id" ]; then
    # Spread dates one day apart so ordering is deterministic.
    date=$(date -u -d "@$(( $(date +%s) - (13 - i) * 86400 ))" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u '+%Y-%m-%d %H:%M:%S')
    id=$(command wp post create --post_type=post --post_name="$slug" --post_title="Demo post $i" \
      --post_status=publish --post_author="$author" --post_date="$date" \
      --post_content="$content" --post_excerpt="Short excerpt for demo post $i." --porcelain)
  fi
  wp post term set "$id" category "$cat" --by=id
  wp post term set "$id" post_tag $(echo "$tags" | tr ',' ' ')
  case $((i % 3)) in
    0) wp post meta update "$id" _thumbnail_id "$IMG_A" ;;
    1) wp post meta update "$id" _thumbnail_id "$IMG_B" ;;
    *) : ;; # every third post has no featured image on purpose
  esac
  i=$((i + 1))
done
upsert_post post draft-post "Draft post (preview only)" draft 0 "$ADMIN_ID" \
  "<p>Only visible with authentication.</p>" "Draft excerpt." >/dev/null

# --- hierarchical pages -------------------------------------------------------
P_HOME=$(upsert_post page home "Home" publish 0 "$ADMIN_ID" "<p>Welcome to the demo.</p>" "")
P_ABOUT=$(upsert_post page about "About" publish 0 "$ADMIN_ID" "<p>About this project.</p>" "")
P_TEAM=$(upsert_post page team "Team" publish "$P_ABOUT" "$ADMIN_ID" "<p>The team.</p>" "")
P_LEAD=$(upsert_post page leadership "Leadership" publish "$P_TEAM" "$ADMIN_ID" "<p>Leadership.</p>" "")
P_SERV=$(upsert_post page services "Services" publish 0 "$ADMIN_ID" "<p>What we do.</p>" "")
# Same slug "team" under a different parent: getByPath must disambiguate.
upsert_post page team "Services team" publish "$P_SERV" "$ADMIN_ID" "<p>Services team.</p>" "" >/dev/null
wp post meta update "$P_ABOUT" _thumbnail_id "$IMG_C"

# --- custom post type -----------------------------------------------------------
for b in "dune-notes:Dune notes:$GENRE_SCIFI" "foundation-notes:Foundation notes:$GENRE_SCIFI" "on-writing:On writing:$GENRE_ESSAY"; do
  slug=${b%%:*}; rest=${b#*:}; title=${rest%%:*}; genre=${rest#*:}
  id=$(upsert_post book "$slug" "$title" publish 0 "$WRITER_ID" "<p>$title.</p>" "About $title.")
  wp post term set "$id" genre "$genre" --by=id
done

# --- menu ---------------------------------------------------------------------
if ! command wp menu list --fields=slug --format=csv | grep -qx primary-menu; then
  wp menu create "Primary menu"
  wp menu item add-custom primary-menu "Home" "$WP_URL/"
  ABOUT_ITEM=$(command wp menu item add-post primary-menu "$P_ABOUT" --porcelain)
  wp menu item add-post primary-menu "$P_TEAM" --parent-id="$ABOUT_ITEM"
  wp menu item add-term primary-menu category "$CAT_NEWS"
  wp menu item add-custom primary-menu "GitHub" "https://github.com/crashncrow/nestjs-wordpress"
fi
wp menu location assign primary-menu primary

# --- application password (rotated on every run) --------------------------------
for uuid in $(command wp user application-password list admin --name=nestjs-demo --field=uuid); do
  wp user application-password delete admin "$uuid"
done
APP_PASSWORD=$(command wp user application-password create admin nestjs-demo --porcelain)
echo "APP_PASSWORD=$APP_PASSWORD"
INNER
)"

APP_PASSWORD="$(printf '%s\n' "$OUTPUT" | sed -n 's/^APP_PASSWORD=//p' | tail -n1)"
if [ -z "$APP_PASSWORD" ]; then
  echo "✗ Could not read the application password. WP-CLI output:" >&2
  printf '%s\n' "$OUTPUT" >&2
  exit 1
fi

cat > "$ENV_FILE" <<EOF
# Generated by docker/seed.sh — do not commit.
PORT=3000
WP_URL=$WP_URL
WP_USERNAME=admin
WP_APP_PASSWORD=$APP_PASSWORD
WP_WEBHOOK_SECRET=$WEBHOOK_SECRET
REDIS_URL=redis://localhost:6379
EOF

echo "✓ Seed complete. Credentials written to apps/demo/.env"
echo "  WP admin: $WP_URL/wp-admin (admin / admin)"
