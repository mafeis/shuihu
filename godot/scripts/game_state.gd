class_name GameState
extends RefCounted

const SAVE_VERSION := 3

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
var roster: Dictionary = {}
var inventory: Dictionary = {"patrol_armor": 1, "bamboo_token": 1}
var facilities: Dictionary = {"hall": 1, "arena": 1, "tower": 1}
var camp_built: Array[String] = ["hall"]
var camp_stock: Dictionary = {}
var bond_archive: Array[String] = []
var chain_archive: Array[String] = []
var alignment := {"brotherhood": 1, "order": 1, "freedom": 1}
var choices := {}
var rewards_granted := {}
var endings_unlocked: Array[String] = []
var ending := ""
var best_arena_wave := 0
var quest_progress: Dictionary = {}
var quest_claimed: Array[String] = []
var legend_claimed: Array[String] = []
var hero_mastery: Dictionary = {}
var doctrines: Dictionary = {}
var achievements: Array[String] = []
var recruitment_completed: Array[String] = []
var tactic_archive: Array[String] = []
var new_game_plus := 0
var selected_choice := -1
var chapter_tactic_enabled := true
var statistics := {"battles_won": 0, "enemies_defeated": 0, "damage_dealt": 0}
var settings := {
	"music_volume": 0.65,
	"sfx_volume": 0.8,
	"battle_hints": true,
	"reduced_motion": false,
	"fullscreen": false,
}


func _init(game_data: Dictionary) -> void:
	data = game_data
	difficulty_source = data.get("difficulties", {})
	roster = {
		"linchong": {
			"level": 1,
			"xp": 0,
			"equipment": {"weapon": "worn_spear", "armor": "lamellar_vest", "token": "crimson_tassel"},
		},
	}
	for hero_id in data.get("hero_order", []):
		hero_mastery[str(hero_id)] = {
			"wins": 0,
			"kills": 0,
			"damage": 0,
			"ultimates": 0,
			"trials": [],
		}


func heroes() -> Dictionary:
	return data.get("heroes", {})


func chapters() -> Array:
	return data.get("chapters", [])


func enemies() -> Dictionary:
	return data.get("enemies", {})


func paths() -> Dictionary:
	return data.get("paths", {})


func equipment_catalog() -> Dictionary:
	return data.get("equipment", {})


func equipment(item_id: String) -> Dictionary:
	return equipment_catalog().get(item_id, {})


func hero(hero_id: String) -> Dictionary:
	return heroes().get(hero_id, {})


func roster_entry(hero_id: String) -> Dictionary:
	return roster.get(hero_id, {})


func trial_catalog() -> Array:
	return data.get("hero_trials", [])


func mastery(hero_id: String) -> Dictionary:
	if not hero_mastery.has(hero_id):
		hero_mastery[hero_id] = {"wins": 0, "kills": 0, "damage": 0, "ultimates": 0, "trials": []}
	return hero_mastery[hero_id]


func doctrine_catalog(hero_id: String) -> Dictionary:
	return data.get("hero_doctrines", {}).get(hero_id, {})


func doctrine(hero_id: String) -> Dictionary:
	var config := doctrine_catalog(hero_id)
	var doctrine_id := str(doctrines.get(hero_id, ""))
	return config.get("paths", {}).get(doctrine_id, {})


func doctrine_unlocked(hero_id: String) -> bool:
	var config := doctrine_catalog(hero_id)
	if config.is_empty():
		return false
	return mastery(hero_id).get("trials", []).size() >= int(config.get("unlockTrials", trial_catalog().size()))


func set_doctrine(hero_id: String, doctrine_id: String) -> bool:
	if not recruited.has(hero_id) or not doctrine_unlocked(hero_id):
		return false
	if not doctrine_catalog(hero_id).get("paths", {}).has(doctrine_id):
		return false
	doctrines[hero_id] = doctrine_id
	check_achievements()
	return true


func chapter_tactics(chapter_id: String) -> Array:
	return data.get("chapter_tactics", {}).get(chapter_id, [])


func chapter_tactic(chapter_id: String, option_index: int) -> Dictionary:
	var tactics := chapter_tactics(chapter_id)
	return tactics[option_index] if option_index >= 0 and option_index < tactics.size() else {}


func current_tactic() -> Dictionary:
	var option_index := int(choices.get(str(chapter().get("id", "")), -1))
	if option_index < 0 and chapter_tactic_enabled:
		option_index = selected_choice
	return chapter_tactic(str(chapter().get("id", "")), option_index)


func tactic_known(tactic_id: String) -> bool:
	return tactic_archive.has(tactic_id)


func record_tactic(chapter_id: String, option_index: int) -> Dictionary:
	var tactic := chapter_tactic(chapter_id, option_index)
	if tactic.is_empty():
		return {"ok": false}
	var tactic_id := str(tactic.get("id", ""))
	if tactic_archive.has(tactic_id):
		return {"ok": true, "tactic": tactic, "discovered": false, "copper": 0, "xp": 0}
	tactic_archive.append(tactic_id)
	var chapter_number := 0
	for entry in chapters():
		if str(entry.get("id", "")) == chapter_id:
			chapter_number = int(entry.get("index", 0))
			break
	var copper_reward := 60 + chapter_number * 20
	var xp_reward := 45 + chapter_number * 15
	copper += copper_reward
	for hero_id in active_team():
		grant_experience(hero_id, xp_reward)
	return {"ok": true, "tactic": tactic, "discovered": true, "copper": copper_reward, "xp": xp_reward}


func bond_catalog() -> Dictionary:
	return data.get("bonds", {})


func active_bonds() -> Array[Dictionary]:
	var active_team_ids := active_team()
	var result: Array[Dictionary] = []
	for bond in bond_catalog().values():
		var members: Array = bond.get("heroIds", [])
		var complete := not members.is_empty()
		for hero_id in members:
			if not active_team_ids.has(str(hero_id)):
				complete = false
				break
		if complete:
			result.append(bond)
	return result


func team_modifiers() -> Dictionary:
	var modifiers := {}
	for hero_id in active_team():
		var doctrine_config := doctrine(hero_id)
		for key in doctrine_config.get("teamEffects", {}):
			modifiers[key] = float(modifiers.get(key, 0.0)) + float(doctrine_config.teamEffects[key])
	for bond in active_bonds():
		for key in bond.get("effects", {}):
			modifiers[key] = float(modifiers.get(key, 0.0)) + float(bond.effects[key])
	for hero_id in active_team():
		var effects: Dictionary = hero(hero_id).get("passive", {}).get("effects", {})
		for source_key in ["teamOpeningGuard", "teamStartYiqi", "teamOpeningInspiration", "teamPoisePct", "enemyStartPoisePct"]:
			if effects.has(source_key):
				var target_key: String = {
					"teamOpeningGuard": "openingGuard",
					"teamStartYiqi": "startYiqi",
					"teamOpeningInspiration": "openingInspiration",
					"teamPoisePct": "poisePct",
					"enemyStartPoisePct": "enemyStartPoisePct",
				}[source_key]
				modifiers[target_key] = float(modifiers.get(target_key, 0.0)) + float(effects[source_key])
	return modifiers


func equipment_stats(hero_id: String) -> Dictionary:
	var entry: Dictionary = roster_entry(hero_id)
	var gear: Dictionary = entry.get("equipment", {})
	var stats := {"hp": 0, "atk": 0, "def": 0, "spd": 0}
	for slot in ["weapon", "armor", "token"]:
		var item_id := str(gear.get(slot, ""))
		if item_id.is_empty():
			continue
		var item := equipment(item_id)
		var item_stats: Dictionary = item.get("stats", {})
		for key in stats:
			stats[key] += int(item_stats.get(key, 0))
	return stats


func derive_hero_stats(hero_id: String) -> Dictionary:
	var config := hero(hero_id)
	var entry := roster_entry(hero_id)
	var base: Dictionary = config.get("base", {})
	var gear := equipment_stats(hero_id)
	var level := maxi(1, int(entry.get("level", 1)))
	var level_scale := 1.0 + (level - 1) * 0.13
	var mastery_scale := 1.0 + float(mastery(hero_id).get("trials", []).size()) * 0.02
	var doctrine_effects: Dictionary = doctrine(hero_id).get("effects", {})
	return {
		"level": level,
		"xp": int(entry.get("xp", 0)),
		"max_hp": int(round(float(base.get("hp", 400)) * level_scale * mastery_scale * (1.0 + (int(facilities.get("hall", 1)) - 1) * 0.05) * (1.0 + float(doctrine_effects.get("hpPct", 0))) + gear.hp)),
		"atk": int(round(float(base.get("atk", 50)) * level_scale * mastery_scale * (1.0 + (int(facilities.get("arena", 1)) - 1) * 0.05) * (1.0 + float(doctrine_effects.get("atkPct", 0))) + gear.atk)),
		"def": int(round(float(base.get("def", 35)) * level_scale * mastery_scale * (1.0 + float(doctrine_effects.get("defPct", 0))) + gear.def)),
		"spd": int(round(float(base.get("spd", 30)) * level_scale * mastery_scale * (1.0 + float(doctrine_effects.get("spdPct", 0))) + gear.spd)),
	}


func xp_for_next(level: int) -> int:
	return 90 + level * 70


func grant_experience(hero_id: String, amount: int) -> int:
	var entry: Dictionary = roster.get(hero_id, {})
	if entry.is_empty():
		return 0
	if int(camp_stock.get("steamed_bun", 0)) > 0:
		camp_stock["steamed_bun"] = int(camp_stock.steamed_bun) - 1
		amount += 12
	entry.xp = int(entry.get("xp", 0)) + maxi(0, amount)
	var levels := 0
	while entry.xp >= xp_for_next(int(entry.level)):
		entry.xp -= xp_for_next(int(entry.level))
		entry.level += 1
		levels += 1
	return levels


func add_item(item_id: String, amount := 1) -> void:
	if item_id.is_empty() or amount <= 0:
		return
	if item_id == "copper":
		copper += amount
		return
	if equipment(item_id).is_empty():
		return
	inventory[item_id] = int(inventory.get(item_id, 0)) + amount


func equip_item(hero_id: String, item_id: String) -> bool:
	var item := equipment(item_id)
	if item.is_empty() or not roster.has(hero_id):
		return false
	if int(inventory.get(item_id, 0)) <= 0:
		return false
	var entry: Dictionary = roster[hero_id]
	var gear: Dictionary = entry.equipment
	var slot := str(item.get("slot", ""))
	var previous := str(gear.get(slot, ""))
	if not previous.is_empty():
		add_item(previous)
	inventory[item_id] = int(inventory[item_id]) - 1
	gear[slot] = item_id
	return true


func unequip_item(hero_id: String, slot: String) -> bool:
	var entry := roster_entry(hero_id)
	if entry.is_empty():
		return false
	var gear: Dictionary = entry.equipment
	var item_id := str(gear.get(slot, ""))
	if item_id.is_empty():
		return false
	add_item(item_id)
	gear[slot] = null
	return true


func recommended_equipment(hero_id: String) -> Dictionary:
	var result := {}
	for item_id in equipment_catalog():
		var item := equipment(item_id)
		if int(inventory.get(item_id, 0)) <= 0:
			continue
		var slot := str(item.get("slot", ""))
		var stats: Dictionary = item.get("stats", {})
		var score := float(int(stats.get("atk", 0)) * 2.0 + int(stats.get("def", 0)) * 1.5 + int(stats.get("hp", 0)) * 0.25 + int(stats.get("spd", 0)) * 1.3)
		if not result.has(slot) or score > float(result[slot].score):
			result[slot] = {"item_id": item_id, "score": score}
	return result


func build_camp_building(building_id: String) -> bool:
	var building: Dictionary = data.get("camp_buildings", {}).get(building_id, {})
	if building.is_empty() or camp_built.has(building_id):
		return false
	if statistics.battles_won < int(building.get("unlockVictories", 0)):
		return false
	var cost := int(building.get("cost", 0))
	if copper < cost:
		return false
	copper -= cost
	camp_built.append(building_id)
	if not facilities.has(building_id):
		facilities[building_id] = 1
	return true


func collect_camp_resource(building_id: String) -> int:
	if not camp_built.has(building_id):
		return 0
	var building: Dictionary = data.get("camp_buildings", {}).get(building_id, {})
	var resource := str(building.get("resource", ""))
	if resource.is_empty():
		return 0
	var amount := int(building.get("output", 2)) + maxi(0, int(facilities.get(building_id, 1)) - 1)
	camp_stock[resource] = int(camp_stock.get(resource, 0)) + amount
	return amount


func building_level(building_id: String) -> int:
	return maxi(1, int(facilities.get(building_id, 1)))


func upgrade_cost(facility_id: String) -> int:
	var facility: Dictionary = data.get("facilities", {}).get(facility_id, {})
	var level := building_level(facility_id)
	if facility.is_empty() or level >= int(facility.get("maxLevel", 5)):
		return -1
	return int(facility.get("costs", {}).get(str(level + 1), -1))


func upgrade_facility(facility_id: String) -> bool:
	if not camp_built.has(facility_id):
		return false
	var cost := upgrade_cost(facility_id)
	if cost < 0 or copper < cost:
		return false
	copper -= cost
	facilities[facility_id] = building_level(facility_id) + 1
	return true


func craft_camp_recipe(recipe_id: String) -> bool:
	for recipe in data.get("camp_recipes", []):
		if recipe.get("id", "") != recipe_id or not camp_built.has(recipe.get("buildingId", "")):
			continue
		var input_data: Dictionary = recipe.get("input", {})
		var output_data: Dictionary = recipe.get("output", {})
		if int(camp_stock.get(input_data.item, 0)) < int(input_data.get("amount", 0)):
			return false
		camp_stock[input_data.item] = int(camp_stock.get(input_data.item, 0)) - int(input_data.amount)
		camp_stock[output_data.item] = int(camp_stock.get(output_data.item, 0)) + int(output_data.amount)
		return true
	return false


func camp_rest_cost() -> int:
	return maxi(40, 28 + recruited.size() * 12 + current_chapter * 14)


func camp_rest() -> int:
	var cost := camp_rest_cost()
	if copper < cost:
		return 0
	copper -= cost
	var xp := 18 + building_level("tower") * 6
	for hero_id in recruited:
		grant_experience(hero_id, xp)
	return xp


func consume_camp_product(product_id: String, amount := 1) -> bool:
	if int(camp_stock.get(product_id, 0)) < amount:
		return false
	camp_stock[product_id] = int(camp_stock[product_id]) - amount
	return true


func record_battle_progress(battle: BattleModel) -> void:
	var mastery_unlocks: Array[Dictionary] = []
	for unit in battle.heroes:
		var hero_id := str(unit.get("hero_id", ""))
		if hero_id.is_empty():
			continue
		var progress: Dictionary = quest_progress.get(hero_id, {"wins": 0, "damage": 0, "ultimates": 0})
		if battle.victory:
			progress.wins = int(progress.get("wins", 0)) + 1
		progress.ultimates = int(progress.get("ultimates", 0)) + int(battle.ultimate_uses.get(hero_id, 0))
		quest_progress[hero_id] = progress
		var hero_mastery_entry := mastery(hero_id)
		if battle.victory:
			hero_mastery_entry.wins = int(hero_mastery_entry.get("wins", 0)) + 1
		hero_mastery_entry.kills = int(hero_mastery_entry.get("kills", 0)) + int(battle.kills_by_hero.get(hero_id, 0))
		hero_mastery_entry.damage = int(hero_mastery_entry.get("damage", 0)) + int(battle.damage_by_hero.get(hero_id, 0))
		hero_mastery_entry.ultimates = int(hero_mastery_entry.get("ultimates", 0)) + int(battle.ultimate_uses.get(hero_id, 0))
		var progress_damage := int(progress.get("damage", 0)) + int(battle.damage_by_hero.get(hero_id, 0))
		progress.damage = progress_damage
		quest_progress[hero_id] = progress
		for trial in trial_catalog():
			var trial_id := str(trial.get("id", ""))
			if hero_mastery_entry.trials.has(trial_id):
				continue
			var metric := str(trial.get("metric", ""))
			if int(hero_mastery_entry.get(metric, 0)) < int(trial.get("target", 1)):
				continue
			hero_mastery_entry.trials.append(trial_id)
			var reward: Dictionary = trial.get("reward", {})
			copper += int(reward.get("copper", 0))
			grant_experience(hero_id, int(reward.get("xp", 0)))
			mastery_unlocks.append({"hero_id": hero_id, "trial": trial})
	if battle.victory:
		statistics.enemies_defeated = int(statistics.get("enemies_defeated", 0)) + int(battle.final_enemy_count)
		statistics.damage_dealt = int(statistics.get("damage_dealt", 0)) + int(battle.damage_dealt)
	check_achievements()
	for unlock in mastery_unlocks:
		if unlock not in battle.mastery_unlocks:
			battle.mastery_unlocks.append(unlock)


func achievement_catalog() -> Array:
	return data.get("achievements", [])


func achievement_requirement_met(achievement_id: String) -> bool:
	match achievement_id:
		"first_blood":
			return int(statistics.get("battles_won", 0)) >= 1
		"ten_stands":
			return int(statistics.get("battles_won", 0)) >= 10
		"hundred_stands":
			return int(statistics.get("battles_won", 0)) >= 100
		"all_sworn":
			return recruited.size() >= heroes().size()
		"full_chronicle":
			return completed_chapters.size() >= chapters().size()
		"three_endings":
			return endings_unlocked.size() >= 3
		"camp_complete":
			for facility_id in data.get("facilities", {}):
				var max_level := int(data.facilities[facility_id].get("maxLevel", 1))
				if int(facilities.get(facility_id, 1)) < max_level:
					return false
			return true
		"arena_ten":
			return best_arena_wave >= 10
		"arena_twenty":
			return best_arena_wave >= 20
		"arena_thirty":
			return best_arena_wave >= 30
		"mastery_path":
			for hero_id in hero_mastery:
				if hero_mastery[hero_id].get("trials", []).size() >= trial_catalog().size():
					return true
			return false
		"doctrine_path":
			return not doctrines.is_empty()
		"doctrine_all":
			for hero_id in data.get("hero_order", []):
				if doctrine(str(hero_id)).is_empty():
					return false
			return true
		"new_cycle":
			return new_game_plus >= 1
		"medal_three":
			return completed_chapters.size() >= 3
	return false


func check_achievements() -> Array[Dictionary]:
	var unlocked: Array[Dictionary] = []
	for achievement in achievement_catalog():
		var achievement_id := str(achievement.get("id", ""))
		if achievements.has(achievement_id) or not achievement_requirement_met(achievement_id):
			continue
		achievements.append(achievement_id)
		var reward: Dictionary = achievement.get("reward", {})
		copper += int(reward.get("copper", 0))
		for hero_id in recruited:
			grant_experience(hero_id, int(reward.get("xp", 0)))
		unlocked.append(achievement)
	return unlocked


func recruitment_catalog() -> Dictionary:
	return data.get("hero_recruitments", {})


func recruitment(hero_id: String) -> Dictionary:
	return recruitment_catalog().get(hero_id, {})


func recruitment_completed_check(hero_id: String) -> bool:
	return recruited.has(hero_id) or recruitment_completed.has(hero_id)


func recruitment_unlocked(hero_id: String) -> bool:
	var config := recruitment(hero_id)
	if config.is_empty() or recruitment_completed_check(hero_id):
		return false
	if current_chapter < int(config.get("requiredChapter", 1)):
		return false
	var prerequisite := str(config.get("prerequisite", ""))
	return prerequisite.is_empty() or recruitment_completed_check(prerequisite)


func complete_recruitment(hero_id: String) -> bool:
	var config := recruitment(hero_id)
	if config.is_empty() or recruitment_completed_check(hero_id):
		return false
	if not recruitment_completed.has(hero_id):
		recruitment_completed.append(hero_id)
	recruit([hero_id])
	var reward: Dictionary = config.get("reward", {})
	copper += int(reward.get("copper", 0))
	add_item(str(reward.get("item", "")), int(reward.get("amount", 1)))
	for team_hero_id in active_team():
		grant_experience(team_hero_id, int(reward.get("xp", 0)))
	statistics.battles_won = int(statistics.get("battles_won", 0)) + 1
	check_achievements()
	return true


func claim_hero_quest(hero_id: String, quest_id: String) -> Dictionary:
	if quest_claimed.has(quest_id):
		return {"ok": false, "reason": "claimed"}
	var quest: Dictionary = {}
	for candidate in data.get("hero_quests", {}).get(hero_id, []):
		if candidate.get("id", "") == quest_id:
			quest = candidate
			break
	if quest.is_empty():
		return {"ok": false, "reason": "unknown"}
	if int(current_chapter) + 1 < int(quest.get("requiredChapter", 1)):
		return {"ok": false, "reason": "locked"}
	var objective: Dictionary = quest.get("objective", {})
	var metric := str(objective.get("metric", "wins"))
	var progress: Dictionary = quest_progress.get(hero_id, {})
	if int(progress.get(metric, 0)) < int(objective.get("target", 1)):
		return {"ok": false, "reason": "incomplete"}
	quest_claimed.append(quest_id)
	var reward: Dictionary = quest.get("reward", {})
	copper += int(reward.get("copper", 0))
	var levels := grant_experience(hero_id, int(reward.get("xp", 0)))
	var unlocked_heroes: Array[String] = []
	var recruit_map := {"qinming": "shijin", "zhangqing": "guansheng", "ruanxiaoqi": "lijun", "huyanzhuo": "lingzhen", "liying": "leiheng", "shixiu": "yangxiong", "xiaorang": "yuehe"}
	if recruit_map.has(hero_id):
		var recruits: Array = data.get("chronicle_recruits", {}).get(recruit_map[hero_id], [])
		for new_hero_id in recruits:
			if not recruited.has(str(new_hero_id)):
				unlocked_heroes.append(str(new_hero_id))
		recruit(recruits)
	return {"ok": true, "levels": levels, "reward": reward, "heroes": unlocked_heroes}


func hero_legend(hero_id: String) -> Dictionary:
	return data.get("hero_legends", {}).get(hero_id, {})


func hero_legend_progress(hero_id: String) -> int:
	var total := 0
	for quest in data.get("hero_quests", {}).get(hero_id, []):
		if quest_claimed.has(str(quest.get("id", ""))):
			total += 1
	return total


func hero_legend_ready(hero_id: String) -> bool:
	var legend := hero_legend(hero_id)
	if legend.is_empty() or hero_legend_progress(hero_id) < 3:
		return false
	var level := int(derive_hero_stats(hero_id).get("level", 1))
	return current_chapter + 1 >= int(legend.get("requiredChapter", 999)) and level >= int(legend.get("minLevel", 1))


func set_team_slot(slot: int, hero_id: String) -> bool:
	if slot < 0 or slot >= team.size():
		return false
	if not hero_id.is_empty() and not recruited.has(hero_id):
		return false
	var existing := team.find(hero_id) if not hero_id.is_empty() else -1
	var previous := team[slot]
	team[slot] = hero_id
	if existing >= 0 and existing != slot:
		team[existing] = previous
	return true


func swap_team_slots(first: int, second: int) -> bool:
	if first < 0 or second < 0 or first >= team.size() or second >= team.size():
		return false
	var previous := team[first]
	team[first] = team[second]
	team[second] = previous
	return true


func chapter(index: int = -1) -> Dictionary:
	var list := chapters()
	if list.is_empty():
		return {}
	var resolved := current_chapter if index < 0 else index
	if resolved < 0 or resolved >= list.size():
		return list[-1]
	return list[resolved]


func active_team() -> Array[String]:
	var result: Array[String] = []
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
		for bond in active_bonds():
			var bond_id := str(bond.get("id", ""))
			if not bond_archive.has(bond_id):
				bond_archive.append(bond_id)
				var reward: Dictionary = bond.get("reward", {})
				copper += int(reward.get("copper", 0))
				for hero_id in active_team():
					grant_experience(hero_id, int(reward.get("xp", 0)))
	var found := -1
	for index in chapters().size():
		if chapters()[index].get("id", "") == chapter_id:
			found = index
			break
	if found >= 0:
		current_chapter = mini(found + 1, chapters().size() - 1)
	check_achievements()


func recruit(hero_ids: Array) -> void:
	for hero_id in hero_ids:
		if not hero(hero_id).is_empty() and not recruited.has(hero_id):
			recruited.append(hero_id)
			var start_gear: Dictionary = data.get("starting_equipment", {}).get(hero_id, {})
			roster[hero_id] = {
				"level": 1,
				"xp": 0,
				"equipment": start_gear.duplicate(true),
			}
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


func resolve_ending() -> String:
	var brotherhood := int(alignment.get("brotherhood", 0))
	var order := int(alignment.get("order", 0))
	var freedom := int(alignment.get("freedom", 0))
	if brotherhood >= order and brotherhood >= freedom:
		ending = "brotherhood"
	elif order >= freedom:
		ending = "order"
	else:
		ending = "freedom"
	if not endings_unlocked.has(ending):
		endings_unlocked.append(ending)
	check_achievements()
	return ending


func start_new_game_plus() -> void:
	var previous_endings := endings_unlocked.duplicate()
	var previous_mastery := hero_mastery.duplicate(true)
	var previous_doctrines := doctrines.duplicate(true)
	var previous_achievements := achievements.duplicate()
	var previous_bonds := bond_archive.duplicate()
	var previous_chains := chain_archive.duplicate()
	var previous_tactics := tactic_archive.duplicate()
	var previous_quests := quest_claimed.duplicate()
	var previous_legends := legend_claimed.duplicate()
	var previous_recruitments := recruitment_completed.duplicate()
	var previous_settings := settings.duplicate(true)
	var cycle := new_game_plus + 1
	var preserved_name := player_name
	var preserved_difficulty := difficulty_id
	var fresh := GameState.new(data)
	player_name = preserved_name
	difficulty_id = preserved_difficulty
	current_chapter = 0
	completed_chapters.clear()
	recruited.assign(["linchong"])
	team.assign(["linchong", "", ""])
	copper = fresh.copper
	roster = fresh.roster.duplicate(true)
	inventory = fresh.inventory.duplicate(true)
	facilities = fresh.facilities.duplicate(true)
	camp_built.assign(["hall"])
	camp_stock.clear()
	alignment = {"brotherhood": 1, "order": 1, "freedom": 1}
	choices.clear()
	rewards_granted.clear()
	ending = ""
	best_arena_wave = 0
	quest_progress.clear()
	statistics = {"battles_won": 0, "enemies_defeated": 0, "damage_dealt": 0}
	endings_unlocked.assign(previous_endings)
	hero_mastery = previous_mastery
	doctrines = previous_doctrines
	achievements.assign(previous_achievements)
	bond_archive.assign(previous_bonds)
	chain_archive.assign(previous_chains)
	tactic_archive.assign(previous_tactics)
	quest_claimed.assign(previous_quests)
	legend_claimed.assign(previous_legends)
	recruitment_completed.assign(previous_recruitments)
	settings = previous_settings
	new_game_plus = cycle
	check_achievements()


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
		"roster": roster,
		"inventory": inventory,
		"facilities": facilities,
		"camp_built": camp_built,
		"camp_stock": camp_stock,
		"bond_archive": bond_archive,
		"chain_archive": chain_archive,
		"endings_unlocked": endings_unlocked,
		"ending": ending,
		"best_arena_wave": best_arena_wave,
		"quest_progress": quest_progress,
		"quest_claimed": quest_claimed,
		"legend_claimed": legend_claimed,
		"hero_mastery": hero_mastery,
		"doctrines": doctrines,
		"achievements": achievements,
		"recruitment_completed": recruitment_completed,
		"tactic_archive": tactic_archive,
		"new_game_plus": new_game_plus,
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
	if not parsed is Dictionary or int(parsed.get("version", 0)) < 1 or int(parsed.get("version", 0)) > SAVE_VERSION:
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
	roster.merge(parsed.get("roster", {}), true)
	for hero_id in recruited:
		if not roster.has(hero_id):
			roster[hero_id] = {
				"level": 1,
				"xp": 0,
				"equipment": data.get("starting_equipment", {}).get(hero_id, {}).duplicate(true),
			}
		else:
			var entry: Dictionary = roster[hero_id]
			entry.level = maxi(1, int(entry.get("level", 1)))
			entry.xp = maxi(0, int(entry.get("xp", 0)))
			if not entry.get("equipment", null) is Dictionary:
				entry.equipment = {}
			for slot in ["weapon", "armor", "token"]:
				if not entry.equipment.has(slot):
					entry.equipment[slot] = ""
	inventory.merge(parsed.get("inventory", {}), true)
	facilities.merge(parsed.get("facilities", {}), true)
	camp_built.assign(parsed.get("camp_built", ["hall"]))
	camp_stock.merge(parsed.get("camp_stock", {}), true)
	bond_archive.assign(parsed.get("bond_archive", []))
	chain_archive.assign(parsed.get("chain_archive", []))
	endings_unlocked.assign(parsed.get("endings_unlocked", []))
	ending = str(parsed.get("ending", ""))
	best_arena_wave = maxi(0, int(parsed.get("best_arena_wave", 0)))
	quest_progress = parsed.get("quest_progress", {})
	quest_claimed.assign(parsed.get("quest_claimed", []))
	legend_claimed.assign(parsed.get("legend_claimed", []))
	var saved_mastery = parsed.get("hero_mastery", {})
	if saved_mastery is Dictionary:
		for hero_id in saved_mastery:
			if not hero_mastery.has(str(hero_id)):
				continue
			var saved_entry: Dictionary = saved_mastery[hero_id]
			var entry: Dictionary = hero_mastery[hero_id]
			for metric in ["wins", "kills", "damage", "ultimates"]:
				entry[metric] = maxi(0, int(saved_entry.get(metric, entry.get(metric, 0))))
			if saved_entry.get("trials", []) is Array:
				for trial_id in saved_entry.trials:
					if trial_catalog().any(func(trial): return str(trial.get("id", "")) == str(trial_id)) and not entry.trials.has(str(trial_id)):
						entry.trials.append(str(trial_id))
	var saved_doctrines = parsed.get("doctrines", {})
	if saved_doctrines is Dictionary:
		for hero_id in saved_doctrines:
			if not doctrine_catalog(str(hero_id)).get("paths", {}).has(str(saved_doctrines[hero_id])):
				continue
			doctrines[str(hero_id)] = str(saved_doctrines[hero_id])
	var saved_achievements = parsed.get("achievements", [])
	if saved_achievements is Array:
		for achievement_id in saved_achievements:
			if achievement_catalog().any(func(entry): return str(entry.get("id", "")) == str(achievement_id)):
				achievements.append(str(achievement_id))
	var saved_recruitments = parsed.get("recruitment_completed", [])
	if saved_recruitments is Array:
		for hero_id in saved_recruitments:
			if recruitment_catalog().has(str(hero_id)):
				recruitment_completed.append(str(hero_id))
	var saved_tactics = parsed.get("tactic_archive", [])
	if saved_tactics is Array:
		for chapter_id in data.get("chapter_tactics", {}):
			for tactic in chapter_tactics(str(chapter_id)):
				var tactic_id := str(tactic.get("id", ""))
				if saved_tactics.has(tactic_id):
					tactic_archive.append(tactic_id)
	new_game_plus = maxi(0, int(parsed.get("new_game_plus", 0)))
	alignment.merge(parsed.get("alignment", {}), true)
	choices = parsed.get("choices", {})
	rewards_granted = parsed.get("rewards_granted", {})
	statistics.merge(parsed.get("statistics", {}), true)
	settings.merge(parsed.get("settings", {}), true)
	settings.erase("auto_battle")
	if not settings.has("battle_hints"):
		settings.battle_hints = true
	if not settings.has("fullscreen"):
		settings.fullscreen = false
	return true


func has_save() -> bool:
	return FileAccess.file_exists(save_path) or FileAccess.file_exists(backup_path)


func delete_save() -> void:
	for path in [save_path, backup_path]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
