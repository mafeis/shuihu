extends Node

var main: Control
var failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	main = scene.instantiate()
	get_tree().root.add_child(main)
	await get_tree().process_frame
	main.state.save_path = "user://smoke_test_%d.json" % OS.get_process_id()
	main.state.backup_path = "user://smoke_test_%d.backup.json" % OS.get_process_id()
	main.state.delete_save()
	_check(main.screen == "title", "title screen should boot")
	main.new_game()
	await get_tree().process_frame
	_check(main.screen == "map", "new game should open the campaign map")
	main.enter_chapter()
	await get_tree().process_frame
	_check(main.screen == "story", "chapter entry should open story")
	for index in 8:
		if main.screen != "story":
			break
		main.next_story()
		await get_tree().process_frame
	_check(main.screen == "choice", "story should reach its tactic choice")
	main.choose_option(0)
	await get_tree().process_frame
	_check(main.screen == "battle", "choice should start a native battle")
	_check(main.battle != null and main.battle.heroes.size() == 1, "battle should load the starting formation")
	_check(main.battle != null and main.battle.enemies.size() == 2, "battle should load chapter enemies")
	for turn in 40:
		if main.battle == null or main.battle.battle_finished:
			break
		main.battle.select_skill(0)
		main.perform_attack()
		await get_tree().process_frame
	_check(main.battle != null and main.battle.battle_finished, "the first campaign battle should settle")
	main.show_camp()
	await get_tree().process_frame
	_check(main.screen == "camp", "native camp screen should open")
	main.show_roster()
	await get_tree().process_frame
	_check(main.screen == "roster", "native roster should open")
	main.state.recruit(["luzhishen"])
	main.assign_hero_to_team("luzhishen")
	await get_tree().process_frame
	_check(main.state.team.has("luzhishen"), "recruited heroes should join the native formation")
	main.show_settings()
	await get_tree().process_frame
	_check(main.settings_layer.visible, "settings overlay should open")
	main.close_settings()
	await get_tree().process_frame
	_check(not main.settings_layer.visible, "settings overlay should close")
	main.state.delete_save()
	await _close_game()
	if failures.is_empty():
		print("Godot smoke passed: native title, story, choice, battle, camp, roster and settings.")
		get_tree().quit(0)
	else:
		for failure in failures:
			printerr("Godot smoke failure: ", failure)
		get_tree().quit(1)


func _close_game() -> void:
	if main.music_player:
		main.music_player.stop()
		main.music_player.stream = null
	main.theme = null
	main.queue_free()
	await get_tree().process_frame
	await get_tree().process_frame


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
