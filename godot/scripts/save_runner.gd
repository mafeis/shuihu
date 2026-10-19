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
	var saved_payload = JSON.parse_string(FileAccess.get_file_as_string(main.state.backup_path))
	saved_payload.version = 1
	saved_payload.roster = {}
	saved_payload.team = []
	var legacy := FileAccess.open(main.state.save_path, FileAccess.WRITE)
	legacy.store_string(JSON.stringify(saved_payload))
	legacy.close()
	_check(main.state.load_save(), "the previous save version should migrate without losing progress")
	_check(main.state.roster.has("linchong"), "save migration should rebuild roster entries for recruited heroes")
	_check(main.state.team.size() == 3, "save migration should restore three formation slots")
	var ending_state := GameState.new(main.game_data)
	ending_state.alignment = {"brotherhood": 3, "order": 6, "freedom": 1}
	_check(ending_state.resolve_ending() == "order", "the ending should follow the strongest campaign alignment")
	_check(ending_state.endings_unlocked.has("order"), "resolved endings should be archived")
	main.state.quest_progress = {"linchong": {"wins": 22, "damage": 4200, "ultimates": 2}}
	main.state.current_chapter = 0
	var quest_result: Dictionary = main.state.claim_hero_quest("linchong", "linchong_old_tassel")
	_check(quest_result.ok, "completed hero quests should be claimable")
	_check(main.state.quest_claimed.has("linchong_old_tassel"), "hero quest claims should be persisted")
	main.state.delete_save()
	_check(not main.state.has_save(), "deleting a campaign should remove current and backup saves")
	main.music_player.stop()
	main.music_player.stream = null
	main.theme = null
	main.queue_free()
	await get_tree().process_frame
	await get_tree().process_frame
	_finish()


func _finish() -> void:
	if failures.is_empty():
		print("Godot save passed: backup rollback, save migration, ending resolution and full deletion.")
		get_tree().quit(0)
	else:
		for failure in failures:
			printerr("Godot save failure: ", failure)
		get_tree().quit(1)


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
