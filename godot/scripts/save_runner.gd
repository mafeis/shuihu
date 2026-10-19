extends Node

var failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	var main := scene.instantiate()
	get_tree().root.add_child(main)
	await get_tree().process_frame
	main.state.save_path = "user://save_test_%d.json" % OS.get_process_id()
	main.state.backup_path = "user://save_test_%d.backup.json" % OS.get_process_id()
	main.state.delete_save()
	main.state.player_name = "第一份战卷"
	main.state.save()
	main.state.player_name = "第二份战卷"
	main.state.save()
	var corrupt := FileAccess.open(main.state.save_path, FileAccess.WRITE)
	corrupt.store_string("{broken save")
	corrupt.close()
	_check(main.state.load_save(), "a broken current save should fall back to its backup")
	_check(main.state.player_name == "第一份战卷", "backup should preserve the last valid campaign")
	main.state.delete_save()
	_check(not main.state.has_save(), "deleting a campaign should remove current and backup saves")
	main.queue_free()
	await get_tree().process_frame
	await get_tree().process_frame
	_finish()


func _finish() -> void:
	if failures.is_empty():
		print("Godot save passed: valid backup rollback and full deletion.")
		get_tree().quit(0)
	else:
		for failure in failures:
			printerr("Godot save failure: ", failure)
		get_tree().quit(1)


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
