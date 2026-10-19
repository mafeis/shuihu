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
	var target_buttons: Array[Button] = []
	for button in main.find_children("*", "Button", true, false):
		if button is Button and button.text == "已锁定":
			target_buttons.append(button)
	_check(target_buttons.size() == 1, "UI should visibly mark the selected enemy")
	battle = main.battle
	var hero_health: int = battle.heroes[0].hp
	battle.enemy_turn()
	_check(battle.heroes[0].hp < hero_health, "the enemy turn should damage the active formation")
	battle.round_number = 1
	second_target.hp = 1
	battle.select_skill(0)
	main.perform_attack()
	await get_tree().process_frame
	_check(second_target.hp == 0, "the chosen enemy should take damage")
	_check(main.battle.battle_finished, "defeating the final enemy should end the battle")
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
	_check(main.screen == "reward", "victory should open native rewards")
	_check(main.state.statistics.battles_won == 1, "victory should update saved campaign statistics")
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
