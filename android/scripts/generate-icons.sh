#!/usr/bin/env bash
# Regenerates every Android launcher / splash / notification asset from the one
# brand mark, so the platforms cannot drift: `PulpeIcon.imageset` on iOS,
# `landing/public/icon.png` on the web and `assets/images/brand-mark.png` here
# are the same 519x519 file.
#
# Needs ImageMagick 7 (`brew install imagemagick`). Run from `android/`.
set -euo pipefail

SOURCE="assets/images/brand-mark.png"
OUT="assets/images"

# The pale green the iOS icon sits on, sampled from its gradient. Android takes
# a flat colour: `adaptiveIcon.backgroundColor` has no gradient form, and a
# gradient is invisible at 48dp anyway.
BACKGROUND="#C6F0BA"

# Adaptive icons are 108dp layers whose central 66dp circle is all any launcher
# mask is guaranteed to show — 313px of the 1024px canvas below. What decides the
# width is not how wide the mark is but how far its furthest point sits from the
# centre, and on this mark that point is the upper-right tip of the rind, not the
# widest row: at 600px wide it reaches 318px and a circular launcher shaves it.
# 560 puts it at 297px. `assert_within_safe_zone` is what actually holds the line.
CANVAS=1024
SAFE_WIDTH=560
SAFE_RADIUS=313

# The legacy square icon (API 24-25, Play listing) is never masked, so it can
# carry the same near-full-bleed weight as the iOS icon.
LEGACY_WIDTH=800

# Above this luminance a pixel is the pale flesh between segments; below it, a
# segment or the rind. Splitting there keeps the segments readable in the
# single-colour renderings instead of flattening the mark into a blob. The mark
# measures gray 211 for the flesh and 84-161 for the segments and rind, so the
# cut belongs just above the lightest segment.
FLESH_THRESHOLD=70%

place() { # width -> mark centred on a transparent CANVAS square
  magick "$SOURCE" -trim +repage -resize "${1}x" \
    -background none -gravity center -extent "${CANVAS}x${CANVAS}" "$2"
}

silhouette() { # colour -> the mark as one flat colour, segments knocked out
  local image=$1 colour=$2
  local scratch opaque ink
  scratch=$(mktemp -d)
  opaque=$scratch/opaque.png ink=$scratch/ink.png

  magick "$image" -alpha extract "$opaque"
  magick "$image" -alpha off -colorspace gray -threshold "$FLESH_THRESHOLD" \
    -negate "$opaque" -compose multiply -composite "$ink"
  magick "$image" -alpha off -fill "$colour" -colorize 100 \
    "$ink" -alpha off -compose copy_opacity -composite "$image"

  rm -- "$opaque" "$ink"
  rmdir "$scratch"
}

assert_within_safe_zone() { # fails if any opaque pixel falls outside the circle
  local spill
  spill=$(magick "$1" -alpha extract -threshold 8% \
    \( -size "${CANVAS}x${CANVAS}" xc:white -fill black \
       -draw "circle $((CANVAS / 2)),$((CANVAS / 2)) $((CANVAS / 2)),$((CANVAS / 2 - SAFE_RADIUS))" \) \
    -compose multiply -composite -format '%[fx:mean>0]' info:)

  if [[ $spill == 1 ]]; then
    echo "$1: content reaches outside the ${SAFE_RADIUS}px safe circle — a round launcher will clip it." >&2
    exit 1
  fi
}

mkdir -p "$OUT"

place "$SAFE_WIDTH" "$OUT/adaptive-icon.png"
place "$SAFE_WIDTH" "$OUT/splash-icon.png"
assert_within_safe_zone "$OUT/adaptive-icon.png"

place "$LEGACY_WIDTH" "$OUT/icon.png"
magick "$OUT/icon.png" -background "$BACKGROUND" -alpha remove -alpha off "$OUT/icon.png"

cp "$OUT/adaptive-icon.png" "$OUT/adaptive-icon-monochrome.png"
silhouette "$OUT/adaptive-icon-monochrome.png" black

# The status bar tints the notification icon itself, so every non-transparent
# pixel has to be white — a coloured one is flattened to a white block.
place 760 "$OUT/notification-icon.png"
silhouette "$OUT/notification-icon.png" white
magick "$OUT/notification-icon.png" -resize 96x96 "$OUT/notification-icon.png"

printf '%-34s %s\n' "$OUT"/*.png
