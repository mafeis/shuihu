const TITLE_FINAL_FRAME = {
  id: "title-match",
  asset: "/assets/video/bianjing_snow_night_poster.webp",
  focal: "66% center",
  label: "风雪山神庙 · 序",
  title: "星命开卷",
  text: "旧路已断，新的星命从这一夜写起。",
};

const ORIGINAL_OPENING_SCENES = [
  {
    id: "bianjing-edict",
    asset: "/assets/environments/bianjing_snow_night.webp",
    focal: "66% center",
    label: "宣和年间 · 东京汴梁",
    title: "雪落禁门",
    text: "一纸冤案，把八十万禁军教头逐出了东京。",
  },
  {
    id: "cangzhou-road",
    asset: "/assets/environments/boar_forest.webp",
    focal: "48% center",
    label: "沧州道 · 风雪",
    title: "归路尽断",
    text: "高俅的刀迟迟没有落下，却把林冲的每一条归路都封死。",
  },
  {
    id: "yellow-river",
    asset: "/assets/environments/yellow_river_ferry.webp",
    focal: "center",
    label: "黄河渡口 · 夜",
    title: "无路可走",
    text: "官差封了渡口。鲁智深却把船撑向不肯认命的人。",
  },
  TITLE_FINAL_FRAME,
];

const OPENING_COMMON_SCENES = [
  {
    id: "longhu-prologue",
    asset: "/assets/environments/longhu_mountain.webp",
    focal: "center",
    label: "楔子 · 龙虎山",
    title: "星落人间",
    text: "伏魔殿封条被揭，一百单八星从此散入北宋山河。",
  },
  {
    id: "shijia-village",
    asset: "/assets/environments/shijia_village.webp",
    focal: "center",
    label: "少华山 · 史家村",
    title: "少年结义",
    text: "史进烧掉家业，带着一身枪棒走上江湖。",
  },
  {
    id: "huangni-ridge",
    asset: "/assets/environments/huangni_ridge.webp",
    focal: "center",
    label: "黄泥冈 · 夏日",
    title: "七星聚义",
    text: "一担生辰纲，把七位好汉的名字写进同一条路。",
  },
  ...ORIGINAL_OPENING_SCENES,
];

const ENDING_OPENING_ECHO = {
  brotherhood: {
    id: "echo-brotherhood",
    asset: "/assets/environments/liangshan_water_fort.webp",
    focal: "center",
    label: "旧卷回响 · 梁山不散",
    title: "替天行道",
    text: "上一卷，水泊留下了流民、炉火与不肯低头的姓名。",
  },
  order: {
    id: "echo-order",
    asset: "/assets/environments/bianjing_snow_night.webp",
    focal: "66% center",
    label: "旧卷回响 · 风雪入长安",
    title: "一念招安",
    text: "上一卷，你带着条件接过招安文书，把旧案重新推回朝堂。",
  },
  freedom: {
    id: "echo-freedom",
    asset: "/assets/environments/yellow_river_ferry.webp",
    focal: "center",
    label: "旧卷回响 · 江湖归舟",
    title: "山水不相欠",
    text: "上一卷，你拆去寨墙，让水泊成为可以来、也可以走的港湾。",
  },
};

const ENDING_CINEMATICS = {
  brotherhood: {
    id: "brotherhood",
    title: "替天行道",
    tone: "gold",
    background: "/assets/environments/liangshan_water_fort.webp",
    echo: "你把每一道选择都落在眼前的人身上，梁山因此不只是一个寨子。",
    frames: [
      {
        label: "水泊 · 聚义厅",
        title: "替天行道",
        text: "官军退去，寨门却没有关闭。流民、匠人与旧部第一次站到了同一面旗下。",
        asset: "/assets/environments/liangshan_water_fort.webp",
        focal: "center",
        portrait: "songjiang",
      },
      {
        label: "梁山 · 军帐",
        title: "守住这条活路",
        text: "林冲把最后一封招安文书压在案底。众人决定留下，不是为了称王，而是为了守住这条活路。",
        asset: "/assets/environments/damingfu_lantern_night.webp",
        focal: "center",
        portrait: "linchong",
      },
      {
        label: "多年后 · 山神庙",
        title: "风雪有归处",
        text: "水泊仍在教乡民使枪、读书、渡河。每年雪落，山神庙前总会多一炷香。",
        asset: "/assets/environments/boar_forest.webp",
        focal: "48% center",
        portrait: null,
      },
    ],
  },
  order: {
    id: "order",
    title: "一念招安",
    tone: "blue",
    background: "/assets/environments/bianjing_snow_night.webp",
    echo: "你把证据与退路留到了最后，招安因此成为一场有条件的交易。",
    frames: [
      {
        label: "东京 · 宣德门",
        title: "风雪入长安",
        text: "梁山接下招安，却拒绝交出林冲。招安文书第一次写上了梁山提出的条件。",
        asset: "/assets/environments/bianjing_snow_night.webp",
        focal: "66% center",
        portrait: "songjiang",
      },
      {
        label: "大名府 · 旧案",
        title: "旧案重审",
        text: "高俅被迫交出部分罪证，禁军旧案重开。清白来得太迟，却让活着的人多了一条路。",
        asset: "/assets/environments/damingfu_lantern_night.webp",
        focal: "center",
        portrait: "linchong",
      },
      {
        label: "禁军旧营 · 雪",
        title: "枪架未冷",
        text: "林冲重回旧营，知道这不是功成名就，只是让后来者不必再走同一条绝路。",
        asset: "/assets/environments/bianjing_snow_night.webp",
        focal: "42% center",
        portrait: null,
      },
    ],
  },
  freedom: {
    id: "freedom",
    title: "江湖归舟",
    tone: "teal",
    background: "/assets/environments/yellow_river_ferry.webp",
    echo: "你一次次替众人留下退路，归舟因此不是散伙，而是另一种同行。",
    frames: [
      {
        label: "水泊 · 拆寨",
        title: "江湖归舟",
        text: "梁山拆去部分寨墙，水寨变成商船、渔户与流民共同停靠的港湾。",
        asset: "/assets/environments/liangshan_water_fort.webp",
        focal: "center",
        portrait: "yanqing",
      },
      {
        label: "黄河 · 夜渡",
        title: "顺流而下",
        text: "林冲与鲁智深登船离岸。没有王旗，也没有官印，只有愿意彼此作证的姓名。",
        asset: "/assets/environments/yellow_river_ferry.webp",
        focal: "center",
        portrait: "linchong",
      },
      {
        label: "江南 · 酒肆",
        title: "山水不相欠",
        text: "后来有人见戴宗替人送信，也见武松在景阳冈外饮酒。林冲再也没有留下确切去处。",
        asset: "/assets/environments/boar_forest.webp",
        focal: "48% center",
        portrait: null,
      },
    ],
  },
};

export function openingCinematicProfile(state, options = {}) {
  const titleAsset = options.titleAsset || TITLE_FINAL_FRAME.asset;
  const scenes = OPENING_COMMON_SCENES.map((scene) =>
    scene === TITLE_FINAL_FRAME ? { ...scene, asset: titleAsset } : scene,
  );
  const endingId = state?.ending;
  const echo = ENDING_OPENING_ECHO[endingId];
  if (!echo) {
    return {
      variant: "first-cycle",
      scenes,
    };
  }
  return {
    variant: endingId,
    scenes: [
      echo,
      ...scenes.slice(1),
    ],
  };
}

export function endingCinematicProfile(endingId, state) {
  const cinematic = ENDING_CINEMATICS[endingId] || ENDING_CINEMATICS.brotherhood;
  const decisionCount = Object.keys(state?.choices || {}).length;
  return {
    ...cinematic,
    decisionCount,
    frames: cinematic.frames.map((frame) => ({ ...frame })),
  };
}

export function cinematicImageFit(kind = "backdrop") {
  return kind === "portrait" ? "contain" : "cover";
}
