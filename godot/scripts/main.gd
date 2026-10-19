extends Control

const SCREEN_TITLE := "title"
const SCREEN_MAP := "map"
const SCREEN_CAMP := "camp"
const SCREEN_ROSTER := "roster"
const SCREEN_STORY := "story"
const SCREEN_CHOICE := "choice"
const SCREEN_BATTLE := "battle"
const SCREEN_REWARD := "reward"

const INK_950 := Color("#080d0e")
const INK_900 := Color("#0d1415")
const INK_850 := Color("#111a1b")
const INK_800 := Color("#172122")
const INK_700 := Color("#233031")
const PAPER_100 := Color("#f0e8d7")
const PAPER_200 := Color("#dfd3bb")
const PAPER_300 := Color("#c5b89e")
const PAPER_500 := Color("#9d937e")
const BRONZE := Color("#d7bc7d")
const BRONZE_DARK := Color("#96783f")
const TEAL := Color("#91b4ae")
const CINNABAR := Color("#df8877")

const SANS_FONT := preload("res://ui/game_font.tres")

var game_data: Dictionary = {}
var state: GameState
var screen := SCREEN_TITLE
var chapter_index := 0
var story_stage := "intro"
var story_line := 0
var selected_choice := -1
var battle: BattleModel
var battle_target := 0
var content_root: Control
var screen_root: Control
var toast_label: Label
var toast_timer: Timer
var menu_layer: Control
var settings_layer: Control
var last_save_error := ""
var music_player: AudioStreamPlayer
var music_track := ""
var music_target_db := -3.7


func _ready() -> void:
	_configure_input()
	game_data = _load_game_data()
	get_tree().auto_accept_quit = false
	state = GameState.new(game_data)
	_build_shell()
	show_title()


func _configure_input() -> void:
	for keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
		if not InputMap.has_action("ui_accept"):
			InputMap.add_action("ui_accept")
		var event := InputEventKey.new()
		event.keycode = keycode
		InputMap.action_add_event("ui_accept", event)
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	InputMap.action_add_event("ui_cancel", escape)


func _load_game_data() -> Dictionary:
	var file := FileAccess.open("res://data/game.json", FileAccess.READ)
	if file == null:
		push_error("Unable to load campaign data.")
		return {}
	var parsed = JSON.parse_string(file.get_as_text())
	if parsed is Dictionary:
		return parsed
	push_error("Campaign data is invalid JSON.")
	return {}


func _build_shell() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = _make_theme()
	var background := ColorRect.new()
	background.color = INK_950
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	screen_root = Control.new()
	screen_root.name = "ScreenRoot"
	screen_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(screen_root)
	toast_label = _label("", 15, PAPER_100)
	toast_label.name = "Toast"
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.add_theme_stylebox_override("normal", _panel_style(INK_800, BRONZE_DARK, 1, 7))
	toast_label.set_offsets_preset(Control.PRESET_CENTER_TOP)
	toast_label.position = Vector2(510, 22)
	toast_label.size = Vector2(420, 46)
	toast_label.visible = false
	toast_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(toast_label)
	toast_timer = Timer.new()
	toast_timer.one_shot = true
	toast_timer.wait_time = 2.5
	toast_timer.timeout.connect(func(): toast_label.visible = false)
	add_child(toast_timer)
	menu_layer = _overlay_root("MenuLayer")
	settings_layer = _overlay_root("SettingsLayer")
	music_player = AudioStreamPlayer.new()
	music_player.name = "MusicPlayer"
	music_player.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(music_player)
	music_player.finished.connect(func(): music_player.play())


func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.keycode == KEY_ESCAPE and settings_layer.visible:
		close_settings()
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_ESCAPE and screen == SCREEN_BATTLE:
		show_map()
		get_viewport().set_input_as_handled()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if state:
			state.save()
		get_tree().quit()


func _make_theme() -> Theme:
	var game_theme := Theme.new()
	game_theme.default_font = SANS_FONT
	game_theme.default_font_size = 15
	game_theme.set_color("font_color", "Label", PAPER_200)
	game_theme.set_color("font_color", "Button", PAPER_100)
	game_theme.set_color("font_hover_color", "Button", PAPER_100)
	game_theme.set_color("font_pressed_color", "Button", PAPER_100)
	game_theme.set_color("font_focus_color", "Button", PAPER_100)
	game_theme.set_color("font_disabled_color", "Button", Color(PAPER_500, 0.6))
	game_theme.set_font_size("font_size", "Button", 15)
	game_theme.set_stylebox("normal", "Button", _panel_style(INK_800, INK_700, 1, 5))
	game_theme.set_stylebox("hover", "Button", _panel_style(Color("#1b2b2d"), BRONZE_DARK, 1, 5))
	game_theme.set_stylebox("pressed", "Button", _panel_style(Color("#26383a"), BRONZE, 2, 5))
	game_theme.set_stylebox("focus", "Button", _panel_style(Color(0, 0, 0, 0), BRONZE, 2, 5))
	game_theme.set_stylebox("disabled", "Button", _panel_style(Color(INK_850, 0.62), INK_700, 1, 5))
	game_theme.set_constant("h_separation", "Button", 8)
	game_theme.set_constant("outline_size", "Label", 0)
	return game_theme


func _panel_style(color: Color, border: Color, border_width: int = 1, radius: int = 5) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	return style


func _label(text: String, size: int = 15, color: Color = PAPER_200, weight: int = 500) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_override("font", SANS_FONT)
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_constant_override("outline_size", 0)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label


func _button(text: String, callback: Callable, primary := false, min_width := 0.0) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(min_width, 46)
	button.focus_mode = Control.FOCUS_ALL
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	if primary:
		button.add_theme_stylebox_override("normal", _panel_style(Color("#b99a56"), Color("#e3c986"), 1, 5))
		button.add_theme_stylebox_override("hover", _panel_style(Color("#d0af68"), Color("#f0dda4"), 1, 5))
		button.add_theme_stylebox_override("pressed", _panel_style(Color("#9f7f40"), Color("#f0dda4"), 2, 5))
		button.add_theme_color_override("font_color", INK_950)
		button.add_theme_color_override("font_hover_color", INK_950)
		button.add_theme_color_override("font_pressed_color", INK_950)
		button.add_theme_color_override("font_focus_color", INK_950)
	button.pressed.connect(callback)
	return button


func _overlay_root(name_value: String) -> Control:
	var overlay := Control.new()
	overlay.name = name_value
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	overlay.visible = false
	add_child(overlay)
	return overlay


func _clear_screen() -> void:
	for child in screen_root.get_children():
		child.queue_free()


func _new_screen() -> Control:
	for child in screen_root.get_children():
		screen_root.remove_child(child)
		child.queue_free()
	var page := Control.new()
	page.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	screen_root.add_child(page)
	return page


func _background_image(page: Control, path: String, dim := 0.42) -> void:
	if path.is_empty() or not ResourceLoader.exists(path):
		return
	var image := TextureRect.new()
	image.texture = load(path)
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_child(image)
	var shade := ColorRect.new()
	shade.color = Color(INK_950, dim)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_child(shade)


func _topbar(page: Control, active := "") -> void:
	var backdrop := ColorRect.new()
	backdrop.color = Color(INK_950, 0.34)
	backdrop.position = Vector2(0, 70)
	backdrop.size = Vector2(1440, 830)
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_child(backdrop)
	var bar := PanelContainer.new()
	bar.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.98), INK_700, 0, 0))
	bar.position = Vector2(0, 0)
	bar.size = Vector2(1440, 70)
	page.add_child(bar)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 18)
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 26
	row.offset_right = -26
	bar.add_child(row)
	var brand := _label("星命水浒\n风雪山神庙", 17, BRONZE)
	brand.custom_minimum_size = Vector2(196, 60)
	brand.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(brand)
	var chapter := state.chapter()
	var chapter_label := _label("%s\n%s" % [chapter.get("label", "第一回"), chapter.get("title", "黄河夜渡")], 15, PAPER_100)
	chapter_label.custom_minimum_size = Vector2(190, 60)
	chapter_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(chapter_label)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)
	var copper := _label("铜钱  %d 贯" % state.copper, 15, BRONZE)
	copper.custom_minimum_size = Vector2(140, 46)
	copper.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	copper.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	copper.add_theme_stylebox_override("normal", _panel_style(Color("#171d1c"), Color("#665636"), 1, 24))
	row.add_child(copper)
	for item in [
		["行军图", "map", show_map],
		["营寨", "camp", show_camp],
		["好汉", "roster", show_roster],
		["设置", "settings", show_settings],
	]:
		var button := _button(item[0], item[2], false, 96)
		button.flat = active != item[1]
		if active == item[1]:
			button.add_theme_color_override("font_color", BRONZE)
			button.add_theme_stylebox_override("normal", _panel_style(Color(INK_850, 0.94), BRONZE_DARK, 1, 4))
		row.add_child(button)


func _set_screen(next_screen: String) -> void:
	screen = next_screen
	menu_layer.visible = false
	settings_layer.visible = false
	screen_root.mouse_filter = Control.MOUSE_FILTER_PASS


func show_title() -> void:
	_set_screen(SCREEN_TITLE)
	_play_music("res://assets/audio/title_theme.mp3")
	var page := _new_screen()
	_background_image(page, "res://assets/video/bianjing_snow_night_poster.webp", 0.34)
	var column := VBoxContainer.new()
	column.position = Vector2(96, 210)
	column.size = Vector2(505, 560)
	column.add_theme_constant_override("separation", 11)
	page.add_child(column)
	column.add_child(_label("北宋末年 · 梁山群像回合 RPG", 15, BRONZE))
	var title := _label("星命水浒", 92, PAPER_100)
	title.custom_minimum_size.y = 105
	column.add_child(title)
	column.add_child(_label("风雪山神庙", 30, PAPER_200))
	column.add_child(_label("一纸冤案，四十位好汉，九场风雪。\n从黄河夜渡到水泊聚义，替梁山选一条能走下去的路。", 16, PAPER_300))
	var gap := Control.new()
	gap.custom_minimum_size.y = 24
	column.add_child(gap)
	var continue_button := _button(
		"续上旧卷    %d/%d 回" % [state.completed_chapters.size(), state.chapters().size()],
		continue_game,
		true,
		260,
	)
	continue_button.disabled = not state.has_save()
	column.add_child(continue_button)
	var new_game_button := _button("另开新卷", new_game, not state.has_save(), 260)
	column.add_child(new_game_button)
	column.add_child(_button("设置", show_settings, false, 260))

	var dock := HBoxContainer.new()
	dock.position = Vector2(85, 674)
	dock.size = Vector2(520, 56)
	dock.add_theme_constant_override("separation", 8)
	column.add_child(dock)
	for difficulty_id in game_data.get("difficulties", {}):
		var difficulty_data: Dictionary = game_data.difficulties[difficulty_id]
		var selected: bool = state.difficulty_id == difficulty_id
		var button := _button(difficulty_data.get("name", difficulty_id), func(): set_difficulty(difficulty_id), selected, 165)
		button.custom_minimum_size.y = 56
		dock.add_child(button)

	var hero_row := HBoxContainer.new()
	hero_row.position = Vector2(815, 552)
	hero_row.size = Vector2(560, 320)
	hero_row.alignment = BoxContainer.ALIGNMENT_CENTER
	hero_row.add_theme_constant_override("separation", -10)
	page.add_child(hero_row)
	for hero_id in ["linchong", "luzhishen", "wusong", "huarong", "songjiang", "yanqing"]:
		var config := state.hero(hero_id)
		if config.is_empty() or not ResourceLoader.exists(config.get("cutout", "")):
			continue
		var hero_image := TextureRect.new()
		hero_image.texture = load(config.cutout)
		hero_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		hero_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		hero_image.custom_minimum_size = Vector2(120, 280)
		hero_image.size_flags_vertical = Control.SIZE_SHRINK_END
		hero_row.add_child(hero_image)
	var footer := _label("单机战役 · 自动存档      手柄 / 键盘 / 鼠标 / 触屏", 14, PAPER_500)
	footer.position = Vector2(28, 855)
	footer.size = Vector2(1000, 28)
	page.add_child(footer)
	continue_button.grab_focus()


func set_difficulty(id: String) -> void:
	state.difficulty_id = id
	show_title()


func new_game() -> void:
	state = GameState.new(game_data)
	state.save()
	chapter_index = 0
	show_map()
	_toast("新卷已开：黄河渡口等你启程。")


func continue_game() -> void:
	if state.load_save():
		chapter_index = state.current_chapter
		show_map()
		_toast("旧卷已续。")
	else:
		_toast("未找到可用的旧卷。")


func show_map() -> void:
	_set_screen(SCREEN_MAP)
	_play_music("res://assets/audio/jianghu_theme.mp3")
	var page := _new_screen()
	var chapter: Dictionary = state.chapters()[chapter_index]
	_background_image(page, chapter.get("bg", ""), 0.34)
	if not state.chapter_available(chapter_index):
		_toast("继续推进前回，方可抵达此处。")
	_topbar(page, "map")
	var copy := VBoxContainer.new()
	copy.position = Vector2(66, 520)
	copy.size = Vector2(1030, 334)
	copy.add_theme_constant_override("separation", 8)
	page.add_child(copy)
	copy.add_child(_label("%s · %s" % [chapter.get("label", ""), chapter.get("location", "")], 16, BRONZE))
	var heading := _label(chapter.get("title", ""), 56, PAPER_100)
	heading.custom_minimum_size.y = 72
	copy.add_child(heading)
	copy.add_child(_label(chapter.get("summary", ""), 16, PAPER_200))
	var objective := _label("目标  " + str(chapter.get("objective", "")), 15, PAPER_100)
	objective.custom_minimum_size.y = 40
	objective.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	objective.add_theme_stylebox_override("normal", _panel_style(Color(INK_900, 0.85), BRONZE, 1, 4))
	copy.add_child(objective)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 12)
	copy.add_child(actions)
	var enter := _button("启程", enter_chapter, true, 210)
	enter.disabled = not state.chapter_available(chapter_index)
	actions.add_child(enter)
	actions.add_child(_button("先回营整备", show_camp, false, 180))
	var rail := PanelContainer.new()
	rail.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.97), INK_700, 1, 4))
	rail.position = Vector2(1100, 88)
	rail.size = Vector2(320, 794)
	page.add_child(rail)
	var rail_box := VBoxContainer.new()
	rail_box.add_theme_constant_override("separation", 8)
	rail.add_child(rail_box)
	rail_box.add_child(_label("梁山行军录           %d/%d" % [state.completed_chapters.size(), state.chapters().size()], 16, PAPER_100))
	var goal := _label("下一步\n" + str(chapter.get("objective", "")), 15, PAPER_300)
	goal.custom_minimum_size.y = 92
	goal.add_theme_stylebox_override("normal", _panel_style(Color("#1a2424"), Color("#806d41"), 1, 4))
	rail_box.add_child(goal)
	for index in state.chapters().size():
		var item: Dictionary = state.chapters()[index]
		var available := state.chapter_available(index)
		var completed := state.completed_chapters.has(item.get("id", ""))
		var current := index == chapter_index
		var label := _label("%s  %s%s" % [item.get("label", ""), item.get("title", ""), "   已完成" if completed else ("" if available else "   未解锁")], 15, BRONZE if current else (PAPER_200 if available else PAPER_500))
		label.custom_minimum_size.y = 47
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.add_theme_stylebox_override("normal", _panel_style(Color("#142021" if current else INK_900), BRONZE_DARK if current else INK_700, 1, 4))
		label.mouse_filter = Control.MOUSE_FILTER_STOP
		label.gui_input.connect(func(event: InputEvent):
			if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed and available:
				chapter_index = index
				show_map()
		)
		rail_box.add_child(label)
	enter.grab_focus()


func enter_chapter() -> void:
	if not state.chapter_available(chapter_index):
		_toast("继续推进前回，方可抵达此处。")
		return
	story_stage = "intro"
	story_line = 0
	selected_choice = -1
	show_story()


func show_story() -> void:
	_set_screen(SCREEN_STORY)
	_play_music("res://assets/audio/jianghu_theme.mp3")
	var page := _new_screen()
	var chapter := state.chapter()
	_background_image(page, chapter.get("bg", ""), 0.2)
	_topbar(page, "map")
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.96), BRONZE_DARK, 1, 5))
	panel.position = Vector2(80, 606)
	panel.size = Vector2(1280, 272)
	page.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	var speakers: Array = chapter.get("intro", [])
	if story_stage == "outro":
		speakers = chapter.get("outro", [])
	var line_data: Dictionary = speakers[clampi(story_line, 0, maxi(speakers.size() - 1, 0))]
	var speaker := _label(line_data.get("speaker", "旁白"), 18, BRONZE)
	speaker.custom_minimum_size.y = 30
	box.add_child(speaker)
	var dialogue := _label(line_data.get("text", ""), 21, PAPER_100)
	dialogue.custom_minimum_size.y = 85
	dialogue.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(dialogue)
	var progress := _label("剧情 %d / %d" % [story_line + 1, speakers.size()], 14, PAPER_500)
	box.add_child(progress)
	var actions := HBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_END
	actions.add_theme_constant_override("separation", 10)
	box.add_child(actions)
	actions.add_child(_button("返回行军图", show_map, false, 160))
	if story_stage != "outro":
		actions.add_child(_button("最后一步", func():
			story_stage = "choice"
			show_choice()
		, false, 150))
	var next := _button("继续", next_story, true, 190)
	actions.add_child(next)
	next.grab_focus()
	if story_stage == "outro":
		next.text = "查看奖励"
		if next.pressed.is_connected(next_story):
			next.pressed.disconnect(next_story)
		next.pressed.connect(show_reward)


func next_story() -> void:
	var chapter := state.chapter()
	var lines: Array = chapter.get("outro" if story_stage == "outro" else "intro", [])
	if story_line + 1 < lines.size():
		story_line += 1
		show_story()
	elif story_stage == "intro":
		story_stage = "choice"
		show_choice()


func show_choice() -> void:
	_set_screen(SCREEN_CHOICE)
	var page := _new_screen()
	var chapter := state.chapter()
	_background_image(page, chapter.get("bg", ""), 0.3)
	_topbar(page, "map")
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.97), BRONZE_DARK, 1, 5))
	panel.position = Vector2(310, 202)
	panel.size = Vector2(820, 560)
	page.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 13)
	panel.add_child(box)
	box.add_child(_label("抉择 · 星命将记下这一笔", 16, BRONZE))
	var choice_data: Dictionary = chapter.get("choice", {})
	box.add_child(_label(choice_data.get("prompt", ""), 22, PAPER_100))
	var options: Array = choice_data.get("options", [])
	for index in options.size():
		var option: Dictionary = options[index]
		var tactic: Dictionary = option.get("tactic", {})
		var option_label := _label(
			"%02d  %s\n%s" % [
				index + 1,
				option.get("text", ""),
				tactic.get("name", ""),
			],
			16,
			PAPER_200,
		)
		option_label.custom_minimum_size.y = 108
		option_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		option_label.add_theme_stylebox_override("normal", _panel_style(Color("#152122"), INK_700, 1, 5))
		var button := _button("选择这一路", func(): choose_option(index), false, 0)
		box.add_child(button)
		var option_copy := _label(option_label.text, 16, PAPER_200)
		option_copy.custom_minimum_size.y = 106
		option_copy.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		box.add_child(option_copy)
	box.add_child(_button("返回行军图", show_map, false, 200))


func choose_option(index: int) -> void:
	selected_choice = index
	var chapter: Dictionary = state.chapter()
	var choice_data: Dictionary = chapter.get("choice", {})
	var choices: Array = choice_data.get("options", [])
	if index >= choices.size():
		return
	var effect: Dictionary = choices[index].get("effect", {})
	state.choices[chapter.get("id", "")] = index
	for key in effect:
		state.alignment[key] = int(state.alignment.get(key, 0)) + int(effect[key])
	state.save()
	start_battle()


func start_battle() -> void:
	_set_screen(SCREEN_BATTLE)
	_play_music("res://assets/audio/battle_theme.mp3")
	battle = BattleModel.new(state, state.chapter())
	battle_target = 0
	show_battle()


func show_battle() -> void:
	_set_screen(SCREEN_BATTLE)
	if battle == null:
		start_battle()
		return
	var page := _new_screen()
	_background_image(page, state.chapter().get("bg", ""), 0.48)
	_topbar(page, "map")
	var title := _label("第 %d 回 · %s      回合 %d" % [chapter_index + 1, state.chapter().get("title", ""), battle.round_number], 17, PAPER_200)
	title.position = Vector2(32, 88)
	title.size = Vector2(1370, 46)
	page.add_child(title)
	var enemy_column := VBoxContainer.new()
	enemy_column.position = Vector2(82, 154)
	enemy_column.size = Vector2(550, 640)
	enemy_column.add_theme_constant_override("separation", 11)
	page.add_child(enemy_column)
	for index in battle.enemies.size():
		var enemy := battle.enemies[index]
		if enemy.hp <= 0:
			continue
		var card := _unit_card(enemy, false)
		var enemy_id := str(enemy.get("enemy_id", ""))
		var clicked := _button("已锁定" if _selected_enemy_id() == enemy_id else "锁定目标", func():
			battle_target = _living_enemy_position(index)
			show_battle()
		, false, 130)
		clicked.custom_minimum_size.y = 38
		card.add_child(clicked)
		enemy_column.add_child(card)
	var hero_column := VBoxContainer.new()
	hero_column.position = Vector2(660, 154)
	hero_column.size = Vector2(350, 640)
	hero_column.add_theme_constant_override("separation", 11)
	page.add_child(hero_column)
	for hero in battle.heroes:
		var card := _unit_card(hero, true)
		card.mouse_filter = Control.MOUSE_FILTER_PASS
		hero_column.add_child(card)
	var command := PanelContainer.new()
	command.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.97), BRONZE_DARK, 1, 5))
	command.position = Vector2(1032, 86)
	command.size = Vector2(380, 784)
	page.add_child(command)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 7)
	command.add_child(box)
	if battle.battle_finished:
		box.add_child(_label("战阵已结", 30, BRONZE))
		box.add_child(_label("我军胜利。" if battle.victory else "我军败退。", 20, PAPER_100))
		box.add_child(_button("查看战果" if battle.victory else "重新整备", show_reward if battle.victory else start_battle, true, 280))
		box.add_child(_button("返回行军图", show_map, false, 280))
		return
	var actor: Dictionary = battle.current_hero()
	box.add_child(_label("当前行动\n%s · %s\n生命 %d / %d    义气 %d" % [actor.get("name", ""), actor.get("nickname", ""), actor.hp, actor.max_hp, actor.yiqi], 16, PAPER_100))
	var skill := battle.selected_skill()
	for index in actor.skills.size():
		var skill_data: Dictionary = actor.skills[index]
		var skill_button := _button(
			"%s    义气 +%d\n%s" % [
				skill_data.get("name", ""),
				int(skill_data.get("yiqi", 0)) - int(skill_data.get("yiqiCost", 0)),
				skill_data.get("desc", ""),
			],
			func():
				battle.select_skill(index)
				show_battle(),
			false,
			282,
		)
		skill_button.custom_minimum_size.y = 65
		if index == battle.selected_skill_index:
			skill_button.add_theme_stylebox_override("normal", _panel_style(Color("#253433"), BRONZE_DARK, 2, 5))
		box.add_child(skill_button)
	var target_name := "无目标"
	if not battle.living_enemies().is_empty():
		target_name = battle.living_enemies()[clampi(battle_target, 0, battle.living_enemies().size() - 1)].get("name", "")
	var attack := _button("出招 · 目标 %s" % target_name, perform_attack, true, 282)
	attack.disabled = not battle.can_use_selected_skill()
	box.add_child(attack)
	box.add_child(_button("返回行军图", show_map, false, 282))
	var log_box := VBoxContainer.new()
	log_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(_sep())
	for line in battle.log_lines.slice(0, 7):
		log_box.add_child(_label(line, 14, PAPER_300))
	box.add_child(log_box)


func _selected_enemy_id() -> String:
	var living := battle.living_enemies()
	if living.is_empty():
		return ""
	battle_target = clampi(battle_target, 0, living.size() - 1)
	return str(living[battle_target].get("enemy_id", ""))


func _living_enemy_position(enemy_index: int) -> int:
	var living := battle.living_enemies()
	if living.is_empty() or enemy_index < 0 or enemy_index >= battle.enemies.size():
		return 0
	var clicked: Dictionary = battle.enemies[enemy_index]
	for index in living.size():
		if living[index].get("enemy_id", "") == clicked.get("enemy_id", ""):
			return index
	return 0


func _unit_card(unit: Dictionary, hero_side: bool) -> PanelContainer:
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.92), BRONZE_DARK if hero_side else INK_700, 1, 4))
	card.custom_minimum_size = Vector2(0, 126)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	card.add_child(row)
	var image := TextureRect.new()
	image.custom_minimum_size = Vector2(88, 106)
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if ResourceLoader.exists(unit.get("portrait", "")):
		image.texture = load(unit.portrait)
	row.add_child(image)
	var copy := VBoxContainer.new()
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(copy)
	copy.add_child(_label("%s\n%s" % [unit.get("name", ""), unit.get("nickname", "")], 19, PAPER_100))
	copy.add_child(_label("生命 %d / %d     护御 %d" % [unit.hp, unit.max_hp, unit.guard], 14, PAPER_300))
	var bar := ProgressBar.new()
	bar.max_value = unit.max_hp
	bar.value = unit.hp
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(180, 12)
	bar.add_theme_stylebox_override("background", _panel_style(INK_700, INK_700, 0, 3))
	bar.add_theme_stylebox_override("fill", _panel_style(TEAL if hero_side else CINNABAR, Color(0, 0, 0, 0), 0, 3))
	copy.add_child(bar)
	return card


func _sep() -> HSeparator:
	var separator := HSeparator.new()
	separator.add_theme_constant_override("separation", 5)
	return separator


func perform_attack() -> void:
	if battle == null:
		return
	var result := battle.hero_skill(battle_target)
	if not result.ok:
		_toast("义气不足，先使用其他招式。")
		return
	if battle.battle_finished:
		if battle.victory:
			_finish_victory()
		else:
			show_battle()
		return
	show_battle()


func _finish_victory() -> void:
	var chapter: Dictionary = state.chapter()
	var chapter_id := str(chapter.get("id", ""))
	var battle_data: Dictionary = chapter.get("battle", {})
	if not state.rewards_granted.has(chapter_id):
		var reward: Dictionary = battle_data.get("reward", {})
		state.copper += int(round(float(reward.get("copper", 0)) * battle.difficulty_rewards))
		state.recruit(battle_data.get("recruit", []))
		state.rewards_granted[chapter_id] = true
	state.complete_chapter(chapter_id)
	state.save()
	show_reward()


func show_reward() -> void:
	_set_screen(SCREEN_REWARD)
	var page := _new_screen()
	_background_image(page, state.chapter().get("bg", ""), 0.48)
	_topbar(page, "map")
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.97), BRONZE_DARK, 2, 6))
	panel.position = Vector2(395, 205)
	panel.size = Vector2(650, 515)
	page.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	panel.add_child(box)
	box.add_child(_label("战阵已破", 16, BRONZE))
	box.add_child(_label("星命又记下一笔", 38, PAPER_100))
	var chapter: Dictionary = state.chapter()
	var battle_data: Dictionary = chapter.get("battle", {})
	var reward: Dictionary = battle_data.get("reward", {})
	box.add_child(_label("铜钱 +%d     历练 +%d\n新结义：%s" % [
		int(round(float(reward.get("copper", 0)) * (1.15 if state.difficulty_id == "hard" else 1.0))),
		int(reward.get("xp", 0)),
		", ".join(battle_data.get("recruit", [])),
	], 18, PAPER_200))
	box.add_child(_button("继续", func():
		story_stage = "outro"
		story_line = 0
		show_story()
	, true, 330))
	box.add_child(_button("返回行军图", show_map, false, 330))


func show_camp() -> void:
	_set_screen(SCREEN_CAMP)
	var page := _new_screen()
	_background_image(page, "res://assets/environments/liangshan_water_fort.png", 0.64)
	_topbar(page, "camp")
	var camp_shade := ColorRect.new()
	camp_shade.color = Color(INK_950, 0.35)
	camp_shade.position = Vector2(0, 70)
	camp_shade.size = Vector2(1440, 830)
	camp_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var overlay_index := page.get_child_count() - 2
	page.add_child(camp_shade)
	page.move_child(camp_shade, overlay_index)
	var heading := _label("梁山营寨", 48, PAPER_100)
	heading.position = Vector2(48, 104)
	heading.size = Vector2(690, 68)
	page.add_child(heading)
	var description := _label("以战功开辟营区，经营水泊与工坊，让山寨真正成为众人的归处。", 16, PAPER_300)
	description.position = Vector2(50, 173)
	description.size = Vector2(870, 40)
	page.add_child(description)
	var stats := _label("铜钱  %d     好汉  %d / %d     建筑  %d" % [state.copper, state.recruited.size(), state.heroes().size(), 1 + state.completed_chapters.size()], 16, BRONZE)
	stats.position = Vector2(900, 111)
	stats.size = Vector2(490, 50)
	stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	page.add_child(stats)
	var grid := GridContainer.new()
	grid.columns = 3
	grid.position = Vector2(46, 245)
	grid.size = Vector2(1348, 620)
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	page.add_child(grid)
	for building_id in game_data.get("camp_buildings", {}):
		var building: Dictionary = game_data.camp_buildings[building_id]
		var unlocked := state.completed_chapters.size() >= int(building.get("unlock_victories", building.get("unlockVictories", 0)))
		var built: bool = building_id == "hall"
		var card := PanelContainer.new()
		card.add_theme_stylebox_override("panel", _panel_style(
			Color("#162422") if unlocked else Color(INK_900, 0.76),
			BRONZE_DARK if built else (TEAL if unlocked else INK_700),
			1,
			5,
		))
		card.custom_minimum_size = Vector2(440, 206)
		var card_box := VBoxContainer.new()
		card_box.add_theme_constant_override("separation", 5)
		card.add_child(card_box)
		card_box.add_child(_label(building.get("name", ""), 25, PAPER_100 if unlocked else PAPER_500))
		card_box.add_child(_label(building.get("desc", ""), 15, PAPER_300 if unlocked else PAPER_500))
		var status := "已建成" if built else ("可建造" if unlocked else "累计 %d 胜开放" % int(building.get("unlock_victories", building.get("unlockVictories", 0))))
		card_box.add_child(_label(status, 15, BRONZE if built else (TEAL if unlocked else PAPER_500)))
		grid.add_child(card)
	var back_button := _button("返回行军图", show_map, false, 190)
	back_button.position = Vector2(50, 842)
	page.add_child(back_button)


func show_roster() -> void:
	_set_screen(SCREEN_ROSTER)
	var page := _new_screen()
	_background_image(page, "res://assets/environments/boar_forest.png", 0.82)
	_topbar(page, "roster")
	var heading := _label("梁山好汉", 48, PAPER_100)
	heading.position = Vector2(46, 102)
	heading.size = Vector2(590, 68)
	page.add_child(heading)
	var collection := _label("聚义簿 · %d / %d" % [state.recruited.size(), state.heroes().size()], 16, BRONZE)
	collection.position = Vector2(48, 180)
	page.add_child(collection)
	var scroll := ScrollContainer.new()
	scroll.position = Vector2(44, 226)
	scroll.size = Vector2(826, 635)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	page.add_child(scroll)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.custom_minimum_size = Vector2(806, 0)
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	scroll.add_child(grid)
	for hero_id in state.heroes():
		var hero: Dictionary = state.hero(hero_id)
		var recruited := state.recruited.has(hero_id)
		var card := PanelContainer.new()
		card.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.96), BRONZE_DARK if recruited else INK_700, 1, 5))
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		card.custom_minimum_size = Vector2(386, 350)
		card.clip_contents = true
		var image := TextureRect.new()
		image.custom_minimum_size = Vector2(402, 348)
		image.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		var card_box := VBoxContainer.new()
		card_box.add_theme_constant_override("separation", 4)
		card.add_child(card_box)
		if recruited and ResourceLoader.exists(hero.get("cutout", "")):
			image.texture = load(hero.cutout)
		else:
			card.modulate = Color(0.46, 0.5, 0.48, 0.85)
		card_box.add_child(image)
		var copy := VBoxContainer.new()
		copy.add_child(_label(hero.get("name", "") if recruited else "尚未结识", 21, PAPER_100))
		copy.add_child(_label("%s · %s" % [hero.get("star", ""), hero.get("nickname", "")] if recruited else "继续行军与聚义", 14, PAPER_300))
		card_box.add_child(copy)
		grid.add_child(card)
	var detail := PanelContainer.new()
	detail.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.96), BRONZE_DARK, 1, 5))
	detail.position = Vector2(892, 102)
	detail.size = Vector2(502, 758)
	page.add_child(detail)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 7)
	detail.add_child(box)
	var portrait := TextureRect.new()
	portrait.custom_minimum_size = Vector2(500, 400)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	var linchong: Dictionary = state.hero("linchong")
	if ResourceLoader.exists(linchong.get("keyart", "")):
		portrait.texture = load(linchong.keyart)
	box.add_child(portrait)
	box.add_child(_label("天雄星 · 豹子头", 15, BRONZE))
	box.add_child(_label("林冲", 34, PAPER_100))
	box.add_child(_label(linchong.get("bio", ""), 15, PAPER_300))
	var passive: Dictionary = linchong.get("passive", {})
	box.add_child(_label("星命被动 · %s\n%s" % [passive.get("name", ""), passive.get("desc", "")], 15, PAPER_200))


func assign_hero_to_team(hero_id: String) -> void:
	if state.team.has(hero_id):
		_toast("这名好汉已在队伍中。")
		return
	for index in state.team.size():
		if state.team[index].is_empty() or not state.recruited.has(state.team[index]):
			state.team[index] = hero_id
			state.save()
			_toast("已安排入队。")
			show_roster()
			return
	_toast("队伍已满，请替换一名好汉。")


func show_settings() -> void:
	if settings_layer.visible:
		return
	var restore_focus := get_viewport().gui_get_focus_owner()
	settings_layer.visible = true
	screen_root.mouse_filter = Control.MOUSE_FILTER_STOP
	settings_layer.set_meta("restore_focus", restore_focus)
	for child in settings_layer.get_children():
		settings_layer.remove_child(child)
		child.queue_free()
	var dim := ColorRect.new()
	dim.color = Color(3, 7, 8, 0.76)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	settings_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(INK_850, BRONZE_DARK, 1, 5))
	panel.position = Vector2(375, 165)
	panel.size = Vector2(690, 570)
	settings_layer.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 9)
	panel.add_child(box)
	box.add_child(_label("游戏设置", 36, PAPER_100))
	box.add_child(_label("称号", 20, BRONZE))
	var player_name := LineEdit.new()
	player_name.name = "PlayerName"
	player_name.text = state.player_name
	player_name.placeholder_text = "输入称号"
	player_name.max_length = 24
	player_name.custom_minimum_size = Vector2(0, 42)
	player_name.add_theme_stylebox_override("normal", _panel_style(INK_900, INK_700, 1, 4))
	player_name.add_theme_stylebox_override("focus", _panel_style(INK_900, BRONZE, 2, 4))
	player_name.text_changed.connect(func(value: String):
		var trimmed: String = value.strip_edges()
		state.player_name = trimmed if not trimmed.is_empty() else "无名星客"
	)
	box.add_child(player_name)
	var tests := HBoxContainer.new()
	tests.add_theme_constant_override("separation", 8)
	tests.add_child(_label("输入测试", 14, PAPER_300))
	tests.add_child(_button("复制称号", func():
		DisplayServer.clipboard_set(player_name.text)
		_toast("称号已复制，可按 %s + V 粘贴。" % ("Command" if OS.get_name() == "macOS" else "Ctrl"))
	, false, 160))
	tests.add_child(_button("直接粘贴", func():
		player_name.text = DisplayServer.clipboard_get()
		player_name.caret_column = player_name.text.length()
		player_name.text_changed.emit(player_name.text)
		player_name.grab_focus()
	, false, 160))
	box.add_child(tests)
	box.add_child(_label("音频", 20, BRONZE))
	box.add_child(_volume_row("配乐音量", "music_volume"))
	box.add_child(_volume_row("音效音量", "sfx_volume"))
	var auto := CheckButton.new()
	auto.text = "自动战斗"
	auto.button_pressed = bool(state.settings.get("auto_battle", true))
	auto.add_theme_font_override("font", SANS_FONT)
	auto.add_theme_font_size_override("font_size", 16)
	auto.toggled.connect(func(value): state.settings.auto_battle = value; state.save())
	box.add_child(auto)
	var reduce := CheckButton.new()
	reduce.text = "减少动态"
	reduce.button_pressed = bool(state.settings.get("reduced_motion", false))
	reduce.add_theme_font_override("font", SANS_FONT)
	reduce.add_theme_font_size_override("font_size", 16)
	reduce.toggled.connect(func(value): state.settings.reduced_motion = value; state.save())
	box.add_child(reduce)
	box.add_child(_sep())
	box.add_child(_label("存档", 20, BRONZE))
	box.add_child(_button("立即保存", func(): state.save(); _toast("战卷已保存。"), true, 280))
	box.add_child(_button("删除存档", confirm_delete_save, false, 280))
	box.add_child(_button("返回游戏", func():
		state.save()
		close_settings()
	, false, 280))
	player_name.grab_focus()


func _volume_row(text: String, key: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	var label := _label(text, 16, PAPER_200)
	label.custom_minimum_size.x = 120
	row.add_child(label)
	var slider := HSlider.new()
	slider.min_value = 0
	slider.max_value = 100
	slider.step = 1
	slider.value = int(round(float(state.settings.get(key, 0.65)) * 100))
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.value_changed.connect(func(value):
		state.settings[key] = value / 100.0
		if key == "music_volume":
			music_target_db = linear_to_db(maxf(value / 100.0, 0.001))
			music_player.volume_db = music_target_db
		state.save()
	)
	row.add_child(slider)
	return row


func close_settings() -> void:
	var restore_focus: Variant = settings_layer.get_meta("restore_focus", null)
	for child in settings_layer.get_children():
		settings_layer.remove_child(child)
		child.queue_free()
	state.save()
	settings_layer.visible = false
	screen_root.mouse_filter = Control.MOUSE_FILTER_PASS
	if restore_focus is Control and is_instance_valid(restore_focus) and restore_focus.is_visible_in_tree():
		restore_focus.grab_focus()


func confirm_delete_save() -> void:
	settings_layer.visible = false
	menu_layer.visible = true
	for child in menu_layer.get_children():
		child.queue_free()
	var dim := ColorRect.new()
	dim.color = Color(3, 7, 8, 0.8)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(INK_850, BRONZE_DARK, 1, 5))
	panel.position = Vector2(455, 332)
	panel.size = Vector2(530, 225)
	menu_layer.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	panel.add_child(box)
	box.add_child(_label("删去整卷？", 28, PAPER_100))
	box.add_child(_label("本地存档、章节进度与人物养成都会清除。", 16, PAPER_300))
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 10)
	box.add_child(actions)
	actions.add_child(_button("保留", func(): menu_layer.visible = false, false, 210))
	actions.add_child(_button("删除并返回标题", func():
		state.delete_save()
		state = GameState.new(game_data)
		menu_layer.visible = false
		show_title()
	, false, 210))


func _toast(text: String) -> void:
	toast_label.text = text
	toast_label.visible = true
	toast_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	toast_timer.start()


func _play_music(path: String) -> void:
	if music_track == path or not ResourceLoader.exists(path):
		return
	music_track = path
	music_player.stream = load(path)
	music_player.stream.loop = true
	music_target_db = linear_to_db(maxf(float(state.settings.get("music_volume", 0.65)), 0.001))
	music_player.volume_db = music_target_db
	music_player.play()
