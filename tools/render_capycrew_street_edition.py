"""Render a second, streetwear-focused CapyCrew concept collection."""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from render_capycrew_concepts import (
    add_text,
    clear_scene,
    cone,
    cylinder,
    hex_rgba,
    point_camera,
    rounded_cube,
    smooth,
    sphere,
    torus,
)


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "visuals" / "capycrew-street-edition"


VARIANTS = [
    {"slug": "01_rose_scholar", "role": "ROSE SCHOLAR", "bg": "#3D2834", "accent": "#E7A8BF", "cloth": "#BA668C", "style": "cap_glasses"},
    {"slug": "02_frost_hype", "role": "FROST HYPE", "bg": "#202326", "accent": "#F3F0E8", "cloth": "#D6D1C7", "style": "sherpa_shades"},
    {"slug": "03_noir_signal", "role": "NOIR SIGNAL", "bg": "#0C0D10", "accent": "#FF7A24", "cloth": "#15181D", "style": "headphones"},
    {"slug": "04_ivory_phantom", "role": "IVORY PHANTOM", "bg": "#D8D4CB", "accent": "#5C493F", "cloth": "#5C493F", "style": "ribbed_mask"},
    {"slug": "05_chrome_broker", "role": "CHROME BROKER", "bg": "#192632", "accent": "#50D8E8", "cloth": "#6E8795", "style": "chrome_visor"},
    {"slug": "06_ember_courier", "role": "EMBER COURIER", "bg": "#341B15", "accent": "#FF642D", "cloth": "#A73F2D", "style": "utility_cap"},
    {"slug": "07_moss_syndicate", "role": "MOSS SYNDICATE", "bg": "#1E2A22", "accent": "#A2C46B", "cloth": "#536B4A", "style": "utility_beanie"},
    {"slug": "08_civic_tailor", "role": "CIVIC TAILOR", "bg": "#201F2A", "accent": "#D9B36C", "cloth": "#242832", "style": "monocle_blazer"},
    {"slug": "09_pixel_racer", "role": "PIXEL RACER", "bg": "#241B2E", "accent": "#E84B9B", "cloth": "#263D72", "style": "racing_goggles"},
    {"slug": "10_cloud_nomad", "role": "CLOUD NOMAD", "bg": "#B7C8D2", "accent": "#FFFFFF", "cloth": "#E4EEF0", "style": "scarf_earbuds"},
]


def textured_material(name: str, color: str, *, scale: float, bump_strength: float, roughness: float = 0.55, metallic: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 2.4
    noise.inputs["Roughness"].default_value = 0.72
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.08
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def solid_material(name: str, color: str, *, roughness: float = 0.42, metallic: float = 0.0, emission: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = hex_rgba(color)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def add_glasses(accent, lens, *, y=-1.07, z=2.34, scale=1.0):
    rounded_cube("Left lens", (-0.36 * scale, y, z), (0.29 * scale, 0.055, 0.16 * scale), lens, bevel=0.10)
    rounded_cube("Right lens", (0.36 * scale, y, z), (0.29 * scale, 0.055, 0.16 * scale), lens, bevel=0.10)
    cylinder("Glasses bridge", (0, y - 0.025, z), 0.026, 0.22 * scale, accent, rotation=(0, math.radians(90), 0))


def add_round_glasses(frame, lens):
    for x in (-0.35, 0.35):
        sphere("Tinted round lens", (x, -1.06, 2.38), (0.22, 0.025, 0.20), lens)
        torus("Round glasses frame", (x, -1.09, 2.38), 0.235, 0.028, frame, rotation=(math.radians(90), 0, 0))
    cylinder("Round glasses bridge", (0, -1.10, 2.38), 0.022, 0.24, frame, rotation=(0, math.radians(90), 0))


def add_chain(accent, medallion):
    torus("Chain", (0, -0.02, 1.68), 0.72, 0.035, accent)
    sphere("Medallion", (0, -0.74, 1.52), (0.16, 0.06, 0.16), medallion)
    torus("Medallion ring", (0, -0.80, 1.52), 0.11, 0.025, accent, rotation=(math.radians(90), 0, 0))


def create_character(variant: dict, index: int):
    fur = textured_material("Short fur", "#9A6745", scale=48, bump_strength=0.18, roughness=0.78)
    fur_dark = textured_material("Muzzle fur", "#67432F", scale=55, bump_strength=0.15, roughness=0.82)
    eye = solid_material("Eyes", "#0B0D12", roughness=0.18)
    white = solid_material("Eye glints", "#FFFDF5", roughness=0.25)
    cloth = textured_material("Streetwear fabric", variant["cloth"], scale=105, bump_strength=0.12, roughness=0.68)
    accent = solid_material("Accent", variant["accent"], metallic=0.18, roughness=0.28, emission=0.08)
    ink = solid_material("Ink", "#101216", roughness=0.22)
    metal = solid_material("Brushed metal", "#B9C2C7", roughness=0.22, metallic=0.86)

    sphere("Shoulders", (0, 0.08, 1.03), (1.42, 0.82, 0.98), cloth)
    sphere("Head", (0, -0.04, 2.25), (1.02, 0.75, 0.84), fur)
    sphere("Muzzle", (0, -0.66, 2.05), (0.68, 0.40, 0.42), fur_dark)
    sphere("Left ear", (-0.67, -0.02, 2.83), (0.25, 0.18, 0.30), fur_dark)
    sphere("Right ear", (0.67, -0.02, 2.83), (0.25, 0.18, 0.30), fur_dark)
    sphere("Left eye", (-0.33, -0.72, 2.38), (0.095, 0.052, 0.11), eye)
    sphere("Right eye", (0.33, -0.72, 2.38), (0.095, 0.052, 0.11), eye)
    sphere("Left glint", (-0.30, -0.77, 2.43), (0.025, 0.014, 0.025), white)
    sphere("Right glint", (0.36, -0.77, 2.43), (0.025, 0.014, 0.025), white)
    sphere("Nose", (0, -1.00, 2.08), (0.23, 0.13, 0.16), eye)
    sphere("Left paw", (-0.78, -0.61, 1.02), (0.31, 0.23, 0.43), fur)
    sphere("Right paw", (0.78, -0.61, 1.02), (0.31, 0.23, 0.43), fur)

    style = variant["style"]
    if style in {"cap_glasses", "utility_cap"}:
        sphere("Cap crown", (0, -0.24, 3.00), (0.82, 0.61, 0.36), cloth)
        rounded_cube("Cap brim", (0, -0.58, 2.87), (0.62, 0.30, 0.07), accent, bevel=0.08)
        sphere("Cap button", (0, -0.24, 3.36), (0.07, 0.06, 0.06), accent)
        if style == "cap_glasses":
            torus("Hood collar", (0, 0.06, 1.76), 0.80, 0.16, cloth)
            add_round_glasses(accent, solid_material("Rose lenses", "#6D435D", roughness=0.24))
            add_chain(accent, accent)
        else:
            rounded_cube("Utility patch", (0, -0.78, 1.48), (0.30, 0.045, 0.18), accent, bevel=0.06)
            torus("Utility collar", (0, 0.02, 1.72), 0.68, 0.12, ink)
    elif style == "sherpa_shades":
        sphere("Sherpa hood", (0, 0.12, 2.25), (1.10, 0.82, 0.92), cloth)
        sphere("Face opening", (0, -0.75, 2.25), (0.78, 0.07, 0.61), fur)
        sphere("Sherpa collar", (0, -0.03, 1.82), (1.02, 0.80, 0.30), cloth)
        add_glasses(accent, ink, scale=1.10)
        torus("Backwards cap", (0, 0.48, 2.94), 0.62, 0.10, cloth, rotation=(0, 0, 0))
        add_chain(metal, metal)
    elif style == "headphones":
        torus("Headphone band", (0, 0.18, 2.40), 1.03, 0.10, ink, rotation=(math.radians(90), 0, 0))
        cylinder("Left ear cup", (-0.91, -0.05, 2.29), 0.28, 0.16, accent, rotation=(0, math.radians(90), 0))
        cylinder("Right ear cup", (0.91, -0.05, 2.29), 0.28, 0.16, accent, rotation=(0, math.radians(90), 0))
        add_glasses(accent, solid_material("Amber lenses", "#C85A1D", roughness=0.18), scale=1.05)
        rounded_cube("Signal patch", (0, -0.78, 1.50), (0.32, 0.045, 0.19), accent, bevel=0.05)
    elif style == "ribbed_mask":
        mask = textured_material("Ribbed mask", "#B5ADA1", scale=135, bump_strength=0.30, roughness=0.88)
        sphere("Ribbed hood", (0, 0.02, 2.30), (1.07, 0.79, 0.90), mask)
        sphere("Mask muzzle", (0, -0.76, 2.04), (0.70, 0.08, 0.43), mask)
        sphere("Mask left eye", (-0.33, -0.84, 2.38), (0.14, 0.03, 0.16), eye)
        sphere("Mask right eye", (0.33, -0.84, 2.38), (0.14, 0.03, 0.16), eye)
        rounded_cube("Tailored shoulder", (0, -0.66, 1.35), (1.08, 0.07, 0.12), variant_mat := solid_material("Tailor seam", variant["cloth"], roughness=0.45), bevel=0.05)
        torus("Neck seam", (0, -0.02, 1.72), 0.72, 0.045, accent)
    elif style == "chrome_visor":
        rounded_cube("Chrome visor", (0, -0.82, 2.39), (0.65, 0.055, 0.17), accent, bevel=0.10)
        torus("Chrome ear cuff L", (-0.82, -0.02, 2.38), 0.22, 0.06, metal, rotation=(math.radians(90), 0, 0))
        torus("Chrome ear cuff R", (0.82, -0.02, 2.38), 0.22, 0.06, metal, rotation=(math.radians(90), 0, 0))
        add_chain(metal, accent)
    elif style == "utility_beanie":
        beanie = textured_material("Ribbed beanie", variant["cloth"], scale=145, bump_strength=0.24, roughness=0.92)
        sphere("Beanie", (0, 0.0, 2.96), (0.84, 0.64, 0.40), beanie)
        torus("Beanie cuff", (0, -0.02, 2.83), 0.73, 0.09, accent)
        rounded_cube("Utility vest", (0, -0.76, 1.28), (0.74, 0.06, 0.56), cloth, bevel=0.10)
        rounded_cube("Vest pocket", (0.44, -0.84, 1.31), (0.20, 0.04, 0.22), accent, bevel=0.05)
    elif style == "monocle_blazer":
        shirt = solid_material("Shirt", "#101216", roughness=0.45)
        rounded_cube("Shirt panel", (0, -0.75, 1.30), (0.40, 0.06, 0.62), shirt, bevel=0.05)
        for side in (-1, 1):
            lapel = rounded_cube("Blazer lapel", (side * 0.38, -0.80, 1.42), (0.22, 0.05, 0.58), cloth, bevel=0.05)
            lapel.rotation_euler[1] = math.radians(side * 18)
        torus("Monocle", (0.34, -0.82, 2.38), 0.20, 0.035, accent, rotation=(math.radians(90), 0, 0))
        cylinder("Monocle arm", (0.20, -0.80, 2.15), 0.018, 0.42, accent, rotation=(math.radians(22), 0, 0))
        add_chain(accent, accent)
    elif style == "racing_goggles":
        sphere("Racing helmet", (0, 0.02, 2.91), (0.88, 0.66, 0.38), cloth)
        rounded_cube("Helmet stripe", (0, -0.61, 2.97), (0.13, 0.05, 0.35), accent, bevel=0.05)
        add_glasses(accent, ink, scale=1.22, z=2.36)
        rounded_cube("Racing chest stripe", (0, -0.80, 1.30), (0.70, 0.04, 0.08), accent, bevel=0.03)
        rounded_cube("Racing chest stripe 2", (0, -0.81, 1.12), (0.50, 0.04, 0.05), white, bevel=0.02)
    elif style == "scarf_earbuds":
        scarf = textured_material("Soft scarf", variant["cloth"], scale=90, bump_strength=0.17, roughness=0.88)
        torus("Scarf wrap", (0, -0.02, 1.78), 0.78, 0.18, scarf)
        rounded_cube("Scarf tail", (0.50, -0.64, 1.18), (0.17, 0.05, 0.52), scarf, bevel=0.06)
        torus("Left earbud", (-0.74, -0.20, 2.36), 0.12, 0.04, accent, rotation=(math.radians(90), 0, 0))
        torus("Right earbud", (0.74, -0.20, 2.36), 0.12, 0.04, accent, rotation=(math.radians(90), 0, 0))
        add_glasses(accent, solid_material("Cloud lenses", "#A9B8C0", roughness=0.20), scale=0.90)


def create_stage(variant: dict, index: int):
    bg = solid_material("Backdrop", variant["bg"], roughness=0.92)
    accent = solid_material("Backdrop accent", variant["accent"], roughness=0.35, emission=0.05)
    black = solid_material("Backdrop ink", "#101216", roughness=0.45)
    rounded_cube("Backdrop wall", (0, 1.8, 2.0), (3.45, 0.10, 3.4), bg, bevel=0.18)
    rounded_cube("Studio floor", (0, 0.45, -0.18), (3.45, 2.5, 0.18), bg, bevel=0.12)
    rounded_cube("Accent strip", (-2.25, 1.55, 2.0), (0.035, 0.04, 2.1), accent, bevel=0.02)
    rounded_cube("Accent strip", (2.25, 1.55, 2.0), (0.035, 0.04, 2.1), accent, bevel=0.02)

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.5, 5.3))
    key = bpy.context.object
    key.data.energy = 900
    key.data.size = 4.2
    key.data.color = hex_rgba("#FFF0E3")[:3]
    point_camera(key, (0, 0, 2.0))
    bpy.ops.object.light_add(type="AREA", location=(3.8, -2.0, 3.5))
    fill = bpy.context.object
    fill.data.energy = 560
    fill.data.size = 3.4
    fill.data.color = hex_rgba(variant["accent"])[:3]
    point_camera(fill, (0, 0, 2.0))
    bpy.ops.object.light_add(type="AREA", location=(0, 2.5, 4.6))
    rim = bpy.context.object
    rim.data.energy = 820
    rim.data.size = 2.8
    rim.data.color = hex_rgba(variant["accent"])[:3]
    point_camera(rim, (0, 0, 2.15))

    side = -2.0 if index % 2 else 2.0
    bpy.ops.object.camera_add(location=(side, -7.6, 2.55))
    camera = bpy.context.object
    camera.data.lens = 72
    camera.data.sensor_width = 36
    point_camera(camera, (0, 0, 2.05))
    bpy.context.scene.camera = camera


def configure_render(output_path: Path):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.filepath = str(output_path)
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.005, 0.005, 0.006)


def render_variant(variant: dict, index: int):
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


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index in requested_indices():
        render_variant(VARIANTS[index - 1], index)


if __name__ == "__main__":
    main()
