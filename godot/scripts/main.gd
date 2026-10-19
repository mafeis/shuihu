extends Control

const SCREEN_TITLE := "title"
const SCREEN_MAP := "map"
const SCREEN_CAMP := "camp"
const SCREEN_ROSTER := "roster"
const SCREEN_STORY := "story"
const SCREEN_CHOICE := "choice"
const SCREEN_BATTLE := "battle"
const SCREEN_REWARD := "reward"
const SCREEN_ENDING := "ending"
const SCREEN_ARENA := "arena"
const SCREEN_ARENA_REWARD := "arena_reward"

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
const TOAST_RECT := Rect2(510, 22, 420, 46)

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
var transition_tween: Tween
var _ambient_layer: CanvasLayer
var _ambient_tween: Tween
var _last_settings_preset := ""
var _menu_back_callable := Callable()
var player_name_input: LineEdit
var selected_hero_id := "linchong"
var selected_team_slot := 0
var arena_wave := 1
var arena_offer: Array[String] = []
var arena_encounter_id := ""
var arena_running := false
var chronicle_hero_id := ""
var legend_running := false


func _ready() -> void:
	_configure_input()
	game_data = _load_game_data()
	get_tree().auto_accept_quit = false
	state = GameState.new(game_data)
	_apply_settings()
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
	if settings_layer.visible and _text_input_has_focus():
		return
	if event.keycode == KEY_ESCAPE and menu_layer.visible:
		get_viewport().set_input_as_handled()
		_dismiss_menu()
		return
	if event.keycode == KEY_ESCAPE and settings_layer.visible:
		close_settings()
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_ESCAPE and (screen == SCREEN_BATTLE or screen == SCREEN_ARENA_REWARD):
		if arena_running:
			show_arena()
		else:
			show_map()
		get_viewport().set_input_as_handled()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if state:
			state.settings.fullscreen = _is_fullscreen()
			state.save()
		if _ambient_tween:
			_ambient_tween.kill()
		if is_instance_valid(_ambient_layer):
			remove_child(_ambient_layer)
			_ambient_layer.queue_free()
		if music_player:
			music_player.stop()
			music_player.stream = null
		theme = null
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
	if transition_tween:
		transition_tween.kill()
	if _ambient_tween:
		_ambient_tween.kill()
	if is_instance_valid(_ambient_layer):
		remove_child(_ambient_layer)
		_ambient_layer.queue_free()
	_ambient_layer = null
	_ambient_tween = null
	for child in screen_root.get_children():
		screen_root.remove_child(child)
		child.queue_free()
	menu_layer.visible = false
	menu_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	settings_layer.visible = false
	var page := Control.new()
	page.name = "Page"
	page.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	screen_root.add_child(page)
	return page


func _background_image(page: Control, path: String, dim := 0.42) -> void:
	if path.is_empty() or not ResourceLoader.exists(path):
		return
	var image := TextureRect.new()
	var background_texture = load(path)
	if background_texture == null:
		return
	image.texture = background_texture
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


func _apply_settings() -> void:
	DisplayServer.window_set_mode(
		DisplayServer.WINDOW_MODE_FULLSCREEN if bool(state.settings.get("fullscreen", false))
		else DisplayServer.WINDOW_MODE_WINDOWED
	)
	if music_player:
		music_target_db = linear_to_db(maxf(float(state.settings.get("music_volume", 0.65)), 0.001))
		music_player.volume_db = music_target_db


func _is_fullscreen() -> bool:
	return DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN


func _dismiss_menu() -> void:
	var previous := _menu_back_callable
	_menu_back_callable = Callable()
	menu_layer.visible = false
	_clear_menu_layer()
	if previous.is_valid():
		previous.call()


func _topbar(page: Control, active := "") -> void:
	var backdrop := ColorRect.new()
	backdrop.color = Color(INK_950, 0.24)
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
	arena_running = false
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
		hero_image.texture = load(str(config.cutout))
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
	arena_running = false
	state = GameState.new(game_data)
	state.save()
	chapter_index = 0
	show_map()
	_toast("新卷已开：黄河渡口等你启程。")


func continue_game() -> void:
	if state.load_save():
		arena_running = false
		chapter_index = state.current_chapter
		show_map()
		_toast("旧卷已续。")
	else:
		_toast("未找到可用的旧卷。")


func show_map() -> void:
	arena_running = false
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
	_make_immersive(not bool(state.settings.get("reduced_motion", false)))


func _make_immersive(animate := true) -> void:
	if is_instance_valid(_ambient_layer):
		if _ambient_tween:
			_ambient_tween.kill()
			_ambient_tween = null
		remove_child(_ambient_layer)
		_ambient_layer.queue_free()
	_ambient_layer = CanvasLayer.new()
	_ambient_layer.layer = -1
	add_child(_ambient_layer)
	var background := TextureRect.new()
	var path := str(state.chapter().get("bg", ""))
	if ResourceLoader.exists(path):
		background.texture = load(path)
	background.scale = Vector2(0.97, 0.97)
	background.pivot_offset = Vector2(720, 450)
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ambient_layer.add_child(background)
	var dim := ColorRect.new()
	dim.color = Color(INK_950, 0.18)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ambient_layer.add_child(dim)
	if animate:
		background.modulate.a = 0.3
		background.create_tween().tween_property(background, "modulate:a", 1.0, 0.28)
		_ambient_tween = background.create_tween().set_loops()
		_ambient_tween.tween_property(background, "scale", Vector2(1.03, 1.03), 8.0).set_trans(Tween.TRANS_SINE)
		_ambient_tween.tween_property(background, "scale", Vector2.ONE, 8.0).set_trans(Tween.TRANS_SINE)


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
	var option_row := HBoxContainer.new()
	option_row.add_theme_constant_override("separation", 10)
	option_row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(option_row)
	for index in options.size():
		var option: Dictionary = options[index]
		var tactic: Dictionary = option.get("tactic", {})
		var choice := _button(
			"%02d\n%s\n\n%s" % [index + 1, option.get("text", ""), tactic.get("name", "")],
			func(): choose_option(index),
			false,
			250,
		)
		choice.custom_minimum_size.y = 258
		choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		choice.alignment = HORIZONTAL_ALIGNMENT_LEFT
		choice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		option_row.add_child(choice)
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
	var battle_bg := str(battle.chapter_data.get("bg", state.chapter().get("bg", "")))
	_background_image(page, battle_bg, 0.48)
	_topbar(page, "map")
	var battle_title := str(battle.chapter_data.get("title", state.chapter().get("title", "")))
	var round_badge := ("好汉列传 · %s · 回合 %d" % [battle_title, battle.round_number]) if legend_running else ("第 %d 回 · %s · 回合 %d" % [chapter_index + 1, battle_title, battle.round_number])
	var title := _label(round_badge, 17, PAPER_200)
	title.position = Vector2(36, 86)
	title.size = Vector2(996, 46)
	page.add_child(title)
	var arena := PanelContainer.new()
	arena.add_theme_stylebox_override("panel", _panel_style(Color(INK_950, 0.14), Color(BRONZE_DARK, 0.5), 1, 5))
	arena.position = Vector2(32, 137)
	arena.size = Vector2(996, 724)
	page.add_child(arena)
	var arena_box := VBoxContainer.new()
	arena_box.add_theme_constant_override("separation", 12)
	arena.add_child(arena_box)
	var enemy_row := HBoxContainer.new()
	enemy_row.alignment = BoxContainer.ALIGNMENT_CENTER
	enemy_row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	enemy_row.add_theme_constant_override("separation", 16)
	arena_box.add_child(enemy_row)
	_enemy_positions(enemy_row)
	var field_note := _separator_row()
	var note := _label("敌阵 · 点选人物更换招式目标", 14, PAPER_300)
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	field_note.add_child(note)
	center_on_row(field_note, 460)
	arena_box.add_child(field_note)
	var hero_row := HBoxContainer.new()
	hero_row.alignment = BoxContainer.ALIGNMENT_CENTER
	hero_row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	hero_row.add_theme_constant_override("separation", 12)
	arena_box.add_child(hero_row)
	var rule: Dictionary = battle.chapter_data.get("special_rule", {})
	if not rule.is_empty() and bool(state.settings.get("battle_hints", true)):
		var rule_panel := PanelContainer.new()
		rule_panel.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.9), Color(BRONZE_DARK, 0.65), 1, 3))
		var rule_label := _label("战法 · %s\n%s" % [rule.get("name", ""), rule.get("desc", "")], 14, PAPER_200)
		rule_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		rule_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		rule_panel.custom_minimum_size.y = 52
		rule_panel.add_child(rule_label)
		arena_box.add_child(rule_panel)
	if arena_running and battle.chain_ready:
		var chain_hint := _label("星路已合 · " + battle.chain_formation().get("name", "三星同辉"), 15, BRONZE)
		chain_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		arena_box.add_child(chain_hint)
	_hero_positions(hero_row)
	var command := PanelContainer.new()
	command.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.97), BRONZE_DARK, 1, 5))
	command.position = Vector2(1048, 86)
	command.size = Vector2(364, 784)
	page.add_child(command)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	command.add_child(box)
	if battle.battle_finished:
		box.add_child(_label("战阵已结", 30, BRONZE))
		box.add_child(_label("我军胜利。" if battle.victory else "我军败退。", 20, PAPER_100))
		var result_callback: Callable = _finish_legend_victory if battle.victory and legend_running else (show_reward if battle.victory else start_battle)
		box.add_child(_button("查看战果" if battle.victory else "重新整备", result_callback, true, 280))
		box.add_child(_button("返回行军图", show_map, false, 280))
		return
	var actor: Dictionary = battle.current_hero()
	box.add_child(_label("行动 · %s  Lv.%d\n生命 %d / %d     义气 %d / 100" % [actor.get("name", ""), actor.get("level", 1), actor.hp, actor.max_hp, actor.yiqi], 16, PAPER_100))
	var target_name := "无目标"
	var targets := battle.valid_targets(battle.selected_skill())
	if not targets.is_empty() and not battle.is_targeting_all():
		battle_target = clampi(battle_target, 0, targets.size() - 1)
		target_name = str(targets[battle_target].get("name", ""))
	elif battle.is_ally_target(battle.selected_skill()):
		target_name = "最需援手者"
	box.add_child(_label("锁定 · " + target_name, 15, BRONZE))
	if battle.chain_ready:
		var chain_button := _button("合击 · " + battle.chain_formation().get("name", "三星同辉"), perform_chain, true, 288)
		box.add_child(chain_button)
	var skill_heading := _label("招式", 14, PAPER_500)
	box.add_child(skill_heading)
	for index in actor.skills.size():
		var skill_data: Dictionary = actor.skills[index]
		var select_skill := func():
			battle.select_skill(index)
			show_battle()
		var skill_button := _button(
			"%d    %s\n%s" % [
				index + 1,
				skill_data.get("name", ""),
				str(skill_data.get("desc", "")).left(54),
			],
			select_skill,
			false,
			288
		)
		skill_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		skill_button.custom_minimum_size.y = 62
		if index == battle.selected_skill_index:
			skill_button.add_theme_stylebox_override("normal", _panel_style(Color("#253433"), BRONZE_DARK, 2, 4))
		if not battle.can_use_skill(skill_data):
			skill_button.modulate = Color(0.58, 0.63, 0.61, 0.82)
		box.add_child(skill_button)
	var attack := _button("施展「%s」" % battle.selected_skill().get("name", "招式"), perform_attack, true, 288)
	attack.disabled = not battle.can_use_selected_skill()
	box.add_child(attack)
	box.add_child(_button("撤退" if arena_running else ("离开列传" if legend_running else "返回行军图"), abandon_battle, false, 288))
	var log_box := VBoxContainer.new()
	log_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(_sep())
	for line in battle.log_lines.slice(0, 5):
		log_box.add_child(_label(line, 14, PAPER_300))
	box.add_child(log_box)


func _enemy_positions(enemy_row: HBoxContainer) -> void:
	for row in 3:
		var lane := VBoxContainer.new()
		lane.custom_minimum_size = Vector2(310, 0)
		lane.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lane.alignment = BoxContainer.ALIGNMENT_CENTER
		lane.add_theme_constant_override("separation", 5)
		enemy_row.add_child(lane)
		var lane_units: Array[Dictionary] = battle.enemies.filter(func(unit): return int(unit.hp) > 0 and int(unit.row) == row)
		if lane_units.is_empty():
			var empty := _label("空", 15, PAPER_500)
			empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			lane.add_child(empty)
			continue
		for enemy in lane_units:
			var enemy_id := str(enemy.get("enemy_id", ""))
			var card := _battle_sprite(enemy, false, _selected_enemy_id() == enemy_id)
			card.tooltip_text = "点选%s作为当前招式目标" % enemy.get("name", "敌人")
			card.gui_input.connect(func(event: InputEvent):
				if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
					battle_target = _living_enemy_position(battle.enemies.find(enemy))
					show_battle()
			)
			lane.add_child(card)


func _hero_positions(hero_row: HBoxContainer) -> void:
	for row in 3:
		var lane := VBoxContainer.new()
		lane.custom_minimum_size = Vector2(310, 0)
		lane.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lane.alignment = BoxContainer.ALIGNMENT_CENTER
		lane.add_theme_constant_override("separation", 5)
		hero_row.add_child(lane)
		var lane_units: Array[Dictionary] = battle.heroes.filter(func(unit): return int(unit.row) == row)
		if lane_units.is_empty():
			var empty := _label("空阵", 15, PAPER_500)
			empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			lane.add_child(empty)
			continue
		for hero_unit in lane_units:
			var card := _battle_sprite(hero_unit, true, hero_unit == battle.current_hero())
			card.tooltip_text = "查看%s的武备与状态" % hero_unit.get("name", "好汉")
			card.gui_input.connect(func(event: InputEvent):
				if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
					_show_hero_detail(str(hero_unit.get("hero_id", "")))
			)
			lane.add_child(card)


func _separator_row() -> HBoxContainer:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.custom_minimum_size.y = 20
	return row


func center_on_row(control: Control, width: float) -> void:
	control.custom_minimum_size.x = width
	control.size_flags_horizontal = Control.SIZE_SHRINK_CENTER


func _battle_sprite(unit: Dictionary, hero_side: bool, current: bool) -> PanelContainer:
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(292, 284) if hero_side else Vector2(292, 248)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.size_flags_vertical = Control.SIZE_EXPAND_FILL
	card.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.7), BRONZE if current else INK_700, 2 if current else 1, 5))
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	card.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var box := VBoxContainer.new()
	card.add_child(box)
	var image := TextureRect.new()
	image.custom_minimum_size.y = 150 if hero_side else 122
	image.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	image.size_flags_vertical = Control.SIZE_EXPAND_FILL
	image.size_flags_stretch_ratio = 1.2 if hero_side else 1.0
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if ResourceLoader.exists(unit.get("portrait", "")):
		image.texture = load(str(unit.portrait))
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(image)
	var locked := not hero_side and current
	var heading := _label("%s%s\nLv.%d · %s" % [
		"目标  " if locked else "",
		unit.get("name", ""),
		unit.get("level", 1),
		"前阵" if int(unit.row) == 0 else ("中军" if int(unit.row) == 1 else "后阵"),
	], 16, BRONZE if locked else PAPER_100)
	box.add_child(heading)
	var hp := ProgressBar.new()
	hp.max_value = unit.max_hp
	hp.value = unit.hp
	hp.size_flags_vertical = Control.SIZE_SHRINK_END
	hp.show_percentage = false
	hp.custom_minimum_size.y = 9
	hp.add_theme_stylebox_override("background", _panel_style(INK_700, INK_700, 0, 2))
	hp.add_theme_stylebox_override("fill", _panel_style(TEAL if hero_side else CINNABAR, Color(0, 0, 0, 0), 0, 2))
	box.add_child(hp)
	var statuses := _unit_statuses(unit)
	box.add_child(_label("生命 %d / %d   %s" % [unit.hp, unit.max_hp, statuses], 13, PAPER_300))
	return card


func _unit_statuses(unit: Dictionary) -> String:
	var active: Array[String] = []
	for status in unit.get("statuses", {}):
		var duration := int(unit.statuses[status])
		if duration > 0:
			active.append("%s %d" % [_status_label(status), duration])
	return "  ".join(active) if not active.is_empty() else "无异常"


func _status_label(status: String) -> String:
	return {"guard": "护御", "armorBreak": "破甲", "bleeding": "流血", "stun": "眩晕", "sealed": "封穴", "inspiration": "鼓舞"}.get(status, status)


func _show_hero_detail(hero_id: String) -> void:
	var config := state.hero(hero_id)
	var stats := state.derive_hero_stats(hero_id)
	menu_layer.visible = true
	for child in menu_layer.get_children():
		menu_layer.remove_child(child)
		child.queue_free()
	var dim := ColorRect.new()
	dim.color = Color(INK_950, 0.76)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(INK_850, BRONZE_DARK, 1, 5))
	panel.position = Vector2(418, 135)
	panel.size = Vector2(604, 630)
	menu_layer.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 9)
	panel.add_child(box)
	var image := TextureRect.new()
	image.custom_minimum_size = Vector2(0, 310)
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if ResourceLoader.exists(config.get("keyart", "")):
		image.texture = load(str(config.keyart))
	box.add_child(image)
	box.add_child(_label("%s · Lv.%d\n%s" % [config.get("name", ""), stats.level, config.get("role", "")], 25, PAPER_100))
	box.add_child(_label("生命 %d   攻击 %d   护御 %d   身法 %d" % [stats.max_hp, stats.atk, stats.def, stats.spd], 16, BRONZE))
	var gear: Dictionary = state.roster_entry(hero_id).get("equipment", {})
	var gear_lines: Array[String] = []
	for slot in ["weapon", "armor", "token"]:
		var item_id := str(gear.get(slot, ""))
		gear_lines.append(state.equipment(item_id).get("name", "未装备"))
	box.add_child(_label("兵器  %s\n衣甲  %s\n随身  %s" % gear_lines, 16, PAPER_200))
	var close_detail := _button("回到战阵", func(): menu_layer.visible = false, false, 240)
	box.add_child(close_detail)
	close_detail.grab_focus()


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
		image.texture = load(str(unit.portrait))
	row.add_child(image)
	var copy := VBoxContainer.new()
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(copy)
	copy.add_child(_label("%s\n%s" % [unit.get("name", ""), unit.get("nickname", "")], 19, PAPER_100))
	copy.add_child(_label("生命 %d / %d     护御 %d" % [unit.hp, unit.max_hp, int(unit.get("statuses", {}).get("guard", 0))], 14, PAPER_300))
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
	if str(battle.selected_skill().get("target", "")) in ["ally", "allAllies"]:
		battle_target = battle.target_auto_index(battle.selected_skill())
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


func perform_chain() -> void:
	if battle == null:
		return
	var result := battle.chain_attack()
	if not result.ok:
		_toast("三路星火尚未蓄势。")
	if battle.battle_finished:
		if battle.victory:
			_finish_victory()
		else:
			show_battle()
		return
	show_battle()


func abandon_battle() -> void:
	if arena_running:
		arena_running = false
		show_arena()
	elif legend_running:
		legend_running = false
		battle = null
		show_camp()
	else:
		show_map()


func _finish_victory() -> void:
	if arena_running:
		_finish_arena_victory()
		return
	var chapter: Dictionary = state.chapter()
	var chapter_id := str(chapter.get("id", ""))
	var battle_data: Dictionary = chapter.get("battle", {})
	if not state.rewards_granted.has(chapter_id):
		var reward: Dictionary = battle_data.get("reward", {})
		state.copper += int(round(float(reward.get("copper", 0)) * battle.difficulty_rewards))
		state.recruit(battle_data.get("recruit", []))
		for hero_id in state.active_team():
			battle.level_ups += state.grant_experience(hero_id, int(round(float(reward.get("xp", 0)) * battle.difficulty_rewards)))
		var item_id := str(reward.get("item", ""))
		if not item_id.is_empty():
			state.add_item(item_id)
		state.rewards_granted[chapter_id] = true
	state.complete_chapter(chapter_id)
	state.record_battle_progress(battle)
	for formation_id in battle.chain_formation_ids:
		if not state.chain_archive.has(formation_id):
			state.chain_archive.append(formation_id)
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
	if battle.level_ups > 0:
		box.add_child(_label("战阵磨砺，好汉有所精进。", 16, BRONZE))
	var settlement = chapter.get("battle", {}).get("settlement", "")
	box.add_child(_button("继续" if settlement != "ending" else "收束星命", func():
		if settlement == "ending":
			show_ending()
			return
		story_stage = "outro"
		story_line = 0
		show_story()
	, true, 330))
	box.add_child(_button("返回行军图", show_map, false, 330))


func show_ending() -> void:
	_set_screen(SCREEN_ENDING)
	_play_music("res://assets/audio/ending_theme.mp3")
	var ending_id := state.resolve_ending()
	state.save()
	var ending_data: Dictionary = game_data.get("endings", {}).get(ending_id, {})
	var page := _new_screen()
	_background_image(page, "res://assets/environments/liangshan_water_fort.png", 0.52)
	_topbar(page, "map")
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.95), BRONZE_DARK, 1, 5))
	panel.position = Vector2(170, 126)
	panel.size = Vector2(1100, 690)
	page.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	panel.add_child(box)
	box.add_child(_label("梁山终卷 · " + state.player_name, 16, BRONZE))
	box.add_child(_label(ending_data.get("title", "江湖归舟"), 64, PAPER_100))
	box.add_child(_label(ending_data.get("subtitle", ""), 24, BRONZE))
	box.add_child(_label(ending_data.get("text", ""), 18, PAPER_200))
	box.add_child(_sep())
	box.add_child(_label(ending_data.get("epilogue", ""), 18, PAPER_300))
	box.add_child(_label("已录结局  %d / 3     结义  %d / %d     营建  %d 座" % [
		state.endings_unlocked.size(),
		state.recruited.size(),
		state.heroes().size(),
		state.camp_built.size(),
	], 16, BRONZE))
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 10)
	var camp_return := func():
		if state.camp_built.has("hall"):
			show_camp_building("hall")
		else:
			show_camp()
	actions.add_child(_button("回到聚义厅", camp_return, true, 280))
	actions.add_child(_button("重返标题", show_title, false, 200))
	box.add_child(actions)


func show_camp() -> void:
	_set_screen(SCREEN_CAMP)
	_play_music("res://assets/audio/qingfeng_theme.mp3")
	var page := _new_screen()
	_background_image(page, "res://assets/environments/liangshan_water_fort.png", 0.64)
	_topbar(page, "camp")
	var heading := _label("梁山营寨", 48, PAPER_100)
	heading.position = Vector2(48, 104)
	heading.size = Vector2(690, 68)
	page.add_child(heading)
	var stats := _label("铜钱  %d 贯     存粮  %d份     胜阵  %d" % [state.copper, state.camp_stock.get("steamed_bun", 0), state.statistics.battles_won], 16, BRONZE)
	stats.position = Vector2(900, 111)
	stats.size = Vector2(490, 50)
	stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	page.add_child(stats)
	var ground := Control.new()
	ground.name = "CampGround"
	ground.clip_contents = true
	ground.position = Vector2(44, 184)
	ground.size = Vector2(978, 680)
	page.add_child(ground)
	var ground_frame := PanelContainer.new()
	ground_frame.add_theme_stylebox_override("panel", _panel_style(Color(INK_950, 0.42), Color(BRONZE_DARK, 0.65), 1, 4))
	ground_frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ground_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ground.add_child(ground_frame)
	var markers := Control.new()
	markers.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	markers.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ground.add_child(markers)
	var path_line := ColorRect.new()
	path_line.color = Color(BRONZE_DARK, 0.28)
	path_line.position = Vector2(108, 340)
	path_line.size = Vector2(755, 2)
	path_line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	markers.add_child(path_line)
	for building_id in game_data.get("camp_buildings", {}):
		var building: Dictionary = game_data.camp_buildings[building_id]
		var unlocked: bool = state.statistics.battles_won >= int(building.get("unlockVictories", 0))
		var built := state.camp_built.has(building_id)
		var size_data: Array = building.get("size", [1, 1])
		var marker_size := Vector2(126.0 * int(size_data[0]), 122.0 * int(size_data[1]))
		marker_size.y = minf(marker_size.y, 136.0 - float(maxi(0, int(building.get("row", 1)) - 4)) * 16.0)
		var open_building := func(): show_camp_building(building_id)
		var marker := _button(
			"",
			open_building,
			false,
			118,
		)
		marker.tooltip_text = "%s · %s" % [
			building.get("name", ""),
			("Lv.%d" % state.building_level(building_id)) if built else ("新建" if unlocked else "胜利 %d 场后解锁" % int(building.get("unlockVictories", 0))),
		]
		marker.position = Vector2(48 + float(int(building.get("col", 1)) - 1) * 167.0, 75 + float(int(building.get("row", 1)) - 1) * 112.0)
		marker.size = marker_size
		marker.custom_minimum_size = marker_size
		marker.clip_text = true
		marker.mouse_filter = Control.MOUSE_FILTER_STOP
		marker.add_theme_stylebox_override("normal", _panel_style(Color(0, 0, 0, 0), BRONZE_DARK if built else (TEAL if unlocked else INK_700), 1, 3))
		ground.add_child(marker)
		var building_label := _label("%s\n%s" % [
			building.get("name", ""),
			("Lv.%d" % state.building_level(building_id)) if built else ("新建" if unlocked else "胜利 %d 场解锁" % int(building.get("unlockVictories", 0))),
		], 16, PAPER_100 if unlocked else PAPER_500)
		building_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		building_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		building_label.position = marker.position
		building_label.size = marker_size
		building_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		ground.add_child(building_label)
	var side := VBoxContainer.new()
	side.position = Vector2(1054, 184)
	side.size = Vector2(346, 680)
	side.add_theme_constant_override("separation", 10)
	page.add_child(side)
	side.add_child(_label("营中日常", 17, BRONZE))
	side.add_child(_label("休整让众人累积历练；产品可入厨成食，也可作为下一战的路粮。", 15, PAPER_300))
	var rest_cost := state.camp_rest_cost()
	side.add_child(_button("休整全营  ·  %d 贯" % rest_cost, camp_rest_action, false, 300))
	side.add_child(_button("查看仓储与工坊", show_camp_store, false, 300))
	side.add_child(_button("梁山演武", show_arena, true, 300))
	side.add_child(_sep())
	side.add_child(_label("结义羁绊  %d / %d" % [state.bond_archive.size(), game_data.get("bonds", {}).size()], 17, BRONZE))
	var shown := 0
	for bond in state.active_bonds():
		side.add_child(_label("%s\n%s" % [bond.get("name", ""), str(bond.get("desc", "")).left(64)], 14, PAPER_200))
		shown += 1
		if shown >= 3:
			break
	if shown == 0:
		side.add_child(_label("调整三路阵势，可让相熟好汉结下羁绊。", 14, PAPER_500))
	side.add_child(_button("查看好汉列传", show_chronicles, false, 300))
	var back_button := _button("返回行军图", show_map, false, 190)
	back_button.position = Vector2(50, 842)
	page.add_child(back_button)


func camp_rest_action() -> void:
	var cost := state.camp_rest_cost()
	if cost < 0:
		_toast("存粮不足，需要至少一份馒头。")
		return
	var xp := state.camp_rest()
	if xp == 0:
		_toast("铜钱不足，无法休整。")
		return
	state.save()
	_toast("众人休整完毕，各得 %d 历练，共耗 %d 贯和一份馒头。" % [xp, cost])
	show_camp()


func show_chronicles() -> void:
	menu_layer.visible = true
	_menu_back_callable = show_camp
	_clear_menu_layer()
	var dim := ColorRect.new()
	dim.name = "MenuDimmer"
	dim.color = Color(INK_950, 0.8)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu_layer.add_child(dim)
	var panel := UISlidePanel.new()
	panel.add_theme_stylebox_override("panel", _panel_style(INK_850, BRONZE_DARK, 1, 5))
	panel.position = Vector2(180, 86)
	panel.size = Vector2(1080, 728)
	menu_layer.add_child(panel)
	var box := VBoxContainer.new()
	box.offset_left = 24
	box.offset_right = -24
	box.offset_top = 18
	box.offset_bottom = -18
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	var chronicle_heading := _label("好汉列传", 36, PAPER_100)
	chronicle_heading.custom_minimum_size.y = 48
	box.add_child(chronicle_heading)
	box.add_child(_label("每人的列传按战阵推进。完成终章后可结识新的好汉。", 15, PAPER_300))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(1016, 570)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	box.add_child(scroll)
	var quest_list := VBoxContainer.new()
	quest_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	quest_list.add_theme_constant_override("separation", 8)
	scroll.add_child(quest_list)
	var shown := 0
	for hero_id in state.recruited:
		for quest in game_data.get("hero_quests", {}).get(hero_id, []):
			var quest_id := str(quest.get("id", ""))
			var objective: Dictionary = quest.get("objective", {})
			var metric := str(objective.get("metric", "wins"))
			var progress := int(state.quest_progress.get(hero_id, {}).get(metric, 0))
			var target := int(objective.get("target", 1))
			var claimed := state.quest_claimed.has(quest_id)
			var locked := state.current_chapter + 1 < int(quest.get("requiredChapter", 1))
			var status := "已完成" if claimed else ("尚未开启" if locked else ("可领取" if progress >= target else "%d / %d" % [mini(progress, target), target]))
			var action_label := "点击领取" if status == "可领取" else ("达成后领取" if not claimed and not locked else "")
			var stage_titles := ["序章", "战功", "终章"]
			var line := _button("%s · Lv.%d    %s · %s\n%s\n任务  %s    ·    %s" % [
				state.hero(hero_id).get("name", ""),
				int(state.derive_hero_stats(hero_id).level),
				stage_titles[clampi(int(quest.get("stage", 1)) - 1, 0, 2)],
				quest.get("title", ""),
				objective.get("label", ""),
				status,
				action_label,
			], func():
				chronicle_hero_id = hero_id
				claim_quest(hero_id, quest_id)
			, false, 1010)
			line.custom_minimum_size.y = 84
			line.alignment = HORIZONTAL_ALIGNMENT_LEFT
			line.disabled = claimed or progress < target or locked
			quest_list.add_child(line)
			shown += 1
	if shown == 0:
		quest_list.add_child(_label("尚无列传。先携好汉取得战阵胜利。", 16, PAPER_500))
	if not chronicle_hero_id.is_empty():
		var legend := state.hero_legend(chronicle_hero_id)
		if not legend.is_empty():
			var heading := PanelContainer.new()
			heading.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.96), BRONZE_DARK, 1, 4))
			var heading_copy := VBoxContainer.new()
			heading_copy.add_theme_constant_override("separation", 4)
			heading.add_child(heading_copy)
			heading_copy.offset_left = 12
			heading_copy.offset_right = -12
			var legend_title := _label("%s列传 · %s" % [state.hero(chronicle_hero_id).get("name", ""), legend.get("title", "")], 20, PAPER_100)
			legend_title.custom_minimum_size.y = 28
			heading_copy.add_child(legend_title)
			var legend_copy := _label("地点  %s\n%s" % [legend.get("location", ""), legend.get("readyText", "")], 15, PAPER_300)
			legend_copy.custom_minimum_size.y = 58
			legend_copy.max_lines_visible = 2
			heading_copy.add_child(legend_copy)
			var legend_rule := _label("终章战法 · %s\n%s" % [legend.get("rule", {}).get("name", ""), legend.get("rule", {}).get("desc", "")], 14, BRONZE)
			legend_rule.custom_minimum_size.y = 42
			legend_rule.max_lines_visible = 2
			heading_copy.add_child(legend_rule)
			var completed := state.legend_claimed.has(str(legend.get("id", "")))
			var ready := state.hero_legend_ready(chronicle_hero_id)
			var requirement := ""
			if not ready and not completed:
				requirement = "需完成本列传三篇异闻，当前 %d / 3；抵达第 %d 回且 Lv.%d。" % [
					state.hero_legend_progress(chronicle_hero_id),
					int(legend.get("requiredChapter", 1)),
					int(legend.get("minLevel", 1)),
				]
			heading_copy.add_child(_label("终章  " + ("已录" if completed else ("可战" if ready else "未开启")) + ("    " + requirement if not requirement.is_empty() else ""), 14, PAPER_500))
			var action := _button("已录列传" if completed else "迎战终章", func(): start_hero_legend(chronicle_hero_id), true, 250)
			action.disabled = completed or not ready
			heading_copy.add_child(action)
			quest_list.add_child(heading)
	var back_focus := _button("回到营寨", _dismiss_menu, false, 260)
	box.add_child(back_focus)
	panel.prepare(Vector2(180, 86), not bool(state.settings.get("reduced_motion", false)))
	panel.reveal()
	back_focus.grab_focus()


func claim_quest(hero_id: String, quest_id: String) -> void:
	var result := state.claim_hero_quest(hero_id, quest_id)
	if not result.ok:
		_toast("列传尚未完成。")
		return
	state.save()
	var unlocked_names: Array[String] = []
	for new_hero_id in result.get("heroes", []):
		unlocked_names.append(str(state.hero(new_hero_id).get("name", new_hero_id)))
	_toast("%s列传完成，铜钱与历练已入账。%s" % [
		state.hero(hero_id).get("name", ""),
		"  新入伙：" + "、".join(unlocked_names) if not unlocked_names.is_empty() else "",
	])
	show_chronicles()


func start_hero_legend(hero_id: String) -> void:
	if not state.hero_legend_ready(hero_id):
		_toast("列传三篇或所需等级尚未完成。")
		return
	var legend := state.hero_legend(hero_id)
	var battle_data := {
		"title": legend.get("title", ""),
		"bg": legend.get("bg", state.chapter().get("bg", "")),
		"battle": {
			"boss": false,
			"enemies": legend.get("enemies", []),
		},
		"special_rule": legend.get("rule", {}),
	}
	chronicle_hero_id = hero_id
	legend_running = true
	arena_running = false
	menu_layer.visible = false
	battle = BattleModel.new(state, battle_data, {}, legend.get("enemyModifiers", {}))
	battle_target = 0
	_set_screen(SCREEN_BATTLE)
	_play_music("res://assets/audio/battle_theme.mp3")
	show_battle()


func _finish_legend_victory() -> void:
	var legend := state.hero_legend(chronicle_hero_id)
	if not legend.is_empty():
		var legend_id := str(legend.get("id", ""))
		if not state.legend_claimed.has(legend_id):
			state.legend_claimed.append(legend_id)
			var reward: Dictionary = legend.get("reward", {})
			state.copper += int(reward.get("copper", 0))
			state.grant_experience(chronicle_hero_id, int(reward.get("xp", 0)))
			state.add_item(str(reward.get("item", "")), int(reward.get("amount", 1)))
			state.record_battle_progress(battle)
			state.save()
	legend_running = false
	show_camp()
	show_chronicles()
	_toast("%s列传终章已录，铜钱、历练与随身物已入账。" % state.hero(chronicle_hero_id).get("name", ""))


func show_camp_building(building_id: String) -> void:
	var building: Dictionary = game_data.get("camp_buildings", {}).get(building_id, {})
	if building.is_empty():
		return
	var built := state.camp_built.has(building_id)
	var unlocked: bool = state.statistics.battles_won >= int(building.get("unlockVictories", 0))
	var facility: Dictionary = game_data.get("facilities", {}).get(building_id, {})
	menu_layer.visible = true
	_clear_menu_layer()
	var dim := ColorRect.new()
	dim.color = Color(INK_950, 0.75)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(INK_850, BRONZE_DARK, 1, 5))
	panel.position = Vector2(430, 184)
	panel.size = Vector2(580, 534)
	menu_layer.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 11)
	panel.add_child(box)
	box.add_child(_label(building.get("name", ""), 38, PAPER_100))
	box.add_child(_label(str(building.get("desc", "")) + "\n" + str(facility.get("desc", "")), 16, PAPER_300))
	var status := "尚未建成" if not built else "营建等级  Lv.%d / %d" % [state.building_level(building_id), int(facility.get("maxLevel", 1))]
	box.add_child(_label(status, 16, BRONZE if built else (TEAL if unlocked else PAPER_500)))
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	box.add_child(actions)
	if not built:
		var build := _button("破土动工  %d 贯" % int(building.get("cost", 0)), func(): build_from_detail(building_id), true, 240)
		build.disabled = not unlocked or state.copper < int(building.get("cost", 0))
		actions.add_child(build)
	else:
		var cost := state.upgrade_cost(building_id)
		if cost >= 0:
			var upgrade := _button("升营  %d 贯" % cost, func(): upgrade_from_detail(building_id), true, 240)
			upgrade.disabled = state.copper < cost
			actions.add_child(upgrade)
		if not str(building.get("resource", "")).is_empty():
			actions.add_child(_button("收成", func(): collect_from_detail(building_id), false, 120))
		if building_id == "arena":
			actions.add_child(_button("演武", show_arena, false, 120))
	for recipe in game_data.get("camp_recipes", []):
		if recipe.get("buildingId", "") != building_id:
			continue
		var product: Dictionary = game_data.get("camp_products", {}).get(recipe.get("output", {}).get("item", ""), {})
		var input_data: Dictionary = recipe.get("input", {})
		var input_name := str(game_data.get("camp_products", {}).get(input_data.get("item", ""), {}).get("name", input_data.get("item", "")))
		var craft := _button("%s  ·  %d %s  ->  %d %s" % [
			recipe.get("name", ""), int(input_data.get("amount", 0)), input_name,
			int(recipe.get("output", {}).get("amount", 0)), product.get("name", ""),
		], func(): craft_from_detail(str(recipe.get("id", ""))), false, 390)
		craft.disabled = int(state.camp_stock.get(input_data.get("item", ""), 0)) < int(input_data.get("amount", 0))
		box.add_child(craft)
	box.add_child(_label("库存  " + _stock_summary(), 15, PAPER_300))
	box.add_child(_button("回到营寨", func(): menu_layer.visible = false; show_camp(), false, 280))


func _stock_summary() -> String:
	if state.camp_stock.is_empty():
		return "仓中尚无收成"
	var entries: Array[String] = []
	for product_id in state.camp_stock:
		var product: Dictionary = game_data.get("camp_products", {}).get(product_id, {})
		entries.append("%s %d" % [product.get("name", product_id), int(state.camp_stock[product_id])])
	return "   ".join(entries)


func build_from_detail(building_id: String) -> void:
	if state.build_camp_building(building_id):
		state.save()
		_toast("营区已经落成。")
		show_camp_building(building_id)
	else:
		_toast("战功或铜钱不足，暂时无法营建。")


func upgrade_from_detail(building_id: String) -> void:
	if state.upgrade_facility(building_id):
		state.save()
		_toast("营建等级提升。")
		show_camp_building(building_id)
	else:
		_toast("铜钱不足或已经升至上限。")


func collect_from_detail(building_id: String) -> void:
	var amount := state.collect_camp_resource(building_id)
	if amount <= 0:
		_toast("此处尚无可收取的资源。")
		return
	state.save()
	_toast("已收取 %d 份资源。" % amount)
	show_camp_building(building_id)


func craft_from_detail(recipe_id: String) -> void:
	if state.craft_camp_recipe(recipe_id):
		state.save()
		_toast("工坊已成一份。")
		var recipe: Dictionary = {}
		for entry in game_data.get("camp_recipes", []):
			if entry.get("id", "") == recipe_id:
				recipe = entry
		if not recipe.is_empty():
			show_camp_building(str(recipe.buildingId))
	else:
		_toast("原料不足，暂不能开炉。")


func _clear_menu_layer() -> void:
	for child in menu_layer.get_children():
		menu_layer.remove_child(child)
		child.queue_free()


func show_camp_store() -> void:
	menu_layer.visible = true
	_clear_menu_layer()
	var dim := ColorRect.new()
	dim.color = Color(INK_950, 0.78)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(INK_850, BRONZE_DARK, 1, 5))
	panel.position = Vector2(368, 142)
	panel.size = Vector2(704, 620)
	menu_layer.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	panel.add_child(box)
	box.add_child(_label("水泊仓房", 35, PAPER_100))
	for product_id in game_data.get("camp_products", {}):
		var product: Dictionary = game_data.camp_products[product_id]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		row.add_child(_label(product.get("name", product_id), 17, PAPER_200))
		var gap := Control.new()
		gap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(gap)
		row.add_child(_label("%d 份" % int(state.camp_stock.get(product_id, 0)), 16, BRONZE))
		box.add_child(row)
	box.add_child(_sep())
	box.add_child(_label("兵器与行装", 25, BRONZE))
	var weapons := 0
	for item_id in state.inventory:
		var item := state.equipment(item_id)
		if item.is_empty() or int(state.inventory.get(item_id, 0)) <= 0:
			continue
		box.add_child(_label("%s  × %d     %s" % [item.get("name", item_id), int(state.inventory[item_id]), item.get("slot", "")], 15, PAPER_300))
		weapons += 1
	if weapons == 0:
		box.add_child(_label("仓中的备用兵器已分配完毕。", 15, PAPER_500))
	box.add_child(_button("回到营寨", func(): menu_layer.visible = false; show_camp(), false, 250))


func show_roster() -> void:
	_set_screen(SCREEN_ROSTER)
	var page := _new_screen()
	_background_image(page, "res://assets/environments/liangshan_water_fort.png", 0.62)
	_topbar(page, "roster")
	var heading := _label("梁山好汉", 48, PAPER_100)
	heading.position = Vector2(46, 102)
	heading.size = Vector2(590, 68)
	page.add_child(heading)
	var collection := _label("聚义簿 · %d / %d" % [state.recruited.size(), state.heroes().size()], 16, BRONZE)
	collection.position = Vector2(48, 180)
	collection.size = Vector2(310, 28)
	collection.autowrap_mode = TextServer.AUTOWRAP_OFF
	page.add_child(collection)
	var formation := PanelContainer.new()
	formation.add_theme_stylebox_override("panel", _panel_style(Color(INK_950, 0.47), Color(BRONZE_DARK, 0.65), 1, 4))
	formation.position = Vector2(44, 222)
	formation.size = Vector2(816, 486)
	formation.custom_minimum_size = Vector2(816, 486)
	formation.clip_contents = true
	page.add_child(formation)
	var lanes := HBoxContainer.new()
	lanes.add_theme_constant_override("separation", 12)
	formation.add_child(lanes)
	for row in 3:
		var lane := VBoxContainer.new()
		lane.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lane.custom_minimum_size = Vector2(258, 476)
		lane.add_theme_constant_override("separation", 9)
		lane.clip_contents = true
		lanes.add_child(lane)
		lane.add_child(_label(["前阵", "中军", "后阵"][row] + "  ·  " + ["护势", "接应", "奇袭"][row], 17, BRONZE))
		var hero_id: String = state.team[row]
		var selected := selected_team_slot == row
		var hero: Dictionary = state.hero(hero_id)
		var image := TextureRect.new()
		image.custom_minimum_size = Vector2(250, 285)
		image.size_flags_vertical = Control.SIZE_EXPAND_FILL
		image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		image.mouse_filter = Control.MOUSE_FILTER_IGNORE
		image.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		if not hero.is_empty() and ResourceLoader.exists(hero.get("cutout", "")):
			image.texture = load(str(hero.cutout))
		var slot := _button(
			("%s\n%s" % [hero.get("name", ""), "Lv.%d" % state.derive_hero_stats(hero_id).level]) if not hero.is_empty() else "空阵\n点此安排",
			func(): select_formation_slot(row),
			selected,
			250,
		)
		slot.custom_minimum_size.y = 58
		slot.size_flags_vertical = Control.SIZE_SHRINK_END
		lane.add_child(slot)
		if image.texture:
			lane.add_child(image)
	var scroll := ScrollContainer.new()
	scroll.position = Vector2(44, 724)
	scroll.size = Vector2(816, 122)
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	page.add_child(scroll)
	var bench := HBoxContainer.new()
	bench.add_theme_constant_override("separation", 7)
	scroll.add_child(bench)
	for hero_id in state.recruited:
		var hero: Dictionary = state.hero(hero_id)
		var portrait := _button(hero.get("name", "") + "\n" + ("入阵" if state.team.has(hero_id) else "待命"), func(): select_hero(hero_id), selected_hero_id == hero_id, 112)
		portrait.custom_minimum_size.y = 124
		bench.add_child(portrait)
	var detail := PanelContainer.new()
	detail.add_theme_stylebox_override("panel", _panel_style(Color(INK_900, 0.96), BRONZE_DARK, 1, 5))
	detail.position = Vector2(892, 102)
	detail.size = Vector2(502, 758)
	page.add_child(detail)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 7)
	detail.add_child(box)
	var selected_hero: Dictionary = state.hero(selected_hero_id)
	if not state.recruited.has(selected_hero_id):
		selected_hero = state.hero("linchong")
	var portrait := TextureRect.new()
	portrait.custom_minimum_size = Vector2(500, 348)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	if ResourceLoader.exists(selected_hero.get("keyart", "")):
		portrait.texture = load(str(selected_hero.keyart))
	portrait.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	box.add_child(portrait)
	var hero_stats := state.derive_hero_stats(str(selected_hero.get("id", "linchong")))
	box.add_child(_label("%s · %s · %s" % [selected_hero.get("star", ""), selected_hero.get("nickname", ""), selected_hero.get("role", "")], 15, BRONZE))
	var hero_heading := _label("%s   Lv.%d" % [selected_hero.get("name", ""), int(hero_stats.level)], 34, PAPER_100)
	hero_heading.autowrap_mode = TextServer.AUTOWRAP_OFF
	hero_heading.custom_minimum_size.y = 54
	box.add_child(hero_heading)
	box.add_child(_label("生命 %d   攻击 %d   护御 %d   身法 %d" % [hero_stats.max_hp, hero_stats.atk, hero_stats.def, hero_stats.spd], 15, PAPER_200))
	var passive: Dictionary = selected_hero.get("passive", {})
	box.add_child(_label("星命被动 · %s\n%s" % [passive.get("name", ""), passive.get("desc", "")], 15, PAPER_200))
	var team_action := _button(
		"撤出三路阵势" if state.team.has(selected_hero_id) else "编入%s" % ["前阵", "中军", "后阵"][selected_team_slot],
		func(): toggle_team_member(selected_hero_id),
		true,
		280,
	)
	box.add_child(team_action)
	box.add_child(_button("查看武备", func(): show_equipment(selected_hero_id), false, 280))
	box.add_child(_button("返回行军图", show_map, false, 280))


func assign_hero_to_team(hero_id: String) -> void:
	if state.team.has(hero_id):
		for index in state.team.size():
			if state.team[index] == hero_id:
				selected_team_slot = index
		show_roster()
		return
	for index in state.team.size():
		if state.team[index].is_empty() or not state.recruited.has(state.team[index]):
			state.team[index] = hero_id
			selected_team_slot = index
			state.save()
			_toast("已安排入队。")
			show_roster()
			return
	state.set_team_slot(selected_team_slot, hero_id)
	state.save()
	_toast("三路阵势已经调整。")
	show_roster()


func select_formation_slot(row: int) -> void:
	selected_team_slot = clampi(row, 0, 2)
	show_roster()


func select_hero(hero_id: String) -> void:
	selected_hero_id = hero_id
	show_roster()


func toggle_team_member(hero_id: String) -> void:
	if state.team.has(hero_id):
		for row in state.team.size():
			if state.team[row] == hero_id:
				state.team[row] = ""
		state.save()
		show_roster()
		return
	assign_hero_to_team(hero_id)


func show_equipment(hero_id: String) -> void:
	var config := state.hero(hero_id)
	if config.is_empty() or not state.recruited.has(hero_id):
		return
	menu_layer.visible = true
	_clear_menu_layer()
	var dim := ColorRect.new()
	dim.color = Color(INK_950, 0.78)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(INK_850, BRONZE_DARK, 1, 5))
	panel.position = Vector2(330, 108)
	panel.size = Vector2(780, 708)
	menu_layer.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	var stats := state.derive_hero_stats(hero_id)
	box.add_child(_label("武备 · %s  Lv.%d" % [config.get("name", ""), stats.level], 28, PAPER_100))
	box.add_child(_label("生命 %d   攻击 %d   护御 %d   身法 %d" % [stats.max_hp, stats.atk, stats.def, stats.spd], 16, BRONZE))
	var gear: Dictionary = state.roster_entry(hero_id).get("equipment", {})
	for slot in ["weapon", "armor", "token"]:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var item_id := str(gear.get(slot, ""))
		var item := state.equipment(item_id)
		var label := _label("%s   %s" % [{"weapon": "兵器", "armor": "衣甲", "token": "随身"}[slot], item.get("name", "未装备")], 16, PAPER_200)
		label.custom_minimum_size = Vector2(240, 28)
		label.autowrap_mode = TextServer.AUTOWRAP_OFF
		row.add_child(label)
		if not item.is_empty():
			var stats_text := _item_stats(item)
			var stats_label := _label(stats_text, 14, PAPER_300)
			stats_label.custom_minimum_size.y = 28
			stats_label.autowrap_mode = TextServer.AUTOWRAP_OFF
			row.add_child(stats_label)
		var spacer := Control.new()
		spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(spacer)
		if not item_id.is_empty():
			row.add_child(_button("卸下", func(): unequip_from_detail(hero_id, slot), false, 90))
		box.add_child(row)
	box.add_child(_sep())
	box.add_child(_label("仓中可换武备", 18, BRONZE))
	var slider := ScrollContainer.new()
	slider.custom_minimum_size = Vector2(700, 280)
	slider.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	box.add_child(slider)
	var choices := VBoxContainer.new()
	choices.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	choices.add_theme_constant_override("separation", 6)
	slider.add_child(choices)
	var available := 0
	for candidate_id in state.inventory:
		if int(state.inventory.get(candidate_id, 0)) <= 0:
			continue
		var candidate := state.equipment(candidate_id)
		if candidate.is_empty():
			continue
		var equip_button := _button("%s   × %d\n%s" % [
			candidate.get("name", candidate_id), int(state.inventory[candidate_id]), _item_stats(candidate),
		], func(): equip_from_detail(hero_id, str(candidate_id)), false, 660)
		equip_button.custom_minimum_size.y = 64
		equip_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		choices.add_child(equip_button)
		available += 1
	if available == 0:
		choices.add_child(_label("暂无备用兵器，继续行军可缴获更多。", 15, PAPER_500))
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	actions.add_child(_button("全部推荐", auto_equip_from_detail.bind(hero_id), true, 220))
	actions.add_child(_button("返回阵势", show_roster, false, 220))
	box.add_child(actions)


func _item_stats(item: Dictionary) -> String:
	var stats: Dictionary = item.get("stats", {})
	return "生命 +%d  攻击 +%d  护御 +%d  身法 +%d" % [
		int(stats.get("hp", 0)), int(stats.get("atk", 0)),
		int(stats.get("def", 0)), int(stats.get("spd", 0)),
	]


func equip_from_detail(hero_id: String, item_id: String) -> void:
	if state.equip_item(hero_id, item_id):
		state.save()
		show_equipment(hero_id)
	else:
		_toast("这件武备当前无法装备。")


func unequip_from_detail(hero_id: String, slot: String) -> void:
	if state.unequip_item(hero_id, slot):
		state.save()
		show_equipment(hero_id)


func auto_equip_from_detail(hero_id: String) -> void:
	var recommendations := state.recommended_equipment(hero_id)
	var equipped := 0
	for slot in recommendations:
		if state.equip_item(hero_id, str(recommendations[slot].item_id)):
			equipped += 1
	state.save()
	_toast("已为%s换装 %d 件。" % [state.hero(hero_id).get("name", ""), equipped])
	show_equipment(hero_id)


func show_arena() -> void:
	if not state.camp_built.has("arena"):
		if not state.build_camp_building("arena"):
			_toast("演武场尚未落成：需累计两场胜阵并备足铜钱。")
			return
		state.save()
	arena_running = false
	_set_screen(SCREEN_ARENA)
	_play_music("res://assets/audio/battle_theme.mp3")
	var page := _new_screen()
	_background_image(page, "res://assets/environments/liangshan_water_fort.png", 0.63)
	_topbar(page, "camp")
	arena_wave = maxi(arena_wave, 1)
	if arena_offer.is_empty():
		_roll_arena_offer()
	var heading := _label("梁山演武", 50, PAPER_100)
	heading.position = Vector2(48, 94)
	heading.size = Vector2(620, 70)
	page.add_child(heading)
	var arena_subtitle := _label("第 %d 阵  ·  最佳 %d 阵     连阵不会消耗行军机会" % [arena_wave, state.best_arena_wave], 17, BRONZE)
	arena_subtitle.position = Vector2(50, 160)
	arena_subtitle.size = Vector2(980, 30)
	arena_subtitle.autowrap_mode = TextServer.AUTOWRAP_OFF
	page.add_child(arena_subtitle)
	var board := PanelContainer.new()
	board.add_theme_stylebox_override("panel", _panel_style(Color(INK_950, 0.58), Color(BRONZE_DARK, 0.65), 1, 4))
	board.position = Vector2(44, 198)
	board.size = Vector2(999, 650)
	page.add_child(board)
	var board_box := VBoxContainer.new()
	board_box.add_theme_constant_override("separation", 12)
	board_box.offset_left = 16
	board_box.offset_right = -16
	board_box.offset_top = 14
	board_box.offset_bottom = -14
	board.add_child(board_box)
	board_box.add_child(_label("三路战帖", 19, PAPER_100))
	board_box.add_child(_label("破阵所得可带走；败退则保留已取得的令与经验。", 15, PAPER_300))
	var encounter: Dictionary = game_data.get("arena_encounters", {}).get(arena_encounter_id, {})
	var encounter_copy := _label("今日敌阵 · " + encounter.get("name", "") + "\n" + encounter.get("desc", ""), 17, PAPER_200)
	encounter_copy.custom_minimum_size.y = 72
	encounter_copy.autowrap_mode = TextServer.AUTOWRAP_OFF
	board_box.add_child(encounter_copy)
	var offer_row := HBoxContainer.new()
	offer_row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	offer_row.add_theme_constant_override("separation", 10)
	offer_row.custom_minimum_size.y = 450
	board_box.add_child(offer_row)
	for boon_id in arena_offer:
		var boon: Dictionary = game_data.get("arena_boons", {}).get(boon_id, {})
		var choose := Button.new()
		choose.text = "选此令"
		choose.custom_minimum_size = Vector2(300, 450)
		choose.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		choose.size_flags_vertical = Control.SIZE_EXPAND_FILL
		choose.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		choose.pressed.connect(func(): begin_arena_battle(boon_id))
		choose.add_theme_stylebox_override("normal", _panel_style(Color(INK_900, 0.95), INK_700, 1, 4))
		choose.add_theme_stylebox_override("hover", _panel_style(Color("#1c2a2b"), BRONZE, 1, 4))
		var card_copy := VBoxContainer.new()
		card_copy.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		card_copy.offset_left = 16
		card_copy.offset_right = -16
		card_copy.offset_top = 16
		card_copy.offset_bottom = -16
		card_copy.mouse_filter = Control.MOUSE_FILTER_IGNORE
		card_copy.add_theme_constant_override("separation", 10)
		card_copy.add_child(_label(boon.get("name", ""), 23, PAPER_100))
		var boon_copy := _label(boon.get("desc", ""), 16, PAPER_300)
		boon_copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		boon_copy.custom_minimum_size = Vector2(260, 84)
		card_copy.add_child(boon_copy)
		var room := Control.new()
		room.size_flags_vertical = Control.SIZE_EXPAND_FILL
		card_copy.add_child(room)
		card_copy.add_child(_label("选此令", 16, BRONZE))
		choose.add_child(card_copy)
		offer_row.add_child(choose)
	var rail := VBoxContainer.new()
	rail.position = Vector2(1060, 198)
	rail.size = Vector2(336, 650)
	rail.custom_minimum_size = Vector2(336, 650)
	rail.add_theme_constant_override("separation", 10)
	page.add_child(rail)
	rail.add_child(_label("演武录", 18, BRONZE))
	rail.add_child(_label("已结阵形  %d / %d\n已录羁绊  %d / %d\n最佳波次  %d" % [
		state.chain_archive.size(), game_data.get("chain_formations", {}).size(),
		state.bond_archive.size(), game_data.get("bonds", {}).size(), state.best_arena_wave,
	], 16, PAPER_200))
	rail.add_child(_sep())
	rail.add_child(_button("重新抽取战帖", _reroll_arena_offer, false, 300))
	rail.add_child(_button("先回营整备", show_roster, false, 300))
	rail.add_child(_button("返回营寨", show_camp, false, 300))


func _roll_arena_offer() -> void:
	var candidates := []
	for boon_id in game_data.get("arena_boons", {}):
		candidates.append(boon_id)
	candidates.shuffle()
	arena_offer.clear()
	for index in mini(3, candidates.size()):
		arena_offer.append(str(candidates[index]))
	var encounters: Array[String] = []
	for encounter_id in game_data.get("arena_encounters", {}):
		var encounter: Dictionary = game_data.arena_encounters[encounter_id]
		if int(encounter.get("minWave", 1)) <= arena_wave:
			encounters.append(str(encounter_id))
	arena_encounter_id = encounters.pick_random() if not encounters.is_empty() else "iron_phalanx"


func _reroll_arena_offer() -> void:
	arena_offer.clear()
	show_arena()


func begin_arena_battle(boon_id: String) -> void:
	var boon: Dictionary = game_data.get("arena_boons", {}).get(boon_id, {})
	var encounter: Dictionary = game_data.get("arena_encounters", {}).get(arena_encounter_id, {})
	var battle_data := {
		"id": "arena_%d" % arena_wave,
		"title": "梁山演武 · 第 %d 阵" % arena_wave,
		"bg": "res://assets/environments/liangshan_water_fort.png",
		"battle": {
			"enemies": [
				{"id": "runner", "level": 2 + arena_wave, "row": 0},
				{"id": "archer", "level": 2 + arena_wave, "row": 2},
				{"id": "captain" if arena_wave % 3 == 0 else "instructor", "level": 3 + arena_wave, "row": 1},
			],
		},
	}
	var effects: Dictionary = encounter.get("effects", {})
	var team_modifiers: Dictionary = boon.get("effects", {}).duplicate(true)
	for key in effects.get("teamModifiers", {}):
		team_modifiers[key] = float(team_modifiers.get(key, 0.0)) + float(effects.teamModifiers[key])
	var enemy_modifiers: Dictionary = encounter.get("enemyModifiers", {}).duplicate(true)
	arena_running = true
	battle = BattleModel.new(state, battle_data, team_modifiers, enemy_modifiers)
	battle.arena_encounter = encounter
	battle_target = 0
	show_battle()


func _finish_arena_victory() -> void:
	var copper_reward := 60 + arena_wave * 14
	var xp_reward := 34 + arena_wave * 7
	state.copper += copper_reward
	for hero_id in state.active_team():
		state.grant_experience(hero_id, xp_reward)
	state.best_arena_wave = maxi(state.best_arena_wave, arena_wave)
	state.save()
	_set_screen(SCREEN_ARENA_REWARD)
	var page := _new_screen()
	_background_image(page, "res://assets/environments/liangshan_water_fort.png", 0.55)
	_topbar(page, "camp")
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(INK_900, BRONZE_DARK, 1, 5))
	panel.position = Vector2(410, 210)
	panel.size = Vector2(620, 470)
	page.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	box.offset_left = 18
	box.offset_right = -18
	box.offset_top = 18
	box.offset_bottom = -18
	panel.add_child(box)
	box.add_child(_label("演武 · 第 %d 阵破" % arena_wave, 34, PAPER_100))
	box.add_child(_label("铜钱 +%d     全队历练 +%d\n铜钱 %d" % [copper_reward, xp_reward, state.copper], 18, PAPER_200))
	box.add_child(_button("再下一阵", func(): arena_wave += 1; arena_offer.clear(); arena_running = false; show_arena(), true, 380))
	box.add_child(_button("回营整备", func(): arena_running = false; show_camp(), false, 380))
	box.add_child(_button("回行军图", func(): arena_running = false; show_map(), false, 380))


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
	var panel := UISlidePanel.new()
	panel.add_theme_stylebox_override("panel", _panel_style(INK_850, BRONZE_DARK, 1, 5))
	panel.position = Vector2(390, 84)
	panel.size = Vector2(660, 734)
	settings_layer.add_child(panel)
	var box := VBoxContainer.new()
	box.offset_left = 18
	box.offset_right = -18
	box.offset_top = 16
	box.offset_bottom = -16
	box.add_theme_constant_override("separation", 7)
	box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_child(box)
	var settings_title := _label("游戏设置", 32, PAPER_100)
	settings_title.custom_minimum_size.y = 44
	box.add_child(settings_title)
	box.add_child(_label("江湖称号", 15, BRONZE))
	var player_name := LineEdit.new()
	player_name.name = "PlayerName"
	player_name.text = state.player_name
	player_name.placeholder_text = "输入称号"
	player_name.max_length = 24
	player_name.custom_minimum_size = Vector2(0, 42)
	player_name.add_theme_font_override("font", SANS_FONT)
	player_name.add_theme_font_size_override("font_size", 18)
	player_name.add_theme_color_override("font_color", PAPER_100)
	player_name.add_theme_color_override("font_placeholder_color", PAPER_500)
	player_name.add_theme_color_override("caret_color", BRONZE)
	player_name.add_theme_color_override("selection_color", Color(BRONZE_DARK, 0.55))
	player_name.add_theme_stylebox_override("normal", _panel_style(INK_900, INK_700, 1, 4))
	player_name.add_theme_stylebox_override("focus", _panel_style(INK_900, BRONZE, 2, 4))
	player_name.add_theme_constant_override("caret_width", 2)
	box.add_child(player_name)
	player_name.text_changed.connect(func(value: String):
		var trimmed: String = value.strip_edges()
		state.player_name = trimmed if not trimmed.is_empty() else "无名星客"
	)
	var copy_name := _button("复制中文", func():
		DisplayServer.clipboard_set(player_name.text)
		_toast("称号已复制。")
	, false, 192)
	var paste_name := _button("粘贴中文", func():
		player_name.text = DisplayServer.clipboard_get().left(24)
		player_name.caret_column = player_name.text.length()
		player_name.text_changed.emit(player_name.text)
		player_name.grab_focus()
		_toast("已从剪贴板粘贴。")
	, false, 192)
	var clipboard_actions := HBoxContainer.new()
	clipboard_actions.add_theme_constant_override("separation", 6)
	clipboard_actions.add_child(copy_name)
	clipboard_actions.add_child(paste_name)
	box.add_child(clipboard_actions)
	box.add_child(_label("键盘输入中文没有生效时，可直接粘贴。", 14, PAPER_500))
	box.add_child(_label("音频", 17, BRONZE))
	box.add_child(_volume_row("配乐音量", "music_volume"))
	box.add_child(_volume_row("音效音量", "sfx_volume"))
	var display_section := UICollapsibleSection.new().setup("显示", true)
	display_section.set_animated(not bool(state.settings.get("reduced_motion", false)))
	var fullscreen := CheckBox.new()
	fullscreen.text = "全屏显示"
	fullscreen.button_pressed = bool(state.settings.get("fullscreen", false))
	fullscreen.add_theme_font_override("font", SANS_FONT)
	fullscreen.add_theme_font_size_override("font_size", 15)
	fullscreen.toggled.connect(func(value):
		state.settings.fullscreen = value
		state.save()
		_apply_settings()
	)
	display_section.content.add_child(fullscreen)
	var reduce := CheckBox.new()
	reduce.text = "减少界面动画"
	reduce.button_pressed = bool(state.settings.get("reduced_motion", false))
	reduce.add_theme_font_override("font", SANS_FONT)
	reduce.add_theme_font_size_override("font_size", 15)
	reduce.toggled.connect(func(value): state.settings.reduced_motion = value; state.save())
	display_section.content.add_child(reduce)
	var auto := CheckBox.new()
	auto.text = "战斗中显示战法提示"
	auto.button_pressed = bool(state.settings.get("battle_hints", true))
	auto.add_theme_font_override("font", SANS_FONT)
	auto.add_theme_font_size_override("font_size", 15)
	auto.toggled.connect(func(value): state.settings.battle_hints = value; state.save())
	display_section.content.add_child(auto)
	box.add_child(display_section)
	box.add_child(_sep())
	box.add_child(_label("存档", 17, BRONZE))
	var save_actions := HBoxContainer.new()
	save_actions.add_theme_constant_override("separation", 6)
	save_actions.add_child(_button("立即保存", func(): state.save(); _toast("战卷已保存。"), true, 196))
	save_actions.add_child(_button("删除存档", confirm_delete_save, false, 196))
	box.add_child(save_actions)
	box.add_child(_button("保存并返回游戏", func():
		state.save()
		close_settings()
	, false, 398))
	player_name_input = player_name
	player_name.grab_focus()
	panel.prepare(Vector2(390, 84), not bool(state.settings.get("reduced_motion", false)))
	panel.reveal()


func focus_player_name() -> void:
	if player_name_input == null:
		return
	player_name_input.grab_focus()


func _text_input_has_focus() -> bool:
	var focus := get_viewport().gui_get_focus_owner()
	return focus != null and (focus is LineEdit or focus is TextEdit)


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
	toast_label.position = Vector2(round((get_viewport_rect().size.x - TOAST_RECT.size.x) / 2), TOAST_RECT.position.y)
	toast_label.size = TOAST_RECT.size
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
