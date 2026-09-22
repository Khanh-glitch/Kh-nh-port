@tool
extends Node3D
## Applies the shared material language to one instanced kit GLB.
##
## The curated assets come from three different authors and do not agree on
## saturation, roughness or metallic response. Rather than editing the source
## binaries (which are provenance-locked), each instance is re-surfaced at load
## time from a single palette resource.
##
## This is deliberately NOT a shader phase. It only touches:
##   - roughness / metallic relationships
##   - saturation restraint
##   - dark/light material families
##
## Set `kit_id` to a key in RoomPalette.MATERIAL_FAMILIES.

const RoomPalette := preload("res://scripts/room_palette.gd")

## Which asset this is, so the palette knows which material family to apply.
@export var kit_id: String = "":
	set(value):
		kit_id = value
		if is_inside_tree():
			_apply()

## Leave the source materials untouched (useful when auditioning an asset raw).
@export var keep_source_materials: bool = false:
	set(value):
		keep_source_materials = value
		if is_inside_tree():
			_apply()

## Per-instance roughness nudge, so identical props do not read as clones.
@export_range(-0.2, 0.2, 0.005) var roughness_offset: float = 0.0:
	set(value):
		roughness_offset = value
		if is_inside_tree():
			_apply()


func _ready() -> void:
	_apply()


func _apply() -> void:
	if keep_source_materials:
		_clear_overrides(self)
		return
	var family: Dictionary = RoomPalette.family_for(kit_id)
	if family.is_empty():
		return
	_surface(self, family)


func _clear_overrides(node: Node) -> void:
	if node is MeshInstance3D:
		var mi := node as MeshInstance3D
		for i in mi.get_surface_override_material_count():
			mi.set_surface_override_material(i, null)
	for child in node.get_children():
		_clear_overrides(child)


func _surface(node: Node, family: Dictionary) -> void:
	if node is MeshInstance3D:
		var mi := node as MeshInstance3D
		var mesh := mi.mesh
		if mesh != null:
			for i in mesh.get_surface_count():
				var src := mesh.surface_get_material(i)
				var surface_name := ""
				if src is BaseMaterial3D:
					surface_name = (src as BaseMaterial3D).resource_name
				if surface_name.is_empty():
					surface_name = "surface_%d" % i
				var mat := RoomPalette.build_material(
						family, surface_name, src, roughness_offset)
				if mat != null:
					mi.set_surface_override_material(i, mat)
	for child in node.get_children():
		_surface(child, family)
