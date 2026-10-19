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
	main.state.current_chapter = 5
	main.state.quest_progress.qinming = {"wins": 22, "damage": 4200, "ultimates": 2}
	main.state.recruited.append("qinming")
	main.state.roster.qinming = {"level": 1, "xp": 0, "equipment": {}}
	var recruit_before: int = main.state.recruited.size()
	var quest_result: Dictionary = main.state.claim_hero_quest("qinming", "qinming_thunder_road")
	_check(quest_result.ok, "completed hero quests should be claimable")
	_check(main.state.quest_claimed.has("qinming_thunder_road"), "hero quest claims should be persisted")
	_check(main.state.recruited.size() > recruit_before, "chronicle completion should recruit new heroes")
	_check(quest_result.get("heroes", []).size() > 0, "chronicle completion should report newly recruited heroes")
	main.state.current_chapter = 2
	main.state.roster.linchong.level = 3
	main.state.quest_claimed.assign(["linchong_old_tassel", "linchong_imperial_seal", "linchong_temple_after"])
	_check(main.state.hero_legend_ready("linchong"), "all chronicle chapters and level should unlock the hero legend battle")
	var legend: Dictionary = main.state.hero_legend("linchong")
	_check(not legend.is_empty() and not legend.enemies.is_empty(), "hero legends should load their own battle setup")
	main.state.team.assign(["linchong", "", ""])
	main.start_hero_legend("linchong")
	_check(main.legend_running and main.battle != null, "the native chronicle should open its legend battle")
	_check(main.battle.enemies.size() == legend.enemies.size(), "the legend battle should use its own enemy formation")
	for enemy in main.battle.enemies:
		enemy.hp = 0
	main.battle.battle_finished = true
	main.battle.victory = true
	var copper_before: int = main.state.copper
	main._finish_legend_victory()
	_check(main.state.legend_claimed.has(str(legend.id)), "legend victories should be persisted")
	_check(main.state.copper > copper_before, "legend victories should award their own loot")
	main.state.roster.linchong.level = 2
	_check(not main.state.hero_legend_ready("linchong"), "hero legends should respect the level gate")
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
