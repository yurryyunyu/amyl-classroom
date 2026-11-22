/* Amyl 课堂 preview — all content is example data unless it describes Amy / amylcoffee.com. */
window.AMYL_DATA = {
  brand: {
    nameZh: "Amyl 课堂",
    nameEn: "Amyl Classroom",
    teacher: "Amy Liu",
    site: "amylcoffee.com"
  },

  user: {
    name: "示例学员",
    email: "student@example.com",
    memberId: "AC-202611",
    tierId: "barista",
    points: 1680,
    streak: 5,
    /* Today is Sat 21 Nov 2026; streak Mon–Fri, today not yet checked in */
    checkedInDates: ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"],
    enrolled: {
      "pour-over-intro": { currentLesson: 2, completed: [1] },
      "latte-art": { currentLesson: 1, completed: [] }
    }
  },

  tiers: [
    {
      id: "sprout",
      nameZh: "豆芽",
      nameEn: "Sprout",
      minPoints: 0,
      benefits: ["基础打卡积分", "社区发帖"]
    },
    {
      id: "roaster",
      nameZh: "烘焙师",
      nameEn: "Roaster",
      minPoints: 500,
      benefits: ["课程 9 折", "物料优先购"]
    },
    {
      id: "barista",
      nameZh: "咖啡师",
      nameEn: "Barista",
      minPoints: 1500,
      benefits: ["课程 8.5 折", "每月免费滤纸", "作业优先批改"]
    },
    {
      id: "host",
      nameZh: "主理人",
      nameEn: "Host",
      minPoints: 4000,
      benefits: ["课程 8 折", "免费物料包", "1:1 作业反馈", "新课提前选"]
    }
  ],

  pointsHistory: [
    { id: "p1", date: "2026-11-20", title: "每日打卡", titleEn: "Daily check-in", delta: 5 },
    { id: "p2", date: "2026-11-19", title: "每日打卡", titleEn: "Daily check-in", delta: 5 },
    { id: "p3", date: "2026-11-18", title: "提交作业「冲煮」", titleEn: "Homework submitted", delta: 20 },
    { id: "p4", date: "2026-11-17", title: "每日打卡", titleEn: "Daily check-in", delta: 5 },
    { id: "p5", date: "2026-11-16", title: "购买课程配套豆", titleEn: "Bought course beans", delta: 22 },
    { id: "p6", date: "2026-11-16", title: "每日打卡", titleEn: "Daily check-in", delta: 5 },
    { id: "p7", date: "2026-11-15", title: "作业获评优秀", titleEn: "Homework rated excellent", delta: 30 },
    { id: "p8", date: "2026-11-14", title: "购买「手冲入门四堂课」", titleEn: "Bought pour-over course", delta: 189 }
  ],

  courses: [
    {
      id: "pour-over-intro",
      hwType: "brew",
      titleZh: "冲煮课",
      titleEn: "Brewing",
      level: "冲煮",
      price: 189,
      lessons: 4,
      duration: "约 3 小时",
      image: "assets/featured-events.jpg",
      blurb: "从称豆、注水到记录风味，专练习冲煮作业。",
      blurbEn: "Dose, pour, and taste — brewing homework.",
      includes: [
        "四节冲煮示范",
        "练习手册电子版",
        "冲煮作业批改",
        "配套物料折扣"
      ],
      outline: [
        { n: 1, titleZh: "器具、水粉比与研磨", titleEn: "Gear, ratio & grind", mins: 28 },
        { n: 2, titleZh: "注水节奏", titleEn: "Pouring pace", mins: 32 },
        { n: 3, titleZh: "萃取与调整", titleEn: "Extraction and adjustments", mins: 30 },
        { n: 4, titleZh: "记录风味", titleEn: "Tasting notes", mins: 26 }
      ]
    },
    {
      id: "latte-art",
      hwType: "latte",
      titleZh: "拉花课",
      titleEn: "Latte Art",
      level: "拉花",
      price: 189,
      lessons: 4,
      duration: "约 3 小时",
      image: "assets/site-hero.webp",
      blurb: "从奶泡到图案，专练习拉花作业。",
      blurbEn: "Milk, pour, and pattern — latte art homework.",
      includes: [
        "四节拉花示范",
        "练习手册电子版",
        "拉花作业批改"
      ],
      outline: [
        { n: 1, titleZh: "奶泡质地", titleEn: "Milk texture", mins: 28 },
        { n: 2, titleZh: "心形", titleEn: "Heart", mins: 30 },
        { n: 3, titleZh: "郁金香与树叶", titleEn: "Tulip and rosetta", mins: 32 },
        { n: 4, titleZh: "天鹅与自由图案", titleEn: "Swan and free pour", mins: 28 }
      ]
    }
  ],

  products: [
    {
      id: "dripper",
      titleZh: "V60 滤杯套装",
      titleEn: "Dripper kit",
      price: 48,
      image: "assets/events-hero.webp",
      blurb: "课程常用的滤杯、底座与分享勺（示例商品）。",
      bundle: true
    },
    {
      id: "filters",
      titleZh: "滤纸 100 枚",
      titleEn: "Filters",
      price: 12,
      image: "assets/amyl-paper-kozo-v9.webp",
      blurb: "适配示例滤杯的原色滤纸。",
      bundle: true
    },
    {
      id: "beans",
      titleZh: "课程配套豆 250g",
      titleEn: "Course beans",
      price: 22,
      image: "assets/site-hero.webp",
      blurb: "入门课练习用的中浅烘焙示例豆。",
      bundle: true
    },
    {
      id: "workbook",
      titleZh: "练习手册",
      titleEn: "Workbook",
      price: 18,
      image: "assets/thumb-site.jpg",
      blurb: "冲煮记录、风味笔记与作业页（纸质示例）。",
      bundle: false
    },
    {
      id: "server",
      titleZh: "分享壶",
      titleEn: "Server",
      price: 36,
      image: "assets/water.webp",
      blurb: "观察液面与产量用的分享壶（示例）。",
      bundle: false
    }
  ],

  bundle: {
    productIds: ["dripper", "beans", "filters"],
    save: 8,
    labelZh: "与课程一起买滤杯 + 豆子 + 滤纸",
    labelEn: "Bundle with course"
  },

  hwTypes: [
    { id: "latte", nameZh: "拉花", nameEn: "Latte Art", courseId: "latte-art" },
    { id: "brew", nameZh: "冲煮", nameEn: "Brewing", courseId: "pour-over-intro" }
  ],

  patterns: ["心形", "郁金香", "天鹅", "树叶", "其他"],
  cupSizes: ["150ml", "180ml", "210ml", "其他"],
  milkTypes: ["全脂", "燕麦", "杏仁", "脱脂", "其他"],
  milkTemps: ["50–55°C", "55–60°C", "60–65°C"],
  drippers: ["V60", "蛋糕杯", "Origami", "化学家", "其他"],

  homework: [
    {
      id: "hw-brew-pending",
      type: "brew",
      studentId: "me",
      studentName: "示例学员",
      courseId: "pour-over-intro",
      titleZh: "冲煮",
      titleEn: "Brewing",
      status: "pending",
      submittedAt: "2026-11-18 21:14",
      photo: "assets/water.webp",
      photos: ["assets/water.webp"],
      params: { dose: "15g", water: "250g", ratio: "1:16.7", grind: "中细 · 示例 20 格", time: "2:50", dripper: "V60" },
      notes: "第二段液面掉得快，味道偏薄一点。（示例）"
    },
    {
      id: "hw-latte-pending",
      type: "latte",
      studentId: "xiaolin",
      studentName: "示例·小林",
      courseId: "latte-art",
      titleZh: "拉花",
      titleEn: "Latte Art",
      status: "pending",
      submittedAt: "2026-11-19 08:42",
      photo: "assets/site-hero.webp",
      photos: ["assets/site-hero.webp", "assets/thumb-collab.jpg"],
      params: { pattern: "郁金香", cupSize: "180ml", milkType: "全脂", milkTemp: "55–60°C" },
      notes: "第二层有点散，想请老师看看对称。（示例）"
    },
    {
      id: "hw-brew-graded",
      type: "brew",
      studentId: "me",
      studentName: "示例学员",
      courseId: "pour-over-intro",
      titleZh: "冲煮",
      titleEn: "Brewing",
      status: "graded",
      submittedAt: "2026-11-15 20:06",
      gradedAt: "2026-11-16 11:20",
      photo: "assets/featured-events.jpg",
      photos: ["assets/featured-events.jpg"],
      params: { dose: "15g", water: "250g", ratio: "1:16.7", grind: "中细 · 示例 18 格", time: "2:45", dripper: "V60" },
      notes: "柑橘、红茶，尾韵偏干。（示例）",
      feedback: {
        by: "Amy Liu",
        comments: "冲煮很稳。第二段可以再慢半拍，水温可试 90°C，看尾韵会不会干净一些。记录写得很清楚。",
        commentsEn: "Steady brew. Slow the second pulse; try 90°C for a cleaner finish.",
        tip: "第二段等液面再落一点再续水。",
        rubric: [
          { nameZh: "萃取", nameEn: "Extraction", score: 8, max: 10 },
          { nameZh: "风味", nameEn: "Flavour", score: 9, max: 10 },
          { nameZh: "手法", nameEn: "Method", score: 7, max: 10 },
          { nameZh: "记录", nameEn: "Notes", score: 8, max: 10 }
        ],
        total: 32,
        max: 40,
        badge: "优秀"
      }
    }
  ],

  gradeTemplates: {
    brew: [
      { id: "b1", title: "萃取稳定", text: "冲煮很稳，粉床也没有明显坑。第二段可以再慢半拍，让液面自己落一点再续水。" },
      { id: "b2", title: "写清参数", text: "请把闷蒸秒数、滤杯和研磨写清楚，下次更好对参数。" },
      { id: "b3", title: "风味完整", text: "风味记录很完整，继续保持。可以再补一句尾韵和口感。" },
      { id: "b4", title: "先调研磨", text: "如果不到时间就滴完，可以先调细半格，水流先不动，再看一杯的变化。" }
    ],
    latte: [
      { id: "l1", title: "对称不错", text: "图案左右对称已经很好。可以再把起点靠近杯心，整体会更稳。" },
      { id: "l2", title: "对比再强", text: "奶泡再细一点，棕色基底会更清楚，对比会更强。" },
      { id: "l3", title: "位置居中", text: "图案略偏一侧。倒入前把杯子摆正，花纹会落在中间。" },
      { id: "l4", title: "收尾干净", text: "主体完整，收尾可以再轻一点，避免冲散边缘。" }
    ]
  },

  rubrics: {
    brew: [
      { key: "extraction", nameZh: "萃取", nameEn: "Extraction" },
      { key: "flavour", nameZh: "风味", nameEn: "Flavour" },
      { key: "method", nameZh: "手法", nameEn: "Method" },
      { key: "notes", nameZh: "记录", nameEn: "Notes" }
    ],
    latte: [
      { key: "symmetry", nameZh: "对称", nameEn: "Symmetry" },
      { key: "contrast", nameZh: "对比", nameEn: "Contrast" },
      { key: "texture", nameZh: "奶泡质地", nameEn: "Milk texture" },
      { key: "position", nameZh: "位置与大小", nameEn: "Position & size" },
      { key: "completion", nameZh: "完整度", nameEn: "Completion" }
    ]
  },

  orders: [
    {
      id: "ord-course-1",
      type: "course",
      titleZh: "冲煮课",
      titleEn: "Brewing",
      price: 189,
      date: "2026-11-14",
      statusZh: "已开通",
      statusEn: "Unlocked"
    },
    {
      id: "ord-beans-1",
      type: "product",
      titleZh: "课程配套豆 250g",
      titleEn: "Course beans",
      price: 22,
      date: "2026-11-16",
      statusZh: "已发货（示例）",
      statusEn: "Shipped (example)"
    }
  ],

  posts: [
    {
      id: "post-amy-1",
      author: "amy",
      tag: "作业分享",
      time: "昨天 18:30",
      titleZh: "本周作业提示",
      body: "第 3 课请把焖蒸时间和第二段注水间隔写清楚，照片尽量拍到粉床。这是一条示例公告，方便看社区样式。",
      image: "assets/events-hero.webp",
      likes: 18,
      liked: false
    },
    {
      id: "post-xiaolin",
      author: "xiaolin",
      tag: "手冲",
      time: "昨天 21:05",
      titleZh: "今天这杯甜感比较够",
      body: "15g / 250g，绕圈放慢之后酸甜比较平衡。还是示例记录，参数仅供看版式。",
      image: "assets/featured-events.jpg",
      likes: 9,
      liked: false
    },
    {
      id: "post-acha",
      author: "acha",
      tag: "器具",
      time: "11月19日",
      titleZh: "滤杯底部的肋骨会不会影响流速？",
      body: "想问问同样用 V60 的同学，换了一家滤纸以后滴得特别快。这是一条示例提问。",
      image: null,
      likes: 6,
      liked: false
    },
    {
      id: "post-mira",
      author: "mira",
      tag: "作业分享",
      time: "11月18日",
      titleZh: "交了绕圈那次作业",
      body: "第一次把过程拍下来，手还是有点抖。示例帖，配图用的是氛围图。",
      image: "assets/willow.webp",
      likes: 11,
      liked: true
    },
    {
      id: "post-zhou",
      author: "zhou",
      tag: "豆子",
      time: "11月17日",
      titleZh: "入门课配套豆怎么保存？",
      body: "开封后是放柜子还是密封罐？示例问答，不是真实产品说明。",
      image: "assets/site-hero.webp",
      likes: 4,
      liked: false
    },
    {
      id: "post-allen",
      author: "allen",
      tag: "问答",
      time: "11月16日",
      titleZh: "研磨度要按什么来调？",
      body: "课里说先固定粉量和时间。如果两分钟就滴完，是先调细还是先减水流？示例问题。",
      image: null,
      likes: 7,
      liked: false
    }
  ],

  authors: {
    amy: { name: "Amy Liu", role: "teacher", tierId: null, initial: "A" },
    xiaolin: { name: "示例·小林", role: "member", tierId: "barista", initial: "林" },
    acha: { name: "示例·阿茶", role: "member", tierId: "roaster", initial: "茶" },
    mira: { name: "示例·Mira", role: "member", tierId: "host", initial: "M" },
    zhou: { name: "示例·老周", role: "member", tierId: "sprout", initial: "周" },
    allen: { name: "示例·Allen", role: "member", tierId: "barista", initial: "A" },
    me: { name: "示例学员", role: "member", tierId: "barista", initial: "示" }
  },

  comments: {
    "post-amy-1": [
      { id: "c1", author: "xiaolin", time: "昨天 19:02", text: "收到，这周会把焖蒸秒数写上。（示例评论）" },
      { id: "c2", author: "mira", time: "昨天 19:40", text: "粉床照片有光线要求吗？（示例）" }
    ],
    "post-xiaolin": [
      { id: "c3", author: "amy", time: "昨天 21:40", text: "甜感起来就对了。可以把第二段再放慢一点看看层次。（示例回复）" },
      { id: "c4", author: "allen", time: "昨天 22:10", text: "我也准备试试这个粉水比。" }
    ],
    "post-acha": [
      { id: "c5", author: "zhou", time: "11月19日", text: "我换薄滤纸也会变快，后来略调细就稳了。（示例）" },
      { id: "c6", author: "amy", time: "11月19日", text: "先确认研磨和滤纸克重，再看是不是粉床歪了。这条是示例答复。" }
    ],
    "post-mira": [
      { id: "c7", author: "xiaolin", time: "11月18日", text: "拍下来真的会看清楚很多。" }
    ],
    "post-zhou": [
      { id: "c8", author: "amy", time: "11月17日", text: "开封后密封、避光、尽快喝完即可。示例建议，不是储存标准。" }
    ],
    "post-allen": [
      { id: "c9", author: "mira", time: "11月16日", text: "我会先调细半格，水流先不动。（示例）" }
    ]
  },

  categories: ["全部", "手冲", "器具", "豆子", "作业分享", "问答"]
};
