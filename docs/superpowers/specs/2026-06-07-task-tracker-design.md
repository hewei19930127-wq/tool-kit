# 任务管理与追踪（Task Tracker）设计

- 日期：2026-06-07
- 状态：已通过设计评审，待写实现计划
- 工具 id：`tasks`

## 1. 背景与定位

ToolKit 现有 10 个工具全部是**无状态纯转换**（文本进 → `ToolResult` 出，仅缓存每工具输入 + 20 条历史环）。本功能要新增「日常事项管理和追踪」，本质是**有状态、持久化的结构化 CRUD**，会刻意地在存储、UI、`Tool` 契约几处拉伸现有架构。这是设计要围绕的核心张力。

### 范围（已确认）

- **形态**：任务 + 追踪记录（最完整形态）。
- **追踪维度（全选）**：进展文字记录、状态变更历史、时间/工时统计、完成进度百分比。
- **组织方式**：标签 / 分类（每任务可打多个标签，可按标签过滤）。
- **提醒方式**：首版仅**被动展示**（打开工具时高亮逾期/今日到期、排序靠前），但数据模型与代码结构**预留托盘/通知接口**，将来加原生提醒无需改模型。
- **持久化**：复用现有 `KV` 存储抽象，**不引入 SQLite**。
- **导入导出**：首版即带 JSON 导入 / 导出，做手动备份。

## 2. 集成方式（方案 A）

注册为**普通 Tool，但使用完全自定义组件 + 专用 store 分片**：

- 在 `src/core/registry.ts` 里像其他工具一样注册（自动进侧边栏、⌘K 命令面板、详情区），保持产品一致性。
- 它的 `component` **不走** `useToolInput / useTransform / OutputPane` 那套转换钩子，而是自建 UI。
- 数据层新增独立 store + 基于现有 `KV` 的类型化 repository。`transform` 管线完全不碰。

**被否决的方案**：
- 方案 B（脱离工具注册表做独立"应用区块"）——更重、破坏一致性、对个人工具箱过度设计。
- 方案 C（硬塞进转换模式，input=任务 JSON）——和数据模型对着干，编辑/状态别扭。

## 3. 数据模型

新建 `src/tools/tasks/types.ts`。追踪子数据**内联**在任务对象里（个人规模下单 key 整存整取最简单，避免拆表 / SQLite）。

```ts
export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "normal" | "high";

// 追踪子记录 —— 都带 id + 时间戳，便于时间线渲染
export interface ProgressNote {
  id: string;
  at: number;          // epoch ms
  text: string;
}
export interface StatusChange {
  id: string;
  at: number;
  from: TaskStatus | null;  // null = 创建时
  to: TaskStatus;
}
export interface TimeLog {
  id: string;
  at: number;
  minutes: number;     // 本次记录的工时（分钟）
  note?: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  due: number | null;        // epoch ms，可空
  progress: number;          // 0-100
  createdAt: number;
  updatedAt: number;
  notes: ProgressNote[];
  history: StatusChange[];
  timeLogs: TimeLog[];
}

// 持久化到 KV 的整体形状（单 key，预留 version 便于将来迁移）
export interface TasksState {
  version: 1;
  tasks: Task[];
}
```

要点：
- **追踪子数据内联**到 `Task`，不分开存。
- **`version` 字段**：将来加字段 / 迁移有抓手。
- **id** 用 `crypto.randomUUID()`（WebView/jsdom 均可用）；时间戳用 `Date.now()`。
- **预留提醒接口**：`due` 已在模型里，将来加托盘/通知只需读它。

## 4. 存储 / 服务层

三层分离，副作用集中，纯逻辑好测。

### 4.1 Repository（唯一碰持久化）

`src/tools/tasks/repository.ts` —— 把"整存整取的 KV"包装成任务集合读写。是唯一碰 `storage()` 的地方（遵守 AGENTS.md"工具绝不直接碰持久化"）。

```ts
import { storage } from "@/core/services/storage";
import type { Task, TasksState } from "./types";

const KEY = "tasks";

export async function loadTasks(): Promise<Task[]> {
  const state = await storage().get<TasksState>(KEY);
  return state?.tasks ?? [];          // 缺失/损坏兜底为空数组
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await storage().set<TasksState>(KEY, { version: 1, tasks });
}
```

### 4.2 纯变更函数（无 IO，单元测试主战场）

`src/tools/tasks/tasks.ts` —— 接收 `tasks` 返回**新数组**（不可变更新，zustand 友好）：

```ts
export function createTask(tasks: Task[], input: NewTaskInput): Task[];
export function updateTask(tasks: Task[], id: string, patch: Partial<Task>): Task[];
export function deleteTask(tasks: Task[], id: string): Task[];
export function changeStatus(tasks: Task[], id: string, to: TaskStatus): Task[]; // 自动追加 StatusChange + 更新 updatedAt
export function addNote(tasks: Task[], id: string, text: string): Task[];         // 追加带时间戳 ProgressNote
export function logTime(tasks: Task[], id: string, minutes: number, note?: string): Task[];
export function setProgress(tasks: Task[], id: string, progress: number): Task[]; // clamp 0-100
```

要点：
- **副作用集中**：`changeStatus` 内部自动 push `StatusChange` 并更新 `updatedAt`；`addNote`/`logTime` 自动带 `Date.now()`。调用方不维护历史，避免漏记。
- **校验/clamp** 就近做（如 `setProgress` 夹 0-100）。
- 这些是内存纯变更，**不抛进 UI**，也不用 `ToolResult`（那是给转换工具的）。

### 4.3 持久化机制（关于"关掉应用待办还在吗"）

`storage()` 是 KV 持久化抽象，按环境自动选后端，**两种都是真持久化，进程退出后仍在**：

| 环境 | 后端 | 数据落在哪 |
|---|---|---|
| 原生 App（`tauri dev` / 打包 .app） | `tauri-plugin-store` | 磁盘 `toolkit.json` |
| 浏览器 dev（`npm run dev`） | `localStorage` | 浏览器 localStorage |

与现有收藏/主题/快捷键同一个文件、同一套机制。链路：

```
增删改任务 → store 更新（内存） → mutate 内 saveTasks() → 写入 toolkit.json
──────────────── 关闭 App ────────────────
重新打开 → loadTasks() 读回 → hydrate 进 store → UI 渲染
```

**结论：持久，关掉应用待办不丢。** 边界：`toolkit.json` 是本地单文件，无云同步，卸载/删数据目录会丢——故首版带 JSON 导入导出做手动备份。

## 5. 状态管理

任务是独立关注点，**不塞进 `useAppStore`**。新建独立 store `src/tools/tasks/store.ts`，自带持久化，**完全不动 `App.tsx`**。

```ts
import { create } from "zustand";
import { loadTasks, saveTasks } from "./repository";
import * as ops from "./tasks";
import type { Task, TaskStatus } from "./types";

interface TasksStore {
  tasks: Task[];
  loaded: boolean;
  hydrate: () => Promise<void>;                 // 首次挂载读盘
  add: (input: NewTaskInput) => Promise<void>;
  update: (id: string, patch: Partial<Task>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  changeStatus: (id: string, to: TaskStatus) => Promise<void>;
  addNote: (id: string, text: string) => Promise<void>;
  logTime: (id: string, minutes: number, note?: string) => Promise<void>;
  setProgress: (id: string, progress: number) => Promise<void>;
}

export const useTasksStore = create<TasksStore>((set, get) => {
  // 每个变更：纯函数 → set 内存 → 写盘。持久化与变更同源，绝不漏存。
  const mutate = async (next: Task[]) => {
    set({ tasks: next });
    try {
      await saveTasks(next);
    } catch {
      /* 写盘失败保留内存态，不抛进 UI */
    }
  };
  return {
    tasks: [],
    loaded: false,
    hydrate: async () => {
      if (get().loaded) return;
      set({ tasks: await loadTasks(), loaded: true });
    },
    add: (input) => mutate(ops.createTask(get().tasks, input)),
    changeStatus: (id, to) => mutate(ops.changeStatus(get().tasks, id, to)),
    addNote: (id, text) => mutate(ops.addNote(get().tasks, id, text)),
    // …其余 action 同理，全部走 mutate
  };
});
```

要点：
- **持久化内聚在 store**：每个 action 走同一 `mutate`（改内存 + 写盘），不用 `App.tsx` 的外挂 `subscribe`。功能自包含，不碰 App 启动流程、不占 `ready` 门控。
- **懒加载**：`hydrate()` 在 `TasksTool` 首次挂载时调一次（`useEffect(() => { void useTasksStore.getState().hydrate(); }, [])`）。任务只在打开工具时读盘。
- **派生数据不进 store**：排序、按标签过滤、"逾期/今日到期"由 `tasks` 算出，放纯函数 `selectors.ts`（`groupByDue`、`filterByTag` 等）或组件内 `useMemo`。被动展示高亮靠此。

## 6. UI 结构

`src/tools/tasks/TasksTool.tsx` + 拆分子组件，使用 Tailwind v4 语义 token、`src/components/ui/` 原语、Lucide 图标（无 emoji）。

- **TasksTool.tsx**：容器。挂载时 `hydrate()`；顶部工具条（新增任务、标签过滤器、状态过滤、JSON 导入/导出）；主体任务列表。
- **TaskList / TaskRow**：列表渲染。`TaskRow` 显示标题、状态、优先级、标签、进度条、截止日期。**被动展示**：逾期/今日到期用语义色高亮，排序靠前（逾期 > 今日 > 有 due > 无 due，次级按优先级）。
- **TaskDetail**（抽屉或展开区）：单任务追踪面板，三个时间线区块——进展笔记（追加输入框）、状态变更历史（只读 audit）、工时记录（追加 + 汇总）+ 进度滑块。
- **TaskEditor**：新增/编辑表单（标题、状态、优先级、标签、due、进度）。
- **导入导出**：`export` 序列化 `TasksState` 触发下载/写文件；`import` 读 JSON 校验后覆盖（带二次确认）。两个纯函数 `serialize(tasks)` / `parseImport(json): ToolResult<Task[]>`（此处可复用 `ToolResult` 表达解析失败）。

## 7. 国际化

`Tool` 契约用 i18n key（`nameKey`/`keywordsKey`）。需在 `src/core/i18n/messages/en.ts` 与 `zh-CN.ts` 补：工具名、关键词，及所有 UI 文案（状态/优先级标签、按钮、空态、确认提示等）。新增 key 需同步进 `I18nKey` 类型。

## 8. 注册

在 `src/core/registry.ts` 的 `tools[]` 加入 `src/tools/tasks/index.ts` 导出的 `Tool` 定义：`id: "tasks"`、`nameKey`、Lucide 图标（如 `ListChecks`）、`keywordsKey`、`component: TasksTool`。不提供 `detectClipboard`（任务非剪贴板可识别内容）。可选 `commands`（如"新建任务"）后续再加。

## 9. 测试

遵循 Vitest + jsdom + Testing Library，覆盖正常/非法/空/Unicode/大载荷。

- **`tasks.test.ts`（重点）**：纯变更函数。createTask 默认值与 id/时间戳；changeStatus 自动追加 history 且 from/to 正确；addNote/logTime 追加带时间戳；setProgress clamp 0-100；deleteTask；updateTask patch 合并；不可变性（不改入参数组）。
- **`repository.test.ts`**：用 `setStorageBackend()` 注入 fake KV；loadTasks 对缺失/损坏返回 `[]`；saveTasks 写出带 `version: 1` 的形状；round-trip。
- **`selectors.test.ts`**：排序（逾期/今日/优先级）、按标签过滤、汇总工时。
- **`store.test.ts`**：fake KV 下 hydrate 幂等（`loaded` 守卫）；各 action 改内存且调用 saveTasks。
- **`TasksTool.test.tsx`**：冒烟——渲染、新增任务、切状态、加笔记、导入导出按钮存在。
- **导入导出**：`parseImport` 对非法 JSON / 形状不符返回 `{ ok: false }`，不抛。

## 10. 文件清单

```
src/tools/tasks/
  types.ts          # 数据模型
  repository.ts     # KV IO（唯一碰 storage）
  tasks.ts          # 纯变更函数
  selectors.ts      # 派生：排序/过滤/汇总
  store.ts          # 独立 zustand store + 内聚持久化
  io.ts             # serialize / parseImport（JSON 导入导出纯函数）
  TasksTool.tsx     # 容器
  TaskList.tsx / TaskRow.tsx / TaskDetail.tsx / TaskEditor.tsx
  index.ts          # Tool 定义
  *.test.ts(x)      # 对应测试
```

改动的现有文件：`src/core/registry.ts`（注册）、`src/core/i18n/messages/{en,zh-CN}.ts` 与 `src/core/i18n/types.ts`（文案/key）。**不改** `App.tsx`、`store.ts`、`transform/*`、Rust 层。

## 11. 预留与非目标

- **预留**：`due` 字段已在模型；将来加托盘角标 / 系统通知时，新增 Rust 逻辑 + 后台调度读 `due` 即可，不改数据模型。
- **非目标（首版不做）**：主动提醒（托盘/通知）、云同步、项目/分组分区、循环任务、子任务、SQLite。
```
