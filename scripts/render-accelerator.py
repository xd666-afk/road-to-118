"""Render the stage images and beam coordinates from the accelerator hall .blend."""
import gzip
import json
import math
import sys
from struct import Struct
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

RADIUS = 33
BEAM_HEIGHT = 1.52
FIRST_ANGLE = math.radians(-94)
QUARTER = math.tau / 4
BAY_SPACING = math.tau / 44
SIZE = (1440, 900)

output = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
output.mkdir(parents=True, exist_ok=True)
overview, aisle = sorted(bpy.data.scenes, key=lambda scene: scene.name)
beamline = bpy.data.collections['02 · Stainless vacuum beamline']
beam = next(obj for obj in beamline.objects if obj.name == 'Beam vacuum vessel')
steel = beam.data.materials[0]
beam.hide_render = True


def sector(angle):
    return int(((angle - FIRST_ANGLE) % math.tau) / QUARTER)


def point(angle, z=BEAM_HEIGHT):
    return (RADIUS * math.cos(angle), RADIUS * math.sin(angle), z)


def position(obj):
    if obj.type == 'CURVE':
        return obj.matrix_world @ obj.data.splines[0].points[0].co.to_3d()
    return obj.matrix_world.translation


def bay_sector(obj):
    x, y, _ = position(obj)
    angle = round(math.atan2(y, x) / BAY_SPACING) * BAY_SPACING
    return sector(angle)


def make_segment(index):
    name = f'Web render · Beam pipe {index + 1}'
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = beam.data.bevel_depth
    curve.bevel_resolution = beam.data.bevel_resolution
    curve.use_fill_caps = True
    curve.materials.append(steel)
    spline = curve.splines.new('POLY')
    spline.points.add(96)
    for i, node in enumerate(spline.points):
        angle = FIRST_ANGLE + QUARTER * (index + i / 96)
        node.co = (*point(angle), 1)
    obj = bpy.data.objects.new(name, curve)
    beamline.objects.link(obj)
    return obj


sectors = [[], [], [], []]
for obj in bpy.data.collections['03 · Dipoles and quadrupoles'].objects:
    sectors[bay_sector(obj)].append(obj)
for obj in beamline.objects:
    if obj.name.startswith(('Bolted vacuum flange', 'Bellows convolution')):
        sectors[bay_sector(obj)].append(obj)
for prefix, index in [('04', 2), ('05', 3), ('06', 0), ('07', 1)]:
    collection = next(collection for collection in bpy.data.collections if collection.name.startswith(prefix + ' ·'))
    sectors[index].extend(collection.objects)
for index, objects in enumerate(sectors):
    objects.append(make_segment(index))

# Export the same Blender mesh groups for live WebGL. The game can show each
# completed section with one draw call, with common hall geometry shared.
def export_mesh():
    construction = {obj for objects in sectors for obj in objects}
    enclosure = next(c for c in bpy.data.collections if c.name.startswith('11 ·'))
    bpy.context.window.scene = overview
    enclosure_layer = bpy.context.view_layer.layer_collection.children[enclosure.name]
    exclude_enclosure = enclosure_layer.exclude
    enclosure_layer.exclude = False
    bpy.context.view_layer.update()
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    roof = list(enclosure.objects)
    permanent = [obj for obj in overview.objects
                 if obj not in construction and obj not in roof and obj != beam]
    vertex = Struct('<3h3b7B')
    data = bytearray()
    groups = []
    for objects in [permanent, roof, *sectors]:
        first = len(data) // vertex.size
        for obj in objects:
            if obj.type not in ('CURVE', 'MESH', 'FONT'):
                continue
            evaluated = obj.evaluated_get(dependency_graph)
            mesh = evaluated.to_mesh()
            if mesh is None:
                continue
            try:
                mesh.calc_loop_triangles()
                transform = evaluated.matrix_world
                normal_transform = transform.to_3x3().inverted_safe().transposed()
                positions = [tuple(round(x * 256) for x in transform @ v.co) for v in mesh.vertices]
                normals = [tuple(round(x * 127) for x in (normal_transform @ v.vector).normalized())
                           for v in mesh.corner_normals]
                materials = []
                for material in mesh.materials:
                    shader = material.node_tree.nodes.get('Principled BSDF')
                    srgb = [round(255 * pow(max(0, v), 1/2.2)) for v in material.diffuse_color[:3]]
                    materials.append((*srgb, round(shader.inputs['Metallic'].default_value * 255),
                                      round(shader.inputs['Roughness'].default_value * 255),
                                      round(min(4, shader.inputs['Emission Strength'].default_value) * 63.75), 0))
                for triangle in mesh.loop_triangles:
                    material = materials[triangle.material_index]
                    for index, loop_index in zip(triangle.vertices, triangle.loops):
                        coordinates = positions[index]
                        if max(map(abs, coordinates)) >= 32768:
                            raise ValueError(f'Mesh outside packed coordinate range: {obj.name}')
                        data.extend(vertex.pack(*coordinates, *normals[loop_index], *material))
            finally:
                evaluated.to_mesh_clear()
        groups.append([first, len(data) // vertex.size - first])
    enclosure_layer.exclude = exclude_enclosure
    if any(count == 0 for _, count in groups):
        raise ValueError(f'Empty scene mesh group in {groups}')
    mesh_file = Path(__file__).resolve().parents[1] / 'src/data/accelerator.mesh'
    mesh_file.write_bytes(gzip.compress(data, mtime=0))
    return groups


for scene in [overview, aisle]:
    scene.render.resolution_x, scene.render.resolution_y = SIZE
    scene.cycles.samples = 14
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 88


def project(world_pos):
    p = world_to_camera_view(overview, overview.camera, Vector(world_pos))
    return [round(p.x * SIZE[0], 1), round((1 - p.y) * SIZE[1], 1)]


path = [project(point(math.radians(148) + math.tau * i / 200, BEAM_HEIGHT + .34)) for i in range(201)]
markers = [project(point(FIRST_ANGLE + QUARTER * (i + .5), BEAM_HEIGHT + 2.4)) for i in range(4)]
geometry = {'width': SIZE[0], 'height': SIZE[1], 'markers': markers,
            'beam': 'M' + ' L'.join(' '.join(map(str, pt)) for pt in path),
            'anchors': [point(FIRST_ANGLE + QUARTER * (i + .5), BEAM_HEIGHT + 2.4) for i in range(4)]}
geometry['groups'] = export_mesh()
geometry_file = Path(__file__).resolve().parents[1] / 'src/data/acceleratorGeometry.json'
geometry_file.write_text(json.dumps(geometry) + '\n', encoding='utf-8')
if '--mesh-only' in sys.argv:
    sys.exit(0)

for built in range(5):
    for i, objects in enumerate(sectors):
        for obj in objects:
            obj.hide_render = i >= built
    for scene, view in [(overview, 'plan'), (aisle, 'aisle')]:
        scene.render.filepath = str(output / f'{view}-{built}.webp')
        bpy.ops.render.render(scene=scene.name, write_still=True)
