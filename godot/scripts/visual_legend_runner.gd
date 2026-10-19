extends Node

var main: Control


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	main = scene.instantiate()
	get_tree().root.add_child(main)
	await get_tree().process_frame
	main.state.save_path = "user://legend_visual_%d.json" % OS.get_process_id()
	main.state.backup_path = "user://legend_visual_%d.backup.json" % OS.get_process_id()
	main.state.delete_save()
	main.new_game()
	main.show_camp()
	main.state.current_chapter = 2
	main.chapter_index = 2
	main.state.roster.linchong.level = 3
	main.state.quest_claimed.assign(["linchong_old_tassel", "linchong_imperial_seal", "linchong_temple_after"])
	main.start_hero_legend("linchong")
	await get_tree().process_frame
	for unit in main.battle.heroes + main.battle.enemies:
		unit.hp = 0
	main.battle.battle_finished = true
	main.battle.victory = true
	main._finish_legend_victory()
	await get_tree().process_frame
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("/tmp/shuihu-godot-visual/legend_reward.png")
	main.state.delete_save()
	if main.music_player:
		main.music_player.stop()
		main.music_player.stream = null
	main.theme = null
	main.queue_free()
	await get_tree().process_frame
	get_tree().quit(0)
