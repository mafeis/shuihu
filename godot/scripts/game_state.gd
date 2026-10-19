class_name GameState
extends RefCounted

const SAVE_VERSION := 1

var data: Dictionary
var save_path := "user://xingming_shuihu.json"
var backup_path := "user://xingming_shuihu.backup.json"
var difficulty_source: Dictionary = {}
var player_name := "无名星客"
var difficulty_id := "normal"
var current_chapter := 0
var completed_chapters: Array[String] = []
var recruited: Array[String] = ["linchong"]
var team: Array[String] = ["linchong", "", ""]
var copper := 160
var alignment := {"brotherhood": 1, "order": 1, "freedom": 1}
var choices := {}
var rewards_granted := {}
var statistics := {"battles_won": 0, "enemies_defeated": 0}
var settings := {
	"music_volume": 0.65,
	"sfx_volume": 0.8,
	"auto_battle": true,
	"reduced_motion": false,
}


func _init(game_data: Dictionary) -> void:
	data = game_data
	difficulty_source = data.get("difficulties", {})


func heroes() -> Dictionary:
	return data.get("heroes", {})


func chapters() -> Array:
	return data.get("chapters", [])


func enemies() -> Dictionary:
	return data.get("enemies", {})


func paths() -> Dictionary:
	return data.get("paths", {})


func hero(hero_id: String) -> Dictionary:
	return heroes().get(hero_id, {})


func chapter(index: int = -1) -> Dictionary:
	var list := chapters()
	if list.is_empty():
		return {}
	var resolved := current_chapter if index < 0 else index
	if resolved < 0 or resolved >= list.size():
		return list[-1]
	return list[resolved]


func active_team() -> Array[String]:
	var result: Array[String] = ["linchong"]
	for hero_id in team:
		if not recruited.has(hero_id):
			continue
		if not result.has(hero_id):
			result.append(hero_id)
	return result


func chapter_available(index: int) -> bool:
	return index >= 0 and index <= current_chapter


func complete_chapter(chapter_id: String) -> void:
	if not completed_chapters.has(chapter_id):
		completed_chapters.append(chapter_id)
		statistics.battles_won += 1
	var found := -1
	for index in chapters().size():
		if chapters()[index].get("id", "") == chapter_id:
			found = index
			break
	if found >= 0:
		current_chapter = mini(found + 1, chapters().size() - 1)


func recruit(hero_ids: Array) -> void:
	for hero_id in hero_ids:
		if not hero(hero_id).is_empty() and not recruited.has(hero_id):
			recruited.append(hero_id)
	var candidates := active_team()
	for index in team.size():
		if team[index].is_empty():
			var next_hero := ""
			for hero_id in candidates:
				if not team.has(hero_id):
					next_hero = hero_id
					break
			if not next_hero.is_empty():
				team[index] = next_hero


func difficulty() -> Dictionary:
	return difficulty_source.get(difficulty_id, {})


func save() -> void:
	var payload := {
		"version": SAVE_VERSION,
		"player_name": player_name,
		"difficulty": difficulty_id,
		"current_chapter": current_chapter,
		"completed_chapters": completed_chapters,
		"recruited": recruited,
		"team": team,
		"copper": copper,
		"alignment": alignment,
		"choices": choices,
		"rewards_granted": rewards_granted,
		"statistics": statistics,
		"settings": settings,
		"saved_at": Time.get_datetime_string_from_system(true),
	}
	if FileAccess.file_exists(save_path):
		var current := FileAccess.open(save_path, FileAccess.READ)
		if current != null:
			var previous_text := current.get_as_text()
			current.close()
			var json := JSON.new()
			var previous = json.data if json.parse(previous_text) == OK else null
			if previous is Dictionary and int(previous.get("version", 0)) == SAVE_VERSION:
				var backup := FileAccess.open(backup_path, FileAccess.WRITE)
				if backup != null:
					backup.store_string(previous_text)
					backup.close()
	var file := FileAccess.open(save_path, FileAccess.WRITE)
	if file == null:
		push_error("Unable to save game: %s" % error_string(FileAccess.get_open_error()))
		return
	file.store_string(JSON.stringify(payload, "\t"))


func load_save() -> bool:
	if not _load_from_path(save_path):
		return _load_from_path(backup_path)
	return true


func _load_from_path(path: String) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false
	var json := JSON.new()
	if json.parse(file.get_as_text()) != OK:
		return false
	var parsed = json.data
	if not parsed is Dictionary or int(parsed.get("version", 0)) != SAVE_VERSION:
		return false
	player_name = str(parsed.get("player_name", "无名星客"))
	difficulty_id = str(parsed.get("difficulty", "normal"))
	current_chapter = clampi(int(parsed.get("current_chapter", 0)), 0, maxi(chapters().size() - 1, 0))
	completed_chapters.assign(parsed.get("completed_chapters", []))
	recruited.assign(parsed.get("recruited", ["linchong"]))
	team.assign(parsed.get("team", ["linchong", "", ""]))
	while team.size() < 3:
		team.append("")
	copper = maxi(0, int(parsed.get("copper", 160)))
	alignment.merge(parsed.get("alignment", {}), true)
	choices = parsed.get("choices", {})
	rewards_granted = parsed.get("rewards_granted", {})
	statistics.merge(parsed.get("statistics", {}), true)
	settings.merge(parsed.get("settings", {}), true)
	return true


func has_save() -> bool:
	return FileAccess.file_exists(save_path) or FileAccess.file_exists(backup_path)


func delete_save() -> void:
	for path in [save_path, backup_path]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
