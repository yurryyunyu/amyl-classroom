# Amyl 课堂：网站引流，App 成交与学习

这是一版可点的静态预览。所有课程名、价格、商品、学员、帖子和批改都是**示例数据**，不接真实付款，也未上线。

## 分工

- **网站 amylcoffee.com**：被搜到、介绍课程与活动、把人带到 App。网站本身不负责卖课、卖物料或批改作业。
- **App（先做 PWA，再视需要做原生）**：卖课、卖物料、打卡、交作业、会员积分、社区。

## 网站如何链到 App

1. **课程介绍页主按钮**写成「在 App 里购买并学习」，不要直接在网站结账。
2. **深度链接**（第一版用网址 + 哈希，之后再加 Universal Links / App Links），例如：
   - `https://app.amylcoffee.com/#course/pour-over-intro`
   - `https://app.amylcoffee.com/#shop`
   - `https://app.amylcoffee.com/#student/homework/new`
   - `https://app.amylcoffee.com/#teacher/queue`
   - `https://app.amylcoffee.com/#member`
   - `https://app.amylcoffee.com/#community`
3. **来源标记**：链接带 `?from=website` 或 UTM。预览里首页有「从官网进入」说明。
4. **同一账号（上线后）**：网站与 App 都走同一套登录（建议邮箱 + 魔术链接 / Apple / Google）。网站只展示「已在 App 开通」的状态，不另建一套用户。
5. **物料与活动页**同样放「打开 App」按钮，落到对应商品或社区帖。

## 推荐上线栈（验证有人买、有人交作业之后）

| 职责 | 建议 |
| --- | --- |
| 课程（数字商品）+ 物料（实物）+ 付款、库存、发货 | **Shopify** |
| 登录、开通课程、学习进度、打卡、作业图与批改、会员积分、社区帖 | **Supabase**（Auth + Postgres + Storage） |
| 客户端 | **先 PWA**（本预览的形态），稳定后再做 iOS / Android |
| 网站 | 继续用现有 WordPress 做内容与导流，按钮链到 App |

付款成功后，用 Shopify webhook（或 Shopify Flow）在 Supabase 写入开通记录。会员折扣可以先在 Shopify 用折扣码 / 顾客标签，再与积分等级同步。

不要一上来做独立支付和自建商城。课与豆子已经是「一个店里的两种商品」。

## 数据表（建议命名）

### 账号与会员

- **profiles**：`id`（对 Auth）、`email`、`display_name`、`website_user_id`（可选）、`member_no`、`role`（见下）、`created_at`
- **tiers**：`id`、`name_zh`、`name_en`、`min_points`、`benefits`（json）、`course_discount`、`perks`（如 1:1 反馈、免费物料）
- **memberships**：`id`、`user_id`、`tier_id`、`points`、`started_at`、`updated_at`
- **points_ledger**：`id`、`user_id`、`delta`、`reason`（purchase / checkin / homework / bonus / adjust）、`ref_type`、`ref_id`、`created_at`

积分只通过 ledger 增减，会员等级由积分汇总得出，避免两边对不上。

### 课程与订单

- **courses**：`id`、`slug`、`title_zh`、`title_en`、`shopify_product_id`、`published`
- **lessons**：`id`、`course_id`、`sort_order`、`title_zh`、`title_en`、`duration_min`、`content_url`
- **enrollments**：`id`、`user_id`、`course_id`、`shopify_order_id`、`granted_at`
- **lesson_progress**：`id`、`user_id`、`lesson_id`、`completed_at`、`position`
- **checkins**：`id`、`user_id`、`checked_in_on`（按日唯一）、`created_at`
- **orders**：以 Shopify 为准；App 只存 `shopify_order_id`、`user_id`、`kind`（course / material）、`status` 的镜像，便于「我的订单」

### 身份与权限（老师 / 学生）

正式版**不要**让用户自己点选「我是老师还是学生」。身份来自登录账号：

- **roles**（也可直接写在 `profiles.role`）：取值 `student` / `teacher` / `admin`。注册默认为 `student`。老师由管理员或 Amy 开通。
- **teacher_permissions**：`id`、`user_id`、`course_id`、`can_grade`、`can_manage_students`、`granted_at`。一位老师可以只被授权部分课程。

前端按角色进不同首页：学生到「拍照交作业 / 学习」，老师到「批改台」。预览里的「选择入口」只为了演示两端，不是上线交互。

RLS 建议：

- 学生：只能插入并读取自己的 `homework_submissions`；只能读自己作业的 `homework_feedback`。
- 老师：可读取被授权课程的全部提交，可写入 `homework_feedback`，并把 `status` 改为 `graded`。
- 管理员：可改 `profiles.role` 和 `teacher_permissions`。

### 作业

- **homework_submissions**：`id`、`user_id`、`course_id`、`lesson_id`、`dose`、`water`、`ratio`、`grind`、`brew_time`、`tasting_notes`、`status`（pending / graded / returned）、`submitted_at`
- **homework_photos**：`id`、`submission_id`、`storage_path`、`sort_order`（一次可交多张；手机上用相机 `capture="environment"`）
- **homework_feedback**：`id`、`submission_id`、`reviewer_id`、`total_score`、`max_score`、`rubric`（json）、`comments`、`tip`（可选短提示）、`graded_at`

现阶段作业**只做两种**（预览与第一版都按此收窄）：

- `type = brew` 冲煮：粉量、水量、粉水比、研磨、时间、滤杯、风味笔记。评分：萃取 / 风味 / 手法 / 记录。
- `type = latte` 拉花：图案（心形 / 郁金香 / 天鹅 / 树叶 / 其他）、杯量、牛奶、奶温、笔记；照片必交，短视频稍后开放。评分：对称 / 对比 / 奶泡质地 / 位置与大小 / 完整度。

`homework_submissions` 增加 `type`，参数放 json（`params`），不要为每种作业再拆一套表。

照片进 **Supabase Storage**（例如桶 `homework`），表里只存路径，不要把原图放进数据库。批改完成后用 `points_ledger` 记一笔示例积分（如批改 +20，获评优秀再 +30）。老师端批改台就是这些表的队列视图，不必另做一套 CMS。

### 社区

- **posts**：`id`、`author_id`、`tag`（手冲 / 器具 / 豆子 / 作业分享 / 问答）、`title`、`body`、`image_path`、`created_at`、`status`（published / hidden / pending）
- **comments**：`id`、`post_id`、`author_id`、`body`、`created_at`、`status`
- **likes**：`user_id`、`post_id`、`created_at`（联合主键）

老师账号在 `profiles` 里加 `role = teacher`，前台显示「老师」徽章；会员等级徽章来自 `memberships`。

### 社区审核（必须先定）

- 发帖、评论默认先发后审，或新用户前几条先审后发。
- 举报表：**reports**（`id`、`reporter_id`、`target_type`、`target_id`、`reason`、`status`）。
- 敏感内容、广告、人身攻击可隐藏，不直接删除，方便申诉。
- 作业分享可以引用 `homework_submissions`，但批改分数默认只给提交者看，避免拿分数比较。
- 存储桶与数据库都要有 RLS：只能改自己的帖和作业；老师可写 feedback；管理员可改 `status`。

## 第一版范围建议

PWA 先做：登录（按账号分学生 / 老师）、买课、买物料、我的课程、打卡、学生拍照交作业、老师批改台、会员卡与积分、一个简单社区。网站只放入口。等真的有订单和作业，再考虑上架应用商店和 1:1 预约。
