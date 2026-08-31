#!/usr/bin/env python3
"""Build the reproducible 10,000-token CapyCrew metadata collection.

Common and Epic source folders keep their rarity. Every artwork from the
remaining configured folders is shuffled with a seed and assigned to one of
the other tiers. Token tier totals are exact, not statistical approximations.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

TOTAL_SUPPLY = 10_000
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
SOURCE_FOLDERS = (
    "Common",
    "Epic",
    "Helmets",
    "Legendary",
    "New folder",
    "Rare-Graffiti",
    "Skate",
    "Ski-Mask",
    "Sport-Outfit",
)

# Exact token totals from the supplied collection plan. They sum to 10,000.
TIER_QUOTAS = {
    "Common": 4_000,
    "Uncommon": 2_500,
    "Rare": 1_500,
    "Epic": 1_000,
    "Legendary": 600,
    "Mythic": 300,
    "Unique": 90,
    "One-of-One": 10,
}

# The 77 non-Common/non-Epic artworks are randomly shuffled, then assigned
# with these fixed pool sizes. This makes the result random but reproducible.
RANDOM_ARTWORK_POOL_SIZES = {
    "Uncommon": 31,
    "Rare": 20,
    "Legendary": 8,
    "Mythic": 4,
    "Unique": 4,
    "One-of-One": 10,
}

FOLDER_TRAITS = {
    "Helmets": ("Headwear", "Helmet"),
    "Legendary": ("Source Series", "Armored"),
    "New folder": ("Source Series", "City Roles"),
    "Rare-Graffiti": ("Style", "Graffiti"),
    "Skate": ("Lifestyle", "Skate"),
    "Ski-Mask": ("Facewear", "Ski Mask"),
    "Sport-Outfit": ("Outfit", "Sport"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--seed", type=int, default=20260821, help="Seed controlling artwork tiers and token order")
    parser.add_argument("--image-base-uri", default="ipfs://ARTWORK_FOLDER_CID/")
    parser.add_argument("--name", default="CapyCrew Genesis")
    parser.add_argument("--description", default="A mellow onchain collection of CapyCrew characters.")
    parser.add_argument("--force", action="store_true", help="Replace existing generated output")
    return parser.parse_args()


def slug_from_filename(filename: str) -> str:
    stem = Path(filename).stem.replace("…", "")
    stem = re.sub(r"_20\d{10}(?: \(\d+\))?$", "", stem)
    stem = re.sub(r"[^a-zA-Z0-9]+", " ", stem).strip()
    return stem.title() or "CapyCrew Artwork"


def filename_traits(filename: str) -> list[dict[str, object]]:
    lower = filename.lower()
    rules = (
        (r"spiderman", "Theme", "Superhero"),
        (r"high-tech|techwear|digital|interface", "Theme", "Tech"),
        (r"armored|diamond", "Theme", "Armored"),
        (r"graffiti|painting|artist", "Theme", "Street Art"),
        (r"detective", "Role", "Detective"),
        (r"firefighter", "Role", "Firefighter"),
        (r"donut", "Accessory", "Donuts"),
        (r"ticket", "Accessory", "Glowing Ticket"),
        (r"card|tag", "Accessory", "Glowing Card"),
    )
    result = []
    for pattern, trait_type, value in rules:
        if re.search(pattern, lower):
            result.append({"trait_type": trait_type, "value": value})
    return result


def discover_artworks(asset_root: Path) -> list[dict[str, object]]:
    artworks = []
    for folder in SOURCE_FOLDERS:
        folder_path = asset_root / folder
        if not folder_path.is_dir():
            raise SystemExit(f"Missing configured asset folder: {folder_path}")
        for path in sorted(folder_path.iterdir(), key=lambda item: item.name.casefold()):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                artworks.append({"source_folder": folder, "source_file": path.name, "source_path": path})
    return artworks


def assign_artwork_tiers(artworks: list[dict[str, object]], rng: random.Random) -> None:
    common = [art for art in artworks if art["source_folder"] == "Common"]
    epic = [art for art in artworks if art["source_folder"] == "Epic"]
    random_pool = [art for art in artworks if art["source_folder"] not in {"Common", "Epic"}]
    if len(random_pool) != sum(RANDOM_ARTWORK_POOL_SIZES.values()):
        raise SystemExit(
            f"Random pool has {len(random_pool)} artworks; expected "
            f"{sum(RANDOM_ARTWORK_POOL_SIZES.values())}. Update pool sizes after changing assets."
        )
    for art in common:
        art["rarity_tier"] = "Common"
    for art in epic:
        art["rarity_tier"] = "Epic"
    rng.shuffle(random_pool)
    offset = 0
    for tier, count in RANDOM_ARTWORK_POOL_SIZES.items():
        for art in random_pool[offset : offset + count]:
            art["rarity_tier"] = tier
        offset += count


def create_token_plan(artworks: list[dict[str, object]], rng: random.Random) -> list[dict[str, object]]:
    by_tier = defaultdict(list)
    for artwork in artworks:
        by_tier[artwork["rarity_tier"]].append(artwork)
    tokens = []
    for tier, quota in TIER_QUOTAS.items():
        pool = by_tier[tier]
        if not pool:
            raise SystemExit(f"No artwork assigned to tier {tier}")
        if tier == "One-of-One":
            if len(pool) != quota:
                raise SystemExit(f"One-of-One requires {quota} artworks, found {len(pool)}")
            selected = list(pool)
            rng.shuffle(selected)
        else:
            # Guarantee every assigned artwork appears, then fill the tier at random.
            selected = list(pool)
            selected.extend(rng.choices(pool, k=quota - len(pool)))
            rng.shuffle(selected)
        tokens.extend({"rarity_tier": tier, "artwork": art} for art in selected)
    if len(tokens) != TOTAL_SUPPLY:
        raise SystemExit(f"Generated {len(tokens)} token assignments, expected {TOTAL_SUPPLY}")
    rng.shuffle(tokens)
    return tokens


def clear_files(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for path in directory.iterdir():
        if path.is_file():
            path.unlink()


def main() -> None:
    args = parse_args()
    root = args.project_root.resolve()
    asset_root = root / "assets"
    output_root = root / "nft-assets" / "full-collection"
    image_dir = output_root / "images"
    metadata_dir = output_root / "metadata"
    manifest_dir = output_root / "manifests"
    existing = any(path.exists() and any(path.iterdir()) for path in (image_dir, metadata_dir, manifest_dir))
    if existing and not args.force:
        raise SystemExit(f"Generated output exists at {output_root}; pass --force to replace it")
    for directory in (image_dir, metadata_dir, manifest_dir):
        clear_files(directory)

    rng = random.Random(args.seed)
    artworks = discover_artworks(asset_root)
    if len(artworks) != 99:
        raise SystemExit(f"Expected 99 source artworks across configured folders, found {len(artworks)}")
    assign_artwork_tiers(artworks, rng)

    # Copy each source image only once under a safe canonical filename.
    artwork_manifest = []
    for artwork_id, artwork in enumerate(artworks, start=1):
        source_path = artwork["source_path"]
        canonical_name = f"art-{artwork_id:03d}{source_path.suffix.lower()}"
        destination = image_dir / canonical_name
        shutil.copy2(source_path, destination)
        artwork["artwork_id"] = artwork_id
        artwork["canonical_file"] = canonical_name
        artwork_manifest.append(
            {
                "artwork_id": artwork_id,
                "canonical_file": canonical_name,
                "source_folder": artwork["source_folder"],
                "source_file": artwork["source_file"],
                "rarity_tier": artwork["rarity_tier"],
                "rarity_weight": TIER_QUOTAS[artwork["rarity_tier"]],
                "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
            }
        )

    token_plan = create_token_plan(artworks, rng)
    token_manifest = []
    usage = Counter()
    for token_id, assignment in enumerate(token_plan, start=1):
        artwork = assignment["artwork"]
        tier = assignment["rarity_tier"]
        usage[artwork["artwork_id"]] += 1
        attributes = [
            {"trait_type": "Artwork", "value": slug_from_filename(artwork["source_file"])},
            {"trait_type": "Rarity Tier", "value": tier},
            {"trait_type": "Rarity Weight", "value": TIER_QUOTAS[tier]},
            {"trait_type": "Source Collection", "value": artwork["source_folder"]},
        ]
        folder_trait = FOLDER_TRAITS.get(artwork["source_folder"])
        if folder_trait:
            attributes.append({"trait_type": folder_trait[0], "value": folder_trait[1]})
        attributes.extend(filename_traits(artwork["source_file"]))
        metadata = {
            "name": f"{args.name} #{token_id}",
            "description": args.description,
            "image": f"{args.image_base_uri.rstrip('/')}/{artwork['canonical_file']}",
            "edition": token_id,
            "attributes": attributes,
            "properties": {
                "artwork_id": artwork["artwork_id"],
                "source_folder": artwork["source_folder"],
                "source_file": artwork["source_file"],
                "rarity_weight": TIER_QUOTAS[tier],
                "generation_seed": args.seed,
            },
        }
        (metadata_dir / f"{token_id}.json").write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        token_manifest.append(
            {
                "token_id": token_id,
                "artwork_id": artwork["artwork_id"],
                "image_file": artwork["canonical_file"],
                "rarity_tier": tier,
            }
        )

    tier_counts = Counter(item["rarity_tier"] for item in token_manifest)
    if dict(tier_counts) != TIER_QUOTAS:
        raise SystemExit(f"Tier validation failed: {dict(tier_counts)}")
    if set(usage) != {art["artwork_id"] for art in artworks}:
        raise SystemExit("At least one source artwork was not used")

    (manifest_dir / "artworks.json").write_text(
        json.dumps(artwork_manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    with (manifest_dir / "artwork-tier-map.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=(
                "artwork_id",
                "canonical_file",
                "source_folder",
                "source_file",
                "rarity_tier",
                "rarity_weight",
                "sha256",
            ),
        )
        writer.writeheader()
        writer.writerows(artwork_manifest)
    (manifest_dir / "tokens.json").write_text(
        json.dumps(token_manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    summary = {
        "collection": args.name,
        "total_supply": TOTAL_SUPPLY,
        "generation_seed": args.seed,
        "source_artwork_count": len(artworks),
        "source_folders": list(SOURCE_FOLDERS),
        "locked_source_tiers": {"Common": "Common", "Epic": "Epic"},
        "random_artwork_pool_sizes": RANDOM_ARTWORK_POOL_SIZES,
        "token_tier_quotas": TIER_QUOTAS,
        "artwork_usage_min": min(usage.values()),
        "artwork_usage_max": max(usage.values()),
        "image_base_uri": args.image_base_uri,
    }
    (manifest_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Generated {TOTAL_SUPPLY} metadata files using {len(artworks)} canonical artworks.")
    print("Tier totals:", dict(tier_counts))


if __name__ == "__main__":
    main()
