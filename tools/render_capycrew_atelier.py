"""Render the CapyCrew Atelier Genesis collection and a clean share hero."""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from render_capycrew_concepts import clear_scene, hex_rgba, point_camera, rounded_cube, sphere
from render_capycrew_street_edition import create_character, solid_material


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "visuals" / "capycrew-atelier"


VARIANTS = [
    {"slug": "01_signature_genesis", "role": "SIGNATURE GENESIS", "bg": "#F5EFE6", "field": "#BF6D6A", "accent": "#C69A55", "cloth": "#20262D", "style": "monocle_blazer"},
    {"slug": "02_archive_rose", "role": "ARCHIVE ROSE", "bg": "#E4C9C1", "field": "#9A4F62", "accent": "#F2D5C4", "cloth": "#C68192", "style": "cap_glasses"},
    {"slug": "03_forest_operator", "role": "FOREST OPERATOR", "bg": "#15352C", "field": "#BFCB7A", "accent": "#D8E3A1", "cloth": "#3D5B4E", "style": "utility_beanie"},
    {"slug": "04_midnight_signal", "role": "MIDNIGHT SIGNAL", "bg": "#111722", "field": "#D09C55", "accent": "#F0B55F", "cloth": "#161A20", "style": "headphones"},
    {"slug": "05_cobalt_member", "role": "COBALT MEMBER", "bg": "#233A69", "field": "#F2D8B3", "accent": "#61D2E3", "cloth": "#2A4B9B", "style": "chrome_visor"},
    {"slug": "06_ember_council", "role": "EMBER COUNCIL", "bg": "#481E1A", "field": "#D96B45", "accent": "#F7B16B", "cloth": "#8E3027", "style": "utility_cap"},
    {"slug": "07_cream_tailor", "role": "CREAM TAILOR", "bg": "#F6F1E8", "field": "#1E302B", "accent": "#B99254", "cloth": "#B8A18D", "style": "monocle_blazer"},
    {"slug": "08_lilac_nomad", "role": "LILAC NOMAD", "bg": "#D9D0DD", "field": "#6D5B87", "accent": "#F4EFF8", "cloth": "#B4A1C3", "style": "scarf_earbuds"},
    {"slug": "09_silver_relay", "role": "SILVER RELAY", "bg": "#A7B3BD", "field": "#D75574", "accent": "#F19FC1", "cloth": "#525F6B", "style": "racing_goggles"},
    {"slug": "10_golden_steward", "role": "GOLDEN STEWARD", "bg": "#C9A45E", "field": "#213B35", "accent": "#F2D38B", "cloth": "#3B5D4C", "style": "ribbed_mask"},
]


def create_stage(variant: dict, index: int) -> None:
    bg = solid_material("Atelier backdrop", variant["bg"], roughness=0.92)
    field = solid_material("Atelier field", variant["field"], roughness=0.76)
    accent = solid_material("Atelier highlight", variant["accent"], roughness=0.36, emission=0.025)

    rounded_cube("Backdrop", (0, 1.85, 2.0), (3.6, 0.12, 3.55), bg, bevel=0.22)
    rounded_cube("Floor", (0, 0.4, -0.18), (3.6, 2.5, 0.18), bg, bevel=0.14)

    offset = 1.12 if index % 2 else -1.12
    sphere("Editorial color field", (offset, 1.57, 2.15), (1.38, 0.07, 1.92), field)
    rounded_cube("Signature line", (-offset * 1.85, 1.48, 2.0), (0.035, 0.035, 1.55), accent, bevel=0.02)

    bpy.ops.object.light_add(type="AREA", location=(-3.8, -4.3, 5.4))
    key = bpy.context.object
    key.data.energy = 820
    key.data.size = 4.4
    key.data.color = hex_rgba("#FFF0E2")[:3]
    point_camera(key, (0, 0, 2.0))

    bpy.ops.object.light_add(type="AREA", location=(3.6, -2.2, 3.4))
    fill = bpy.context.object
    fill.data.energy = 430
    fill.data.size = 3.6
    fill.data.color = hex_rgba(variant["accent"])[:3]
    point_camera(fill, (0, 0, 2.0))

    bpy.ops.object.light_add(type="AREA", location=(0, 2.6, 4.8))
    rim = bpy.context.object
    rim.data.energy = 760
    rim.data.size = 3.0
    rim.data.color = hex_rgba(variant["field"])[:3]
    point_camera(rim, (0, 0, 2.15))

    camera_x = -1.55 if index % 2 else 1.55
    bpy.ops.object.camera_add(location=(camera_x, -7.8, 2.55))
    camera = bpy.context.object
    camera.data.lens = 74
    camera.data.sensor_width = 36
    point_camera(camera, (0, 0, 2.04))
    bpy.context.scene.camera = camera


def configure_render(output_path: Path) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 18
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.filepath = str(output_path)
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.004, 0.004, 0.005)


def render_variant(variant: dict, index: int) -> None:
    clear_scene()
    create_stage(variant, index)
    create_character(variant, index)
    output = OUTPUT_DIR / f"{variant['slug']}.png"
    configure_render(output)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_DIR / f"{variant['slug']}.blend"))
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {output}", flush=True)


def requested_indices() -> list[int]:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if not args:
        return list(range(1, len(VARIANTS) + 1))
    indices = [int(value) for value in args]
    if any(index < 1 or index > len(VARIANTS) for index in indices):
        raise ValueError(f"variant indices must be between 1 and {len(VARIANTS)}")
    return indices


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index in requested_indices():
        render_variant(VARIANTS[index - 1], index)


if __name__ == "__main__":
    main()
