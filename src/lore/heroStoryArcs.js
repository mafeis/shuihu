const arc = (id, title, premise, epithet, metric, target, label) => ({
  title,
  premise,
  epithet,
  objective: { metric, target, label },
});

const HERO_STORY_ARCS = {
  dongping: {
    chapter: 4,
    location: "东平府城门",
    intro: "东平府的城门已闭，董平却仍记得那对双枪守过多少百姓。梁山兵临城下，他要先辨清自己守的是城门，还是城中豪强。",
    choice: {
      prompt: "城门里的百姓被官军挟作人质，董平如何开城？",
      options: [
        { text: "先开侧门接百姓出来，再回身夺门。", effect: { brotherhood: 2 }, response: "董平亲守侧门，等到最后一户百姓出城，才回身把双枪架在守军面前。" },
        { text: "以旧官军身份传令，诱开城门。", effect: { order: 2 }, response: "董平借旧令稳住守军，梁山从水门进街，城中百姓没有卷入第一轮刀兵。" },
      ],
    },
    quests: [
      arc(
        "dongping",
        "双枪守门",
        "东平府城头换了一面旗，董平却仍记挂曾被留在城外的百姓。他要用一场胜仗证明，自己的双枪不只替官军开门。",
        "双枪未卸",
        "wins",
        2,
        "携董平取得 2 场胜利",
      ),
      arc(
        "dongping",
        "旧军空令",
        "一封旧军令仍被守军当作开城凭据。董平认出其中急切催战的口吻，必须在梁山破门前让它变成百姓撤退的路标。",
        "东平识令",
        "ultimates",
        2,
        "发动 2 次董平义技",
      ),
      arc(
        "dongping",
        "双枪归旗",
        "城门已开，董平不愿只看胜负。他带梁山旧部清点仓中粮草，把夺来的军械先换成百姓过冬的口粮。",
        "东平双枪",
        "damage",
        1900,
        "以董平累计造成 1900 伤害",
      ),
    ],
  },
  suochao: {
    chapter: 6,
    location: "大名府校场",
    intro: "明朝急先锋的性子还是那样，校场鼓点一响便要抢在众人前面。梁山这一回要清点城中的伤兵，他必须先学会怎样不丢下身后的人。",
    choice: {
      prompt: "官军正在弃城，索超先追敌还是先护伤兵？",
      options: [
        { text: "先收伤兵，再秦明等同伴合击追兵。", effect: { brotherhood: 2 }, response: "索超把伤兵一一送上马车，追到城门时，秦明与花荣已从两翼截住官军。" },
        { text: "先夺军械库，切断敌军补给的去路。", effect: { order: 2 }, response: "索超一斧劈开军械库封条，官军失去补给，追兵也只能退回城外。" },
      ],
    },
    quests: [
      arc(
        "suochao",
        "校场急鼓",
        "大名府校场上的鼓点催得比从前更急。索超要在梁山新阵里压下抢先冲阵的旧习惯，先听完军师所报的伤兵路线。",
        "急锋先行",
        "wins",
        2,
        "携索超取得 2 场胜利",
      ),
      arc(
        "suochao",
        "大名收兵",
        "城破后官军散入街巷，索超若再只凭一股急气追赶，便会把梁山也引向百姓的居所。他要在军械库前收住斧锋。",
        "止锋护民",
        "ultimates",
        2,
        "发动 2 次索超义技",
      ),
      arc(
        "suochao",
        "急锋归阵",
        "索超终于明白急先锋的名号不该只比谁先出刀。他把先行的路用来探明城门与粮道，让梁山大军少走一段险路。",
        "急先锋归队",
        "damage",
        2000,
        "以索超累计造成 2000 伤害",
      ),
    ],
  },
  muhong: {
    chapter: 6,
    location: "揭阳镇渡口",
    intro: "揭阳镇穆家旧部沿着江岸来投，穆弘在江州法场才真正认下梁山。他要让旧日恶名变成护船人的名号，不叫私税船夫再把舵手逼下水。",
    choice: {
      prompt: "穆弘的旧部被官船围住，梁山如何接应？",
      options: [
        { text: "穆弘先登旧船，替船户挡住官差。", effect: { brotherhood: 2 }, response: "穆弘把旧部名册压在船头，只让船户先走，自己横刀守住渡口。" },
        { text: "封住江面，让私税船队交出押船名录。", effect: { freedom: 1, order: 1 }, response: "李俊与穆弘分守两岸，船名录落到梁山手里，私税船队被迫让出水道。" },
      ],
    },
    quests: [
      arc(
        "muhong",
        "揭阳旧名",
        "穆弘旧日的名声在揭阳镇很响，却未必都是好名。他要先护住被逼缴私税的船户，再让旧部明白梁山不是另一支收税船队。",
        "揭阳守渡",
        "wins",
        2,
        "携穆弘取得 2 场胜利",
      ),
      arc(
        "muhong",
        "江岸旧账",
        "一封私税账簿列出穆家旧部曾经欠下的人情与亏欠。穆弘不躲旧账，要在江岸把每一册船户名姓一一还清。",
        "旧账不再",
        "ultimates",
        2,
        "发动 2 次穆弘义技",
      ),
      arc(
        "muhong",
        "揭阳回舟",
        "私税船队退去后，穆弘带旧部替船户补上破船与缆绳。梁山没有夺走江面，只留下一条人人可走的水路。",
        "没遮拦穆弘",
        "damage",
        2000,
        "以穆弘累计造成 2000 伤害",
      ),
    ],
  },
  ruanxiaoer: {
    chapter: 4,
    location: "石碣村芦荡",
    intro: "石碣村的渔网被官军的绳索缠住，阮小二带着水寨旧部从芦荡摸进敌船。他要把这口气用在护船户上，不让三阮的名字再被说成只顾劫船。",
    choice: {
      prompt: "官船封住芦荡，水军如何送船户离开？",
      options: [
        { text: "三阮分撑小船，先把老人与孩子送出。", effect: { brotherhood: 2 }, response: "阮氏三雄各撑一条小船，从不同水口引出百姓，最后才回身截住官船。" },
        { text: "潜入敌船割断锚绳，让封锁自行散开。", effect: { freedom: 1, order: 1 }, response: "阮小二在水底割断锚绳，官船互相挤在一起，芦荡的退路重新打开。" },
      ],
    },
    quests: [
      arc(
        "ruanxiaoer",
        "石碣旧网",
        "石碣村船户的渔网依旧破着，阮小二却不肯再让它成为官军逼税的由头。他要带三阮把第一网重新撑到活水里。",
        "立地太岁",
        "wins",
        2,
        "携阮小二取得 2 场胜利",
      ),
      arc(
        "ruanxiaoer",
        "芦荡断锚",
        "官军把锚链横过芦荡，想困住梁山船阵。阮小二在水下摸清每一段铁链，准备让封江的农船先过去。",
        "水底断锚",
        "ultimates",
        2,
        "发动 2 次阮小二义技",
      ),
      arc(
        "ruanxiaoer",
        "三阮回泊",
        "封江散去，阮家旧船仍在，石碣村的渔户却已少了数人。阮小二把伤者先送回岸边，再带三阮回梁山补上哨船。",
        "石碣立地",
        "damage",
        1900,
        "以阮小二累计造成 1900 伤害",
      ),
    ],
  },
  zhangheng: {
    chapter: 5,
    location: "浔阳江暗汊",
    intro: "浔阳江暗汊里藏着一封被换过的船牌，张横认出旧日诱船暗号。他要在梁山船阵前先分清真商船与被逼撑船的船户。",
    choice: {
      prompt: "暗汊里真假船牌分不清，张横如何查船？",
      options: [
        { text: "让船户逐户说明来处，先护无牌小船。", effect: { brotherhood: 2 }, response: "张横派小船一艘艘接人，无牌船户先回岸，梁山才转身追查换牌的人。" },
        { text: "自己扮作旧船客，引出换牌的黑手。", effect: { order: 1, freedom: 1 }, response: "张横重现旧日船火儿的口气，换牌人自己划近，江州船阵当场收网。" },
      ],
    },
    quests: [
      arc(
        "zhangheng",
        "船火认牌",
        "浔阳江的船牌换了墨色，张横仍能认出旧日暗记。他要先找出被私税船队扣住的小船，再决定哪一条大船值得追。",
        "浔阳船火",
        "wins",
        2,
        "携张横取得 2 场胜利",
      ),
      arc(
        "zhangheng",
        "暗汊明灯",
        "暗汊里没有月亮，张横却能靠两岸灯火辨出船阵。他要在私税船队灭灯前，把梁山接应船引到安全水口。",
        "暗汊点火",
        "ultimates",
        2,
        "发动 2 次张横义技",
      ),
      arc(
        "zhangheng",
        "浔阳归舟",
        "被扣的船户终于能回浔阳，张横把旧暗号交给梁山水军，只留一条新规矩：往来小船不必再交不明来路的税。",
        "船火儿护江",
        "damage",
        1900,
        "以张横累计造成 1900 伤害",
      ),
    ],
  },
  ruanxiaowu: {
    chapter: 4,
    location: "石碣水下暗桩",
    intro: "石碣村水下暗桩被官军重新钉死，阮小五嘴里还说着不怕，手上却先替渔户解开了绑网。他要在三阮面前把短命二郎的胆气变成能带回所有人的水路。",
    choice: {
      prompt: "暗桩挡住粮船，先拆哪一段？",
      options: [
        { text: "先清出给渔户的浅水口。", effect: { brotherhood: 2 }, response: "阮小五先让浅水船过桩，再带水军拆下阻断深水船的大木。" },
        { text: "统清水下暗桩，为梁山船阵留出主路。", effect: { order: 2 }, response: "阮小五带人逐段统清水底，主路开通后，船阵没有再撞上一根木桩。" },
      ],
    },
    quests: [
      arc(
        "ruanxiaowu",
        "胆气过暗桩",
        "阮小五仍爱抢在水军前面，可石碣渔户不能再靠他去赌命。他要以水战胜利证明，胆气是为了带人回来，不是只为抢先。",
        "短命二郎",
        "wins",
        2,
        "携阮小五取得 2 场胜利",
      ),
      arc(
        "ruanxiaowu",
        "水下暗桩",
        "官军把粮船的通道钉满暗桩，阮小五藏在水底听着木桩相撞。他要在涨潮前让梁山小船与渔户一同过桩。",
        "潮底开路",
        "ultimates",
        2,
        "发动 2 次阮小五义技",
      ),
      arc(
        "ruanxiaowu",
        "三阮同归",
        "水路通了，三阮的旧船仍停在一起。阮小五不再把抢来的官船当作荣耀，转而把舵交给熟路的渔户。",
        "短命不短",
        "damage",
        1900,
        "以阮小五累计造成 1900 伤害",
      ),
    ],
  },
};

function defaultArcEntry(hero, rank, stage) {
  const anchors = [
    "城门",
    "渡口",
    "关帝庙",
    "寨墙",
    "牢门",
    "酒肆",
    "粮仓",
    "码头",
    "校场",
    "山路",
    "水门",
    "草料场",
    "驿道",
    "军械库",
    "河堤",
    "庄门",
  ];
  const anchor = anchors[rank % anchors.length];
  const stages = [
    {
      title: `${hero.name}护${anchor}`,
      premise: `${hero.name}${hero.line}${anchor}还有未撤走的百姓，梁山要在旧军令落下前守住第一道门。`,
      epithet: `${hero.nickname}·守${anchor}`,
      metric: "wins",
      target: 2,
      label: `携${hero.name}取得 2 场胜利`,
    },
    {
      title: `${hero.name}问${anchor}`,
      premise: `${hero.identity}${hero.name}回到${anchor}，发现军令与旧账对不上。查清谁借旧路逼迫百姓，才能让这位${hero.nickname}真正归阵。`,
      epithet: `${hero.nickname}·${anchor}归心`,
      metric: "ultimates",
      target: 1,
      label: `发动 1 次${hero.name}义技`,
    },
    {
      title: `${hero.name}守${anchor}`,
      premise: `梁山清了${anchor}的旧账，${hero.name}仍要在敌阵压境时守住百姓退路。这一战不是争旧名，而是替${anchor}留下新旗。`,
      epithet: `${hero.nickname}·新旗`,
      metric: "damage",
      target: 1400 + rank * 12,
      label: `以${hero.name}累计造成 ${1400 + rank * 12} 伤害`,
    },
  ];
  const stageCopy = stages[stage - 1];
  return arc(
    hero.id,
    stageCopy.title,
    stageCopy.premise,
    stageCopy.epithet,
    stageCopy.metric,
    stageCopy.target,
    stageCopy.label,
  );
}

function defaultHeroChoice(hero, rank) {
  const locations = ["城门", "渡口", "牢门", "粮仓", "码头", "山路"];
  const location = locations[rank % locations.length];
  return {
    location,
    intro: `${hero.name}随梁山巡至${location}，旧军令仍挡着百姓的去路。${hero.line}这一回，他要在旧名与梁山军令之间替${location}的人做一次决定。`,
    choice: {
      prompt: `梁山要怎样守住${location}？`,
      options: [
        {
          text: `先开放${location}让百姓退走，再回头追查军令。`,
          effect: { brotherhood: 2 },
          response: `${hero.name}把${location}让给百姓先行，梁山后队才追查旧军令。最后一辆板车过桥时，守军才知梁山已守住整条退路。`,
        },
        {
          text: `守住${location}的粮道，逼敌军自己退阵。`,
          effect: { freedom: 1, order: 1 },
          response: `${hero.name}与梁山守住${location}粮道，敌军失了补给，想走的人也有路可走。梁山只留下哨令，没有把城门变成新的税关。`,
        },
      ],
    },
  };
}

export function extraHeroStoryArc(hero, rank) {
  const configured = HERO_STORY_ARCS[hero.id];
  const fallback = defaultHeroChoice(hero, rank);
  const quests = [1, 2, 3].map((stage) => {
    const source =
      configured?.quests?.[stage - 1] || defaultArcEntry(hero, rank, stage);
    const { id: _sourceId, ...story } = source;
    return {
      ...story,
      id: `${hero.id}_chronicle_${stage}`,
      stage,
      requiredChapter: Math.min(9, (configured?.chapter || 1 + (rank % 9)) + stage - 1),
    };
  });
  return {
    location: configured?.location || fallback.location,
    intro: configured?.intro || fallback.intro,
    choice: configured?.choice || fallback.choice,
    quests: quests.map((quest) => ({
      ...quest,
      objective: { ...quest.objective },
    })),
  };
}

