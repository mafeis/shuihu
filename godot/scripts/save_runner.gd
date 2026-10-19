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
	_check(main.screen == "reward", "legend victories should open their native reward page")
	var trial_state := GameState.new(main.game_data)
	trial_state.recruited.append("luzhishen")
	trial_state.roster.luzhishen = {"level": 1, "xp": 0, "equipment": {}}
	trial_state.team.assign(["linchong", "luzhishen", ""])
	trial_state.mastery("linchong").wins = 2
	trial_state.mastery("linchong").ultimates = 2
	var trial_battle := BattleModel.new(trial_state, trial_state.chapter())
	trial_battle.victory = true
	trial_battle.final_enemy_count = 2
	trial_battle.ultimate_uses = {"linchong": 1}
	trial_battle.damage_by_hero = {"linchong": 260}
	trial_battle.kills_by_hero = {"linchong": 1}
	trial_state.record_battle_progress(trial_battle)
	_check(trial_state.mastery("linchong").wins == 3, "victories should advance hero mastery")
	_check(trial_state.mastery("linchong").trials.has("first_star"), "completed hero trials should be archived")
	_check(trial_state.mastery("linchong").trials.has("oath_echo"), "ultimate-use trials should track the active hero")
	_check(trial_state.mastery("linchong").kills == 1, "hero mastery should track personal defeats")
	var doctrine_state := GameState.new(main.game_data)
	doctrine_state.recruited.append("yangzhi")
	doctrine_state.roster.yangzhi = {"level": 1, "xp": 0, "equipment": {}}
	doctrine_state.set_team_slot(1, "yangzhi")
	doctrine_state.mastery("linchong").trials.assign(["first_star", "oath_echo", "slayer_name"])
	doctrine_state.set_doctrine("linchong", "snowblade")
	doctrine_state.roster.linchong.level = 10
	var doctrine_story := {
		"title": "命途检验",
		"battle": {"enemies": [{"id": "runner", "row": 0, "level": 1}]},
		"special_rule": {"id": "test_rule", "name": "检验", "desc": "不下阵势", "effects": {}},
	}
	var doctrine_battle := BattleModel.new(doctrine_state, doctrine_story)
	doctrine_battle.allow_turn_advance = false
	var doctrine_attacker: Dictionary = doctrine_battle.heroes[0]
	var doctrine_target: Dictionary = doctrine_battle.enemies[0]
	_check(doctrine_attacker.get("doctrine_id", "") == "snowblade", "battle units should carry their selected doctrine")
	_check(doctrine_target.def > 0, "doctrine combat test should have an armored target")
	doctrine_target.hp = int(float(doctrine_target.max_hp) * 0.62)
	var ordinary_health: int = doctrine_target.hp
	doctrine_battle.rng.seed = 7
	doctrine_battle._apply_skill(doctrine_attacker, {"id": "doctrine_test", "name": "试枪", "target": "enemy", "power": 1.0, "path": "gang"}, 0)
	var ordinary_damage := ordinary_health - int(doctrine_target.hp)
	doctrine_battle.rng.seed = 7
	doctrine_attacker.yiqi = 100
	doctrine_target.max_hp *= 3
	doctrine_target.hp = doctrine_target.max_hp
	doctrine_target.hp = int(float(doctrine_target.max_hp) * 0.62)
	var execute_health: int = doctrine_target.hp
	doctrine_battle.heroes[0].hp = 1
	_check(doctrine_attacker.get("doctrine", {}).has("executeDamagePct"), "execution doctrine should reach its battle unit")
	doctrine_battle._apply_skill(doctrine_attacker, {"id": "doctrine_test", "name": "试枪", "target": "enemy", "power": 1.0, "path": "gang"}, 0)
	var execute_damage := execute_health - int(doctrine_target.hp)
	_check(execute_damage > ordinary_damage, "doctrine execution effects should apply in combat")
	trial_state.mastery("linchong").trials.assign(["first_star", "oath_echo", "slayer_name"])
	_check(trial_state.doctrine_unlocked("linchong"), "three complete trials should unlock a doctrine")
	var defense_before: int = trial_state.derive_hero_stats("linchong").def
	_check(trial_state.set_doctrine("linchong", "garrison"), "unlocked doctrines should be selectable")
	_check(int(trial_state.derive_hero_stats("linchong").def) > defense_before, "doctrine effects should change derived stats")
	trial_state.record_tactic("ferry", 0)
	_check(trial_state.tactic_archive.has("ferry_rescue"), "chapter tactics should be archived after victory")
	var tactic_copper: int = trial_state.copper
	trial_state.record_tactic("ferry", 0)
	_check(trial_state.copper == tactic_copper, "tactic discovery rewards should only be granted once")
	trial_state.save()
	trial_state.doctrines.clear()
	trial_state.tactic_archive.clear()
	trial_state.mastery("linchong").trials.clear()
	_check(trial_state.load_save(), "extended progression data should load from save")
	_check(trial_state.doctrines.get("linchong", "") == "garrison", "doctrine choices should persist")
	_check(trial_state.tactic_archive.has("ferry_rescue"), "tactic archive should persist")
	_check(trial_state.mastery("linchong").trials.size() == 3, "hero trials should persist")
	trial_state.current_chapter = 4
	_check(trial_state.recruitment_unlocked("yangzhi"), "recruitment posts should respect chapter prerequisites")
	var recruitment_copper: int = trial_state.copper
	_check(trial_state.complete_recruitment("yangzhi"), "recruitment victories should recruit their hero")
	_check(trial_state.recruited.has("yangzhi"), "recruitment rewards should add the hero to the roster")
	_check(trial_state.recruitment_completed.has("yangzhi"), "completed recruitment posts should be archived")
	_check(trial_state.copper > recruitment_copper, "recruitment posts should award their own loot")
	_check(trial_state.recruitment_unlocked("gongsunsheng"), "completed recruitment prerequisites should unlock the next post")
	_check(trial_state.achievements.has("all_sworn") == (trial_state.recruited.size() >= trial_state.heroes().size()), "achievements should match the campaign state")
	var cycle_mastery: int = trial_state.mastery("linchong").trials.size()
	trial_state.start_new_game_plus()
	_check(trial_state.new_game_plus == 1, "new game plus should advance the cycle")
	_check(trial_state.mastery("linchong").trials.size() == cycle_mastery, "new game plus should preserve mastery")
	_check(trial_state.tactic_archive.has("ferry_rescue"), "new game plus should preserve the tactic archive")
	_check(trial_state.completed_chapters.is_empty(), "new game plus should reset campaign chapters")
	trial_state.player_name = "导出测试"
	main.state = trial_state
	main.export_save_file()
	var named_export := "user://导出测试战卷_周目2.json"
	_check(FileAccess.file_exists(named_export), "save export should write a portable JSON copy")
	trial_state.player_name = "将被导入覆盖"
	main.import_save_path(ProjectSettings.globalize_path(named_export))
	_check(trial_state.player_name == "导出测试", "save import should load the valid exported campaign")
	var corrupt_import := "user://save_import_corrupt_%d.json" % OS.get_process_id()
	var corrupt_file := FileAccess.open(corrupt_import, FileAccess.WRITE)
	corrupt_file.store_string("{not a save")
	corrupt_file.close()
	trial_state.player_name = "原战卷仍在"
	main.import_save_path(ProjectSettings.globalize_path(corrupt_import))
	_check(trial_state.player_name == "原战卷仍在", "invalid save imports should leave the current campaign intact")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(corrupt_import))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(named_export))
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
		print("Godot save passed: mastery, doctrines, tactics, recruitment, new game plus and fallback saves.")
		get_tree().quit(0)
	else:
		for failure in failures:
			printerr("Godot save failure: ", failure)
		get_tree().quit(1)


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
