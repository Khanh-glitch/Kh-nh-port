@tool
extends Node3D
## Holds the canonical camera plus one inspection camera for a study, and
## switches between them. Nothing here is portfolio navigation — it exists so
## the three studies can be compared from a fixed, repeatable viewpoint.
##
## The canonical view is the authority for evaluation. The secondary view only
## exists to check that the room holds up off-axis.

@export var canonical_path: NodePath = ^"Canonical"
@export var secondary_path: NodePath = ^"Secondary"

var _cameras: Array[Camera3D] = []
var _index := 0


func _ready() -> void:
	for path in [canonical_path, secondary_path]:
		var node := get_node_or_null(path)
		if node is Camera3D:
			_cameras.append(node as Camera3D)
	_activate(0)


func _unhandled_input(event: InputEvent) -> void:
	if Engine.is_editor_hint() or _cameras.size() < 2:
		return
	if event.is_action_pressed("camera_toggle"):
		_activate((_index + 1) % _cameras.size())


func _activate(index: int) -> void:
	if _cameras.is_empty():
		return
	_index = clampi(index, 0, _cameras.size() - 1)
	for i in _cameras.size():
		_cameras[i].current = (i == _index)


## Used by the screenshot/inspection tooling.
func camera_names() -> PackedStringArray:
	var names := PackedStringArray()
	for cam in _cameras:
		names.append(cam.name)
	return names
