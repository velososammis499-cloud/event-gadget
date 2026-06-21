# Event Gadget

零侵入自动埋点 + 智能分析工具。在任意网页加一行 `<script>` 即可自动采集行为数据,通过 React 看板按"页面 × 视图"二级分析,并支持自然语言对话式查询。

**当前能力一览**:概览(KPI + 同比 + 新老分布)/ 漏斗(自动推荐 + 手动 + 转化率)/ 路径(Sankey)/ 用户偏好(CTR 标红绿)/ 异常诊断(死按钮/高跳出/表单失败/狂点)/ 用户分群(条件查询)/ 会话追踪 / 事件浏览 / 标签管理(data-track → 中文别名)/ 智能对话。**全看板 10 秒自动刷新**。

## 协作约定 — 先做产品经理,再做工程师

用户不是技术背景,描述需求时通常用业务语言、感受、举例,而不是技术术语。**收到需求后不要直接动代码**,先用 PM 的思维过一遍:

1. **翻译**: 把用户的话翻译成技术问题。例:"看板上的数据一眼假" → 实际可能是采集端漏数据、聚合算错、展示混乱中的任意一个,要先分清。
2. **确认**: 用一两句话复述你理解的核心诉求,把不确定的取舍亮出来,通过 AskUserQuestion 或正常对话让用户确认。**不要假设、不要替用户决定**。
3. **拆分**: 把"功能愿望"拆成"具体场景 + 具体衡量标准"。例:"任何页面都能用" → 同 URL 多 Tab / hash 路由 / 纯静态页 / SPA 各算一种场景,逐一回应。
4. **方案再给代码**: 先讲清楚要改哪几处、改了之后用户能看到什么变化、有没有取舍,得到认可后才动手。
5. **用业务语言反馈结果**: 验证时给的不是 SQL / API 字段,而是"在 supply-chain.html 切 5 个 Tab,看板现在能看到 5 行,以前只 1 行"。

**反模式**:
- 看到"数据有问题"就闷头查 bug,不先核对用户说的"问题"具体指什么
- 把技术取舍直接抛给用户("是用 viewLabel 还是改 schema")而不先解释每种做法的业务影响
- 在没对齐预期前写大段代码,然后才说"对了我还做了 X、Y、Z"

## 架构

npm workspaces monorepo,三包协同:

```
目标网页 + sg.js  ──▶  Server :3001  ──▶  Dashboard :5173
  (tracker SDK)        (Express+SQLite)     (React 看板)
```

| 包 | 职责 | 关键技术 |
|---|---|---|
| `packages/tracker` | 浏览器端自动埋点 SDK,UMD/ESM 双产物 | TypeScript, Rollup, Zod, IntersectionObserver, MutationObserver |
| `packages/server` | 数据接收 + 持久化 + 分析 API + 托管 sg.js / tracker.js | Express, better-sqlite3, tsx |
| `packages/dashboard` | 8 大分析页面 + 对话式分析 | React 19, Router 7, TanStack Query, Recharts, Vite |

## 目录结构关键点

```
packages/tracker/src/
├── core/
│   ├── tracker.ts          # 主类、viewLabel 管理、detectViewLabel() 启发式
│   ├── navigation-chain.ts # session 内的导航链(支持 viewPath 参数)
│   └── context.ts          # device/user 上下文
├── collectors/             # 5 类事件采集器
│   ├── page-view.ts        # pushState/replaceState/popstate/hashchange + MutationObserver 触发 inferView
│   ├── click.ts            # 委托式监听,用 readableLabel 兜底
│   ├── impression.ts       # IntersectionObserver,seen WeakSet 按 viewPath 分桶
│   ├── form-interaction.ts
│   └── dwell.ts
├── reporter/               # 批量上报 + 重试 + sendBeacon 降级
└── utils/
    └── readable-label.ts   # aria-label/title/alt/placeholder/叶子文本 优先级

packages/server/src/
├── routes/                 # collect.ts(接收), analytics.ts(聚合查询)
├── db/                     # schema.ts, queries.ts, db.ts, dto.ts
├── ai/                     # 对话分析后端(预留,尚未启用)
└── data/tracker.db         # SQLite,WAL 模式
public/sg.js               # 零配置加载器,server 直接托管

packages/dashboard/src/
├── pages/                  # 10 大页面:Overview / Funnels / Journeys / Rankings / Diagnostics / Segments / Chains / Events / Labels / Chat
├── components/             # 看板可视化组件(Sankey、热力图、漏斗柱图、KPI 卡、LiveIndicator 等)
├── api/                    # client + queries + query-keys + transport/serialization/errors
├── analysis/               # chat-analyzer.ts(前端 NLP 引擎)
├── shared/formatters/      # primitives(date/duration/number) + finance + analytics(displayPath)
├── hooks/                  # useFilters(支持 preset 滚动终点)
└── theme/cyberpunk.ts
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run setup` | 安装依赖 + 构建 tracker + 初始化 SQLite |
| `npm run dev` | 并行启动 server(3001)与 dashboard(5173) |
| `npm run build:tracker` | 仅构建 tracker(改 SDK 必须重建) |
| `npm run dev:server` / `dev:dashboard` | 单独启动 |
| `cd packages/server && npm run build && node dist/index.js` | 生产模式后端 |
| `cd packages/dashboard && npm run build` | 看板生产构建 |

## 接入方式

```html
<script src="http://localhost:3001/sg.js"
        data-app-id="your-app-name"
        data-user-id="optional"
        data-debug="true"></script>
```

`data-app-id` 用于在看板中区分不同业务系统。Tracker 实例挂在 `window.eventGadget` 上。

### 视图(view)概念 — 同 URL 内多 Tab 的关键

很多业务页面是单文件 SPA,用 `display:none/block` 切 Tab(URL 始终不变)。Event Gadget 通过 **viewLabel** 把"视图"作为伪页面区分开:

- **自动推断**: page-view collector 用 MutationObserver 监听 `.active` / `[aria-selected="true"]` / `[aria-current]` / `[hidden]` / `document.title` 的变化,debounce 60ms 后调 `Tracker.inferView()` → `detectViewLabel()`,启发式顺序是 breadcrumb 当前段 → 唯一的 active 节点 → title 前缀。
- **手动覆盖**: 业务方一行代码 100% 准确:`window.eventGadget.setView('采购订单')`。manual 优先级高于 inferred,URL 变化时 inferred 会清空、manual 保留。
- **入库格式**: `page.path` 在上报前拼成 `/path#view=<encoded>`,所以同 URL 不同视图就是不同 `page_path`,后端聚合自然分开,看板"热门页面"/Sankey/排行都自动按视图区分。
- **viewchange 触发 pageview**: viewLabel 变化时会自动追加一段 chain entry 并发一条 `pageview { trigger: 'viewchange' }`。

### 自动采集的 5 类事件

| 类型 | 关键字段 |
|---|---|
| `pageview` | trigger: `init` / `pushState` / `replaceState` / `popstate` / `hashchange` / `viewchange` |
| `click` | tagName, text(经 `readableLabel`), id, className, href, dataTrack |
| `impression` | tagName, text, dataTrack, visibleRatio, visibleTime;按 viewPath 分桶去重 |
| `form_interaction` | action(focus/change/submit), formId, fieldName, fieldType |
| `dwell` | level(page/element), path, duration, heartbeat |

### 标签兜底(readableLabel)

`utils/readable-label.ts`:`aria-label` → `title` → `alt` → `placeholder` → `value`(input/button)→ 容器最近一层叶子文本。**不**直接读整段 `textContent`——否则会拿到 `"供应商总数\n128\n↑12%"` 这种聚合卡片的脏文本。

## API 端点(server :3001)

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/collect` | 接收埋点事件批次 |
| GET  | `/api/events` | 事件列表(分页 + 筛选),label 字段已应用别名 |
| GET  | `/api/pages` | 页面统计(pageview 按 page_path 聚合,含 normalizePath 合并) |
| GET  | `/api/journeys` | 页面跳转对(只取 `source_type='internal'` 且 `source_path` 非空) |
| GET  | `/api/chains` | 完整导航链 |
| GET  | `/api/overview` | 概览 KPI + 同长前一周期对比 + hourly trend |
| GET  | `/api/rankings` | click/impression 按 data-track 聚合 + CTR |
| GET/PUT | `/api/labels` | data-track 中文别名管理 |
| GET/POST/PUT/DELETE | `/api/funnels` | 漏斗 CRUD;`/funnels/options` 拉真实可选项;`/funnels/analyze` 临时计算;`/funnels/suggested` 自动推荐 |
| GET  | `/api/diagnostics` | 死按钮 / 高跳出页 / 表单失败 / 狂点 |
| POST | `/api/segments/preview` | 用户分群条件查询,返回匹配 visitor 数 + 样本 |
| GET  | `/sg.js` / `/tracker.js` | SDK 分发 |
| GET  | `/health` | 健康检查 |

DB schema 在 `server/src/db/schema.ts`,**当前 version=6**。WAL 模式。`events` 表含 `visitor_id` / `is_new_visitor`;独立表 `funnels` / `labels`。

## 工作约定与坑

- **改 tracker 必须 `npm run build:tracker`**。server 通过 `/tracker.js` 托管的是 `packages/tracker/dist/tracker.umd.js`,源码改了不重建无效果。
- **全局名 + window 实例**: UMD 全局是 `EventGadget`(rollup `name`);sg.js 把 `initTracker()` 返回的实例挂在 `window.eventGadget`,业务用 `window.eventGadget.setView(...)`。
- **匿名访客 ID**: tracker 启动时若没传 `data-user-id`,自动写 cookie `_eg_visitor`(30 天滚动续期)。`SessionContext.userId` 返回 `_userId ?? _visitorId`,新老分析永远有数据。
- **导航事件去重管线**: tracker.ts 的 `scheduleNavCommit` 把 popstate/hashchange/viewchange 三路信号 collapse 成 1 次 pageview(150ms debounce + 优先级合并),避免重复事件污染漏斗/路径数据。
- **预设时间窗滚动**: `useFilters` 的 preset 模式按 10 秒 bucket 取整 `Date.now()`,endTime 加 1 分钟 padding,保证自动刷新时新事件能进入窗口而不撕碎 query key。
- **路径格式**: tracker 上报的 `page.path` = `pathname + hash` + 可选 `?view=<encoded>`(注意不是 `#view=`,避免双 #)。Dashboard 通过 `displayPath()` 解码渲染为 `路径 › 视图名`,兼容旧 `#view=` 格式。
- **dashboard 数据查不到先查 App ID**: FilterBar 必须填和 `data-app-id` 一致的值;时间窗用 7天/30天预设最简单(会自动跟随刷新)。
- **看板路径展示**: 所有 `pagePath` / `sourcePath` 展示都走 `shared/formatters/analytics/path.ts` 的 `displayPath()`。
- **别名生效层**: server DTO 层 `toEventDTO(row, aliasMap)` 把 dataTrack 映射为别名;`getRankings` / `getDiagnostics` 同理。前端不用关心别名读取逻辑,任何展示 `label` 字段的位置自动应用。
- **隐私过滤**: `tracker/src/utils` 已实现密码、信用卡等敏感字段过滤,新增字段类型在此扩展,不要在 collector 层硬写。
- **formatters 分层** (`shared/formatters`): primitives → analytics/finance。加新格式化函数先看 primitives 是否已有。不要为"以后可能用"提前抽象,等第二个真实场景再提取。
- **对话分析**: 当前实现在 `dashboard/src/analysis/chat-analyzer.ts`(前端启发式),`server/src/ai/` 目录为后端 AI 预留,尚未启用。
- **Demo 页**: `example/index.html`(基础 4 页 hash 路由 SPA)/ `example/supply-chain.html`(完整业务模拟,多 Tab 同 URL,验证 viewLabel 推断)。用 `python3 -m http.server 8080 --directory example` 启动。
- **batchInterval = 5s**: Playwright 等场景需等满 5s 让 reporter flush,否则会丢尾部事件。生产 `pagehide`/`visibilitychange` 走 `sendBeacon`。
- **DB 路径**: `packages/server/src/data/tracker.db`。要清某业务数据:`sqlite3 tracker.db "DELETE FROM events WHERE app_id='X'; DELETE FROM chains WHERE app_id='X';"`。
- **测试**: tracker 配了 `vitest.config.ts`,测试文件仍较少;dashboard/server 暂无测试。

## 自动视图推断的边界(实事求是)

| 模式 | 识别情况 |
|---|---|
| `.menu-item.active` / `.tab.active` / 单个 `.active` | ✅ |
| `[aria-current="page"]` / `[aria-selected="true"]` | ✅ |
| `breadcrumb` 末段 / `<b id="current-page-name">` 这类 | ✅ |
| `document.title` 在 `-`/`|`/`·`/`/` 前的前缀 | ✅(兜底) |
| 多个 `.active` 同时出现(导航+卡片+按钮) | ❌ 因为唯一性判断会跳过——保守 |
| 完全自定义 class(`.is-on`、`.tab-show`) | ❌ 退回 title 兜底,不行就提示业务方 `setView` |

## 技术栈速查

- Node >= 18, npm >= 9
- TypeScript 5.5,strict
- React 19 + Router 7 + TanStack Query v5 + Recharts 2
- Express 4 + better-sqlite3 11
- Tracker 用 Rollup;dashboard / server 用 Vite / tsc
