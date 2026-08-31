#!/usr/bin/env python3
"""Render 10,000 deterministic CapyCrew edition images from canonical artwork."""
from __future__ import annotations

import argparse
import colorsys
import json
import math
import os
import random
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

CANVAS = 768
MASTER_SEED = 20260821

RARITY_PALETTES = {
    "Common": ((18, 60, 48), (141, 227, 180), (244, 241, 222)),
    "Uncommon": ((9, 54, 70), (81, 202, 220), (214, 255, 63)),
    "Rare": ((74, 21, 63), (255, 75, 62), (123, 214, 228)),
    "Epic": ((48, 24, 82), (202, 126, 255), (255, 218, 92)),
    "Legendary": ((69, 39, 8), (255, 190, 54), (255, 246, 214)),
    "Mythic": ((10, 35, 42), (112, 255, 236), (255, 255, 255)),
    "Unique": ((21, 21, 21), (214, 255, 63), (255, 118, 84)),
    "One-of-One": ((5, 5, 5), (255, 255, 255), (255, 187, 46)),
}

PATTERNS = ("grid", "rays", "stripes", "dots", "circuit", "blocks")
FRAMES = ("double-rail", "corner-lock", "offset-shadow", "signal-bars", "archive-frame")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--image-base-uri", default="ipfs://EDITION_ARTWORK_CID/")
    parser.add_argument("--quality", type=int, default=38)
    parser.add_argument("--workers", type=int, default=max(1, min(8, os.cpu_count() or 4)))
    parser.add_argument("--method", type=int, default=4, choices=range(0, 7), help="WebP encoder effort; 0 is fastest, 6 is smallest")
    parser.add_argument("--seed", type=int, default=MASTER_SEED)
    parser.add_argument("--limit", type=int, default=0, help="Render only the first N tokens for preview")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def mix(a: tuple[int, int, int], b: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(round(x * (1 - amount) + y * amount) for x, y in zip(a, b))


def hue_shift(image: Image.Image, degrees: float) -> Image.Image:
    hsv = image.convert("HSV")
    h, s, v = hsv.split()
    shift = round(degrees / 360 * 255)
    h = h.point(lambda value: (value + shift) % 256)
    return Image.merge("HSV", (h, s, v)).convert("RGB")


def draw_pattern(draw: ImageDraw.ImageDraw, pattern: str, rng: random.Random, colors) -> None:
    dark, accent, light = colors
    if pattern == "grid":
        step = rng.choice((32, 40, 48, 56))
        for pos in range(-CANVAS, CANVAS * 2, step):
            draw.line((pos, 0, pos, CANVAS), fill=(*mix(dark, accent, .35), 95), width=2)
            draw.line((0, pos, CANVAS, pos), fill=(*mix(dark, light, .22), 70), width=1)
    elif pattern == "rays":
        center = (CANVAS // 2, CANVAS // 2)
        for angle in range(0, 360, rng.choice((15, 18, 20))):
            end = (center[0] + int(math.cos(math.radians(angle)) * CANVAS), center[1] + int(math.sin(math.radians(angle)) * CANVAS))
            draw.line((center, end), fill=(*accent, 75), width=rng.choice((4, 6, 8)))
    elif pattern == "stripes":
        width = rng.choice((18, 24, 30))
        for x in range(-CANVAS, CANVAS * 2, width * 3):
            draw.polygon(((x, 0), (x + width, 0), (x + CANVAS, CANVAS), (x + CANVAS - width, CANVAS)), fill=(*accent, 62))
    elif pattern == "dots":
        step = rng.choice((36, 44, 52))
        radius = rng.choice((3, 5, 7))
        for y in range(step // 2, CANVAS, step):
            for x in range(step // 2, CANVAS, step):
                offset = step // 2 if (y // step) % 2 else 0
                draw.ellipse((x + offset - radius, y - radius, x + offset + radius, y + radius), fill=(*light, 75))
    elif pattern == "circuit":
        for _ in range(28):
            x, y = rng.randrange(CANVAS), rng.randrange(CANVAS)
            length = rng.randrange(30, 140)
            draw.line((x, y, min(CANVAS, x + length), y), fill=(*accent, 90), width=2)
            draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(*light, 120))
    else:
        for _ in range(18):
            x, y = rng.randrange(CANVAS), rng.randrange(CANVAS)
            w, h = rng.randrange(30, 160), rng.randrange(20, 100)
            draw.rectangle((x, y, min(CANVAS, x + w), min(CANVAS, y + h)), fill=(*rng.choice((accent, light)), rng.randrange(25, 65)))


def prepare_character(source: Image.Image, rng: random.Random, accent) -> Image.Image:
    character = ImageOps.exif_transpose(source).convert("RGB")
    character = ImageEnhance.Color(character).enhance(rng.uniform(.88, 1.16))
    character = ImageEnhance.Contrast(character).enhance(rng.uniform(1.02, 1.14))
    character = ImageEnhance.Brightness(character).enhance(rng.uniform(.97, 1.05))
    character = hue_shift(character, rng.uniform(-7, 7))
    tint = Image.new("RGB", character.size, accent)
    character = Image.blend(character, tint, rng.uniform(.025, .075))
    character.thumbnail((632, 608), Image.Resampling.LANCZOS)
    return character


def draw_frame(draw: ImageDraw.ImageDraw, frame: str, colors, edition: int) -> None:
    dark, accent, light = colors
    if frame == "double-rail":
        draw.rectangle((18, 18, CANVAS - 18, CANVAS - 18), outline=light, width=4)
        draw.rectangle((30, 30, CANVAS - 30, CANVAS - 30), outline=accent, width=2)
    elif frame == "corner-lock":
        for x, y, sx, sy in ((20, 20, 1, 1), (CANVAS - 20, 20, -1, 1), (20, CANVAS - 20, 1, -1), (CANVAS - 20, CANVAS - 20, -1, -1)):
            draw.line((x, y, x + sx * 92, y), fill=accent, width=8)
            draw.line((x, y, x, y + sy * 92), fill=light, width=8)
    elif frame == "offset-shadow":
        draw.rectangle((24, 24, CANVAS - 38, CANVAS - 38), outline=light, width=4)
        draw.rectangle((38, 38, CANVAS - 24, CANVAS - 24), outline=accent, width=7)
    elif frame == "signal-bars":
        draw.rectangle((22, 22, CANVAS - 22, CANVAS - 22), outline=light, width=3)
        for index in range(8):
            width = 18 + ((edition + index * 7) % 74)
            draw.rectangle((34, 38 + index * 24, 34 + width, 45 + index * 24), fill=accent)
    else:
        draw.rectangle((18, 18, CANVAS - 18, CANVAS - 18), outline=accent, width=10)
        draw.rectangle((34, 34, CANVAS - 34, CANVAS - 34), outline=light, width=2)
        draw.line((52, 62, CANVAS - 52, 62), fill=light, width=2)


def render_token(source_path: Path, token: dict, metadata: dict, destination: Path, quality: int, method: int, seed: int) -> dict[str, str]:
    token_id = int(token["token_id"])
    tier = token["rarity_tier"]
    rng = random.Random((seed << 20) ^ token_id ^ (int(token["artwork_id"]) << 8))
    base_colors = RARITY_PALETTES[tier]
    color_variant = rng.uniform(.04, .24)
    colors = (mix(base_colors[0], base_colors[1], color_variant / 3), mix(base_colors[1], base_colors[2], color_variant), mix(base_colors[2], base_colors[1], color_variant / 2))
    pattern = rng.choice(PATTERNS)
    frame = rng.choice(FRAMES)
    palette_name = f"{tier} Signal {rng.randrange(1, 25):02d}"

    with Image.open(source_path) as source:
        source_rgb = ImageOps.exif_transpose(source).convert("RGB")
        background = ImageOps.fit(source_rgb, (CANVAS, CANVAS), method=Image.Resampling.LANCZOS)
        background = background.filter(ImageFilter.GaussianBlur(radius=24))
        background = Image.blend(background, Image.new("RGB", background.size, colors[0]), .58)
        canvas = background.convert("RGBA")

        pattern_layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        draw_pattern(ImageDraw.Draw(pattern_layer), pattern, rng, colors)
        canvas = Image.alpha_composite(canvas, pattern_layer)

        character = prepare_character(source_rgb, rng, colors[1]).convert("RGBA")
        shadow = Image.new("RGBA", character.size, (0, 0, 0, 135))
        shadow.putalpha(character.getchannel("A"))
        shadow = shadow.filter(ImageFilter.GaussianBlur(13))
        x = (CANVAS - character.width) // 2
        y = 80 + (608 - character.height) // 2
        canvas.alpha_composite(shadow, (x + 12, y + 16))
        canvas.alpha_composite(character, (x, y))

    overlay = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw_frame(draw, frame, colors, token_id)
    draw.rectangle((30, CANVAS - 112, CANVAS - 30, CANVAS - 30), fill=(*colors[0], 225), outline=colors[2], width=2)
    draw.text((50, CANVAS - 96), "CAPYCREW / GENESIS", font=font(18, True), fill=colors[1])
    edition_text = f"#{token_id:05d}"
    bbox = draw.textbbox((0, 0), edition_text, font=font(44, True))
    draw.text((CANVAS - 50 - (bbox[2] - bbox[0]), CANVAS - 104), edition_text, font=font(44, True), fill=colors[2])
    draw.text((50, CANVAS - 62), tier.upper(), font=font(15, True), fill=colors[2])
    draw.text((CANVAS - 182, 42), f"ART {int(token['artwork_id']):03d}", font=font(14, True), fill=colors[2])
    canvas = Image.alpha_composite(canvas, overlay).convert("RGB")
    canvas.save(destination, "WEBP", quality=quality, method=method)

    visual_trait_types = {"Edition Palette", "Frame Style", "Background Pattern"}
    attributes = [item for item in metadata.setdefault("attributes", []) if item.get("trait_type") not in visual_trait_types]
    metadata["attributes"] = attributes
    attributes.extend(
        [
            {"trait_type": "Edition Palette", "value": palette_name},
            {"trait_type": "Frame Style", "value": frame.replace("-", " ").title()},
            {"trait_type": "Background Pattern", "value": pattern.title()},
        ]
    )
    metadata.setdefault("properties", {}).update(
        {"edition_image": destination.name, "visual_seed": seed, "palette": palette_name, "frame": frame, "pattern": pattern}
    )
    return {"palette": palette_name, "frame": frame, "pattern": pattern}


def main() -> None:
    args = parse_args()
    root = args.project_root.resolve()
    collection = root / "nft-assets" / "full-collection"
    canonical_dir = collection / "images"
    metadata_dir = collection / "metadata"
    manifest_dir = collection / "manifests"
    output_dir = collection / "edition-images"
    tokens_path = manifest_dir / "tokens.json"
    if not tokens_path.is_file():
        raise SystemExit("Run generate_full_collection.py first")
    tokens = json.loads(tokens_path.read_text(encoding="utf-8"))
    if args.limit:
        tokens = tokens[: args.limit]
    output_dir.mkdir(parents=True, exist_ok=True)
    if args.force:
        for path in output_dir.glob("*.webp"):
            path.unlink()
    elif any(output_dir.glob("*.webp")):
        raise SystemExit(f"Edition output exists at {output_dir}; pass --force to replace it")

    jobs = []
    for token in tokens:
        token_id = int(token["token_id"])
        metadata_path = metadata_dir / f"{token_id}.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        source_path = canonical_dir / token["image_file"]
        destination = output_dir / f"{token_id}.webp"
        jobs.append((source_path, token, metadata, metadata_path, destination))

    treatments = []
    completed = 0
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(render_token, source_path, token, metadata, destination, args.quality, args.method, args.seed):
            (token, metadata, metadata_path, destination)
            for source_path, token, metadata, metadata_path, destination in jobs
        }
        for future in as_completed(futures):
            token, metadata, metadata_path, destination = futures[future]
            treatment = future.result()
            metadata["image"] = f"{args.image_base_uri.rstrip('/')}/{destination.name}"
            metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            treatments.append({"token_id": int(token["token_id"]), "artwork_id": token["artwork_id"], "rarity_tier": token["rarity_tier"], "image_file": destination.name, **treatment})
            completed += 1
            if completed % 500 == 0 or completed == len(tokens):
                print(f"Rendered {completed}/{len(tokens)}")

    (manifest_dir / "edition-treatments.json").write_text(
        json.dumps({"canvas": [CANVAS, CANVAS], "format": "webp", "quality": args.quality, "method": args.method, "workers": args.workers, "visual_seed": args.seed, "rendered": len(treatments), "records": sorted(treatments, key=lambda item: item["token_id"])}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Rendered {len(treatments)} edition images to {output_dir}")


if __name__ == "__main__":
    main()
