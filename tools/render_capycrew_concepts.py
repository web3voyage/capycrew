"""Render ten procedural CapyCrew NFT concept images with Blender Cycles."""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "visuals" / "capycrew"


VARIANTS = [
    {
        "slug": "01_neon_delegate",
        "role": "NEON DELEGATE",
        "bg": "#171B2B",
        "accent": "#38D9FF",
        "accent_2": "#B8FF3D",
        "cloth": "#5B3DF5",
        "accessory": "visor",
    },
    {
        "slug": "02_garden_steward",
        "role": "GARDEN STEWARD",
        "bg": "#12372A",
        "accent": "#B8FF3D",
        "accent_2": "#FFCE54",
        "cloth": "#167D5B",
        "accessory": "leaves",
    },
    {
        "slug": "03_signal_hacker",
        "role": "SIGNAL HACKER",
        "bg": "#20142D",
        "accent": "#FF4FD8",
        "accent_2": "#38D9FF",
        "cloth": "#111318",
        "accessory": "headphones",
    },
    {
        "slug": "04_treasury_keeper",
        "role": "TREASURY KEEPER",
        "bg": "#271B12",
        "accent": "#FFCE54",
        "accent_2": "#FF7A3D",
        "cloth": "#263C59",
        "accessory": "crown",
    },
    {
        "slug": "05_night_scout",
        "role": "NIGHT SCOUT",
        "bg": "#0B1D35",
        "accent": "#5FA8FF",
        "accent_2": "#F4F7FF",
        "cloth": "#183A66",
        "accessory": "beanie",
    },
    {
        "slug": "06_festival_host",
        "role": "FESTIVAL HOST",
        "bg": "#42162D",
        "accent": "#FF5A5F",
        "accent_2": "#FFD23F",
        "cloth": "#F02D7D",
        "accessory": "party",
    },
    {
        "slug": "07_chain_architect",
        "role": "CHAIN ARCHITECT",
        "bg": "#132A33",
        "accent": "#38D9FF",
        "accent_2": "#FFCE54",
        "cloth": "#176B87",
        "accessory": "hardhat",
    },
    {
        "slug": "08_civic_archivist",
        "role": "CIVIC ARCHIVIST",
        "bg": "#3A2031",
        "accent": "#FF9EB5",
        "accent_2": "#F6E7CB",
        "cloth": "#743B69",
        "accessory": "beret",
    },
    {
        "slug": "09_foundry_navigator",
        "role": "FOUNDRY NAVIGATOR",
        "bg": "#3A1B14",
        "accent": "#FF7A3D",
        "accent_2": "#38D9FF",
        "cloth": "#C5492D",
        "accessory": "cap",
    },
    {
        "slug": "10_council_chair",
        "role": "COUNCIL CHAIR",
        "bg": "#231B38",
        "accent": "#B9A3FF",
        "accent_2": "#FFCE54",
        "cloth": "#51338A",
        "accessory": "laurel",
    },
]


def hex_rgba(value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)) + (alpha,)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.materials, bpy.data.curves, bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def material(
    name: str,
    color: str,
    *,
    metallic: float = 0.0,
    roughness: float = 0.45,
    emission: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = hex_rgba(color)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = hex_rgba(color)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def smooth(obj: bpy.types.Object) -> None:
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def sphere(name: str, location, scale, mat) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def rounded_cube(name: str, location, scale, mat, bevel: float = 0.12) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Rounded edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 4
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def cylinder(name: str, location, radius, depth, mat, rotation=(0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def torus(name: str, location, major_radius, minor_radius, mat, rotation=(0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def cone(name: str, location, radius1, radius2, depth, mat, rotation=(0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=32,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def add_text(body: str, location, size: float, mat, *, extrude: float = 0.018) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"Text {body}", "FONT")
    curve.body = body
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = 0.004
    obj = bpy.data.objects.new(body, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (math.radians(90), 0, 0)
    obj.data.materials.append(mat)
    return obj


def add_leaf(location, rotation, scale, mat) -> None:
    obj = sphere("Laurel leaf", location, scale, mat)
    obj.rotation_euler = rotation


def create_character(variant: dict, index: int) -> None:
    fur = material("Warm capybara fur", "#A96F45", roughness=0.72)
    fur_dark = material("Dark fur", "#6E422B", roughness=0.75)
    eye = material("Eyes", "#111318", roughness=0.18)
    white = material("Highlights", "#FFFDF5", roughness=0.35)
    cloth = material("Role uniform", variant["cloth"], roughness=0.5)
    accent = material("Primary accent", variant["accent"], metallic=0.25, roughness=0.28, emission=0.12)
    accent_2 = material("Secondary accent", variant["accent_2"], metallic=0.45, roughness=0.25)

    sphere("Uniform torso", (0, 0.05, 1.25), (1.13, 0.78, 1.15), cloth)
    sphere("Head", (0, -0.05, 2.45), (1.02, 0.76, 0.82), fur)
    sphere("Muzzle", (0, -0.68, 2.25), (0.70, 0.39, 0.42), fur_dark)
    sphere("Left ear", (-0.65, -0.08, 3.02), (0.26, 0.18, 0.29), fur_dark)
    sphere("Right ear", (0.65, -0.08, 3.02), (0.26, 0.18, 0.29), fur_dark)
    sphere("Left eye", (-0.34, -0.73, 2.58), (0.095, 0.055, 0.11), eye)
    sphere("Right eye", (0.34, -0.73, 2.58), (0.095, 0.055, 0.11), eye)
    sphere("Left eye glint", (-0.31, -0.78, 2.63), (0.025, 0.018, 0.025), white)
    sphere("Right eye glint", (0.37, -0.78, 2.63), (0.025, 0.018, 0.025), white)
    sphere("Nose", (0, -1.02, 2.28), (0.24, 0.13, 0.16), eye)
    sphere("Left paw", (-0.76, -0.68, 1.22), (0.28, 0.23, 0.38), fur)
    sphere("Right paw", (0.76, -0.68, 1.22), (0.28, 0.23, 0.38), fur)

    rounded_cube("Membership badge", (0, -0.82, 1.55), (0.34, 0.055, 0.28), accent_2, bevel=0.08)
    torus("Badge ring", (0, -0.89, 1.55), 0.16, 0.035, accent, rotation=(math.radians(90), 0, 0))
    add_text(f"{index:02d}", (0, -0.945, 1.55), 0.18, eye, extrude=0.01)

    accessory = variant["accessory"]
    if accessory == "visor":
        rounded_cube("Neon visor", (0, -0.82, 2.61), (0.62, 0.05, 0.14), accent, bevel=0.10)
        torus("Left earpiece", (-0.83, -0.08, 2.48), 0.24, 0.08, accent_2, rotation=(math.radians(90), 0, 0))
        torus("Right earpiece", (0.83, -0.08, 2.48), 0.24, 0.08, accent_2, rotation=(math.radians(90), 0, 0))
    elif accessory == "leaves":
        for side in (-1, 1):
            for step in range(4):
                add_leaf(
                    (side * (0.25 + step * 0.15), -0.2, 3.13 - step * 0.02),
                    (0, math.radians(side * (20 + step * 8)), math.radians(side * 25)),
                    (0.18, 0.08, 0.34),
                    accent,
                )
        sphere("Council seed", (0, -0.26, 3.22), (0.15, 0.1, 0.15), accent_2)
    elif accessory == "headphones":
        torus("Headphone band", (0, -0.02, 2.63), 0.92, 0.09, accent, rotation=(math.radians(90), 0, 0))
        cylinder("Left headphone", (-0.88, -0.13, 2.48), 0.22, 0.14, accent_2, rotation=(0, math.radians(90), 0))
        cylinder("Right headphone", (0.88, -0.13, 2.48), 0.22, 0.14, accent_2, rotation=(0, math.radians(90), 0))
    elif accessory == "crown":
        cylinder("Crown band", (0, -0.05, 3.13), 0.60, 0.23, accent_2)
        for x in (-0.42, -0.14, 0.14, 0.42):
            cone("Crown point", (x, -0.05, 3.42), 0.16, 0.02, 0.45, accent_2)
        sphere("Crown jewel", (0, -0.61, 3.16), (0.10, 0.05, 0.13), accent)
    elif accessory == "beanie":
        sphere("Beanie", (0, 0.0, 3.02), (0.83, 0.63, 0.38), cloth)
        torus("Beanie cuff", (0, -0.02, 2.92), 0.73, 0.10, accent, rotation=(0, 0, 0))
        sphere("Beanie pom", (0, 0.0, 3.45), (0.18, 0.18, 0.18), accent_2)
    elif accessory == "party":
        cone("Festival hat", (0.25, -0.02, 3.38), 0.42, 0.03, 0.88, accent)
        sphere("Hat pom", (0.25, -0.02, 3.84), (0.12, 0.12, 0.12), accent_2)
        rounded_cube("Left shades", (-0.35, -0.82, 2.59), (0.28, 0.04, 0.15), accent_2, bevel=0.10)
        rounded_cube("Right shades", (0.35, -0.82, 2.59), (0.28, 0.04, 0.15), accent_2, bevel=0.10)
        cylinder("Shades bridge", (0, -0.85, 2.59), 0.025, 0.20, accent_2, rotation=(0, math.radians(90), 0))
    elif accessory == "hardhat":
        sphere("Hard hat", (0, -0.02, 3.03), (0.84, 0.64, 0.42), accent_2)
        rounded_cube("Hard hat brim", (0, -0.48, 2.98), (0.88, 0.24, 0.08), accent_2, bevel=0.08)
        rounded_cube("Blueprint tablet", (0.66, -0.82, 1.10), (0.34, 0.055, 0.48), accent, bevel=0.07)
    elif accessory == "beret":
        sphere("Beret", (-0.08, -0.01, 3.09), (0.82, 0.60, 0.24), cloth)
        sphere("Beret stem", (-0.12, -0.02, 3.38), (0.07, 0.07, 0.10), accent)
        for x in (-0.35, 0.35):
            torus("Archive glasses", (x, -0.80, 2.58), 0.22, 0.035, accent_2, rotation=(math.radians(90), 0, 0))
        cylinder("Glasses bridge", (0, -0.82, 2.58), 0.025, 0.22, accent_2, rotation=(0, math.radians(90), 0))
    elif accessory == "cap":
        sphere("Navigator cap", (0, -0.02, 3.08), (0.79, 0.60, 0.34), cloth)
        rounded_cube("Cap brim", (0, -0.60, 3.01), (0.60, 0.34, 0.07), accent, bevel=0.08)
        sphere("Compass mark", (0, -0.59, 3.15), (0.11, 0.05, 0.11), accent_2)
    elif accessory == "laurel":
        for side in (-1, 1):
            for step in range(5):
                angle = math.radians(side * (20 + step * 12))
                add_leaf(
                    (side * (0.24 + step * 0.13), -0.22, 3.12 - step * 0.035),
                    (0, angle, math.radians(side * 34)),
                    (0.17, 0.075, 0.32),
                    accent_2,
                )
        rounded_cube("Council mantle", (0, 0.02, 1.85), (1.22, 0.76, 0.18), accent, bevel=0.14)


def point_camera(camera: bpy.types.Object, target) -> None:
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def create_stage(variant: dict, index: int) -> None:
    bg = material("Backdrop", variant["bg"], roughness=0.85)
    ink = material("Ink", "#111318", roughness=0.35)
    white = material("Warm white", "#FFFDF5", roughness=0.35, emission=0.08)
    accent = material("Stage accent", variant["accent"], metallic=0.15, roughness=0.30, emission=0.12)
    accent_2 = material("Stage secondary", variant["accent_2"], metallic=0.2, roughness=0.30)

    rounded_cube("Backdrop panel", (0, 1.75, 2.0), (3.75, 0.12, 3.75), bg, bevel=0.22)
    rounded_cube("Ground", (0, 0.35, -0.15), (3.75, 2.6, 0.15), bg, bevel=0.15)
    torus("Community halo", (0, 1.48, 2.15), 1.65, 0.065, accent, rotation=(math.radians(90), 0, 0))
    torus("Council orbit", (0, 1.45, 2.15), 2.10, 0.025, accent_2, rotation=(math.radians(90), 0, 0))
    rounded_cube("Left color rail", (-2.42, 1.42, 2.0), (0.09, 0.08, 2.45), accent, bevel=0.06)
    rounded_cube("Right color rail", (2.42, 1.42, 2.0), (0.09, 0.08, 2.45), accent_2, bevel=0.06)
    rounded_cube("Role plate", (0, -0.86, 0.27), (1.72, 0.055, 0.24), ink, bevel=0.08)
    add_text(variant["role"], (0, -0.925, 0.29), 0.20, white, extrude=0.008)
    add_text(f"CAPYCREW  /  PASS {index:02d}", (0, -0.88, 4.12), 0.18, white, extrude=0.008)

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.0, 5.6))
    key = bpy.context.object
    key.data.energy = 1050
    key.data.shape = "DISK"
    key.data.size = 4.0
    key.data.color = hex_rgba("#FFF0D8")[:3]
    point_camera(key, (0, 0, 1.7))

    bpy.ops.object.light_add(type="AREA", location=(3.4, -2.0, 3.4))
    fill = bpy.context.object
    fill.data.energy = 700
    fill.data.size = 3.0
    fill.data.color = hex_rgba(variant["accent"])[:3]
    point_camera(fill, (0, 0, 1.8))

    bpy.ops.object.light_add(type="AREA", location=(0, 2.4, 5.0))
    rim = bpy.context.object
    rim.data.energy = 950
    rim.data.size = 2.5
    rim.data.color = hex_rgba(variant["accent_2"])[:3]
    point_camera(rim, (0, 0, 2.0))

    bpy.ops.object.camera_add(location=(0, -8.7, 2.35))
    camera = bpy.context.object
    camera.data.lens = 58
    camera.data.sensor_width = 36
    point_camera(camera, (0, 0, 1.85))
    bpy.context.scene.camera = camera


def configure_render(output_path: Path) -> None:
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
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.006, 0.007, 0.009)


def render_variant(variant: dict, index: int) -> Path:
    clear_scene()
    create_stage(variant, index)
    create_character(variant, index)
    output = OUTPUT_DIR / f"{variant['slug']}.png"
    configure_render(output)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_DIR / f"{variant['slug']}.blend"))
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {output}", flush=True)
    return output


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
