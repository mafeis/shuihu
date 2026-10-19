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
	main.state.save_path = "user://battle_test_%d.json" % OS.get_process_id()
	main.state.backup_path = "user://battle_test_%d.backup.json" % OS.get_process_id()
	main.state.delete_save()
	main.new_game()
	main.enter_chapter()
	while main.screen == "story":
		main.next_story()
		await get_tree().process_frame
	main.choose_option(0)
	await get_tree().process_frame
	var battle = main.battle
	_check(battle.heroes.size() == 1, "first chapter should start with Lin Chong")
	_check(battle.enemies.size() > 1, "first chapter should test enemy target selection")
	var second_target: Dictionary = battle.living_enemies()[1]
	battle.enemies[0].hp = 0
	second_target.hp = 200000
	main.battle_target = battle.living_enemies().size() - 1
	battle.select_skill(0)
	main.show_battle()
	await get_tree().process_frame
	var locked_sprites := main.find_children("*", "PanelContainer", true, false).filter(
		func(panel): return panel.visible and panel.tooltip_text.begins_with("点选") and _has_target_marker(panel)
	)
	_check(locked_sprites.size() == 1, "UI should visibly mark the selected enemy")
	battle = main.battle
	var hero_health: int = battle.heroes[0].hp
	battle.enemy_turn()
	_check(battle.heroes[0].hp < hero_health, "the enemy turn should damage the active formation")
	battle.round_number = 1
	battle.enemies[0].hp = 600
	battle.enemies[0].max_hp = 600
	battle.heroes[0].yiqi = 100
	main.perform_attack()
	await get_tree().process_frame
	_check(battle.heroes[0].yiqi > 40, "hero attacks should gain yiqi")
	battle.current_actor_index = 0
	battle.selected_skill_index = 0
	main.battle_target = 1
	second_target.hp = 1
	battle.select_skill(0)
	main.perform_attack()
	await get_tree().process_frame
	_check(second_target.hp == 0, "the chosen enemy should take damage")
	_check(not main.battle.living_enemies().has(second_target), "defeating the final enemy should end the battle")
	_check(main.battle.chain_attacks == 0, "battle should not count a chain that was never performed")
	var auto_choice := AutoBattle.choose(battle, "balanced")
	_check(auto_choice.has("skill_index") and auto_choice.has("target"), "auto battle should produce a playable skill and target")
	var retry_battle := BattleModel.new(main.state, main.state.chapter())
	for unit in retry_battle.heroes.slice(1):
		unit.hp = 0
	retry_battle.heroes[0].hp = 1
	retry_battle.heroes[0].max_hp = 518
	retry_battle.enemies[0].hp = 100000
	retry_battle.enemies[0].max_hp = 100000
	retry_battle.enemy_turn()
	_check(retry_battle.battle_finished and not retry_battle.victory, "a wiped formation should finish in defeat")
	main.battle.enemies[0].hp = 20
	main.battle.enemies[0].max_hp = 20
	var rounds := 0
	while not main.battle.battle_finished and rounds < 100:
		main.battle.heroes[0].hp = main.battle.heroes[0].max_hp
		main.battle_target = 0
		main.battle.select_skill(0)
		main.perform_attack()
		rounds += 1
	_check(main.battle.battle_finished and main.battle.victory, "a winning battle should settle")
	_check(main.battle_result_continuation() == "reward", "victory should offer the campaign reward")
	_check(main.screen == "reward", "victory should open native rewards")
	_check(main.state.statistics.battles_won == 1, "victory should update saved campaign statistics")
	main.state.roster_entry("linchong").level = 5
	main.state.team.assign(["linchong", "luzhishen", "wusong"])
	var test_battle := BattleModel.new(main.state, main.state.chapter())
	_check(test_battle.bond_ids.has("golden_spear_oath") == false, "bonds should only activate with every required member")
	main.state.team.assign(["linchong", "luzhishen", ""])
	test_battle = BattleModel.new(main.state, main.state.chapter())
	_check(test_battle.bond_ids.has("wind_snow"), "fielding both bonded heroes should activate their bond")
	_check(float(test_battle.modifiers.get("defPct", 0)) >= 0.05, "bond defense should be applied to battle modifiers")
	_check(int(test_battle.heroes[0].statuses.get("guard", 0)) >= 1, "opening guard should be applied")
	test_battle.chain_heroes.assign(["linchong", "luzhishen"])
	test_battle.chain_ready = true
	var chain_result := test_battle.chain_attack()
	_check(chain_result.ok, "charged three-path stars should allow a native chain attack")
	_check(not test_battle.chain_ready, "chain attacks should clear the charged formation")
	var boss_battle := BattleModel.new(main.state, main.state.chapter())
	boss_battle.enemies[0].boss = true
	boss_battle.enemies[0].hp = int(boss_battle.enemies[0].max_hp / 2)
	boss_battle._check_boss_phase(boss_battle.enemies[0])
	_check(int(boss_battle.enemies[0].statuses.get("guard", 0)) >= 1, "bosses should enter a second phase below half health")
	var rule_battle := BattleModel.new(main.state, main.state.chapter())
	_check(rule_battle.log_lines.any(func(line): return str(line).begins_with("阵势·")), "chapters should expose their tactical rule in the battle log")
	var enemy_test := BattleModel.new(main.state, main.state.chapter(), {
		"waveHealPct": 0.08,
	})
	var wave_healed := false
	for hero in enemy_test.heroes:
		if int(hero.hp) > 0 and int(hero.hp) <= int(hero.max_hp):
			wave_healed = int(hero.hp) >= int(round(float(hero.max_hp) * 0.08))
			break
	_check(wave_healed, "arena wave healing should be applied before combat")
	enemy_test.arena_encounter = {"effects": {"onEnemyDefeat": {"guard": 1, "inspiration": 1}}}
	var target_enemy: Dictionary = enemy_test.living_enemies()[0]
	enemy_test.heroes[0].atk = 10000
	target_enemy.hp = 1
	enemy_test.heroes[0].cooldowns.clear()
	enemy_test.heroes[0].skills[0].power = 4.0
	var attack_result := enemy_test.hero_skill(enemy_test.enemies.find(target_enemy))
	_check(attack_result.ok, "battle test should be able to defeat a selected enemy")
	var surviving_enemy := enemy_test.living_enemies()[0]
	_check(int(surviving_enemy.statuses.get("guard", 0)) == 1, "arena linked camps should guard survivors after a defeat")
	main.state.delete_save()
	main.music_player.stop()
	main.music_player.stream = null
	main.theme = null
	main.queue_free()
	await get_tree().process_frame
	await get_tree().process_frame
	_finish()


func _finish() -> void:
	if failures.is_empty():
		print("Godot battle passed: target selection, enemy turns, rounds and victory settlement.")
		get_tree().quit(0)
	else:
		for failure in failures:
			printerr("Godot battle failure: ", failure)
		get_tree().quit(1)


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)


func _has_target_marker(panel: Control) -> bool:
	for label in panel.find_children("*", "Label", true, false):
		if label is Label and label.text.begins_with("目标"):
			return true
	return false
