# Claude Code、Codex 与 Cursor 插件接入

本项目是一个共享 skills/ 的多工具插件包，三种 manifest 指向同一套四流程。CLI 的 init/check/snapshot/gate 参数和项目 maintenance.json 保持不变，不需要 API key、SDK、MCP 服务或联网运行。Node.js 20+ 是本地安装器与门禁的运行前提。

## 推荐：项目级安装，不改全局设置

从插件目录执行以下命令，root 必须是已存在的目标项目。工具包可以来自其他目录或插件缓存；安装器将完整运行时复制到目标内，再生成该工具支持的项目 skills 入口：

```sh
node docs-notes-toolkit/scripts/integrations.mjs install --tool claude --root /absolute/project
node docs-notes-toolkit/scripts/integrations.mjs install --tool codex --root /absolute/project
node docs-notes-toolkit/scripts/integrations.mjs install --tool cursor --root /absolute/project
```

将 `--tool` 改为 `all` 可一次安装三种入口。默认项目运行时为 docs-notes-toolkit，`--runtime tools/knowledge-kit` 可改位置。脚本路径按实际安装包位置替换；包含空格的路径须引号包裹。命令不是 shell 生成器，不执行用户参数中的命令。

| 工具 | 项目入口 | 四流程调用 |
|---|---|---|
| Claude Code | .claude/skills/docs-notes-*/SKILL.md | `/docs-notes-bootstrap`、`/docs-notes-update`、`/docs-notes-curate`、`/docs-notes-promote` |
| Codex CLI / IDE | .agents/skills/docs-notes-*/SKILL.md | `$docs-notes-bootstrap` 等，或 `/skills` 选择 |
| Cursor Agent | .cursor/skills/docs-notes-*/SKILL.md | Agent 输入 `/` 选择对应 skill，或明确要求读取入口 |

项目入口明确设为手动调用，不全局自动触发；Codex 另生成 agents/openai.yaml 的 allow_implicit_invocation=false。原生插件复用规范 skills，可能由宿主按描述自动选择，其审批仍服从宿主设置。安装后开启新会话或重新加载窗口。调用 bootstrap 才初始化 docs；安装本身不执行 init，不改 AGENTS、不批准删除、不安装 hooks。若工具版本不显示 skill，按入口文件路径读取，不把目录存在当成客户端已加载。

安装器先预检全部入口与运行时：已有文件相同则复用，不同则报碰撞；不提供 force 覆盖。未知工具、路径越界、符号链接目的地及复制递归拒绝。要升级已有不同版本，先评审差异，安装到新的 runtime 路径并手动迁移原入口，或备份后按项目权限移除旧入口。不得用删除用户自定义内容绕过冲突。

## Claude Code 原生插件

根 manifest 为 [.claude-plugin/plugin.json](.claude-plugin/plugin.json)，附本地 marketplace。无需安装可临时加载：

```sh
claude --plugin-dir /absolute/docs-notes-toolkit
claude plugin validate /absolute/docs-notes-toolkit/.claude-plugin/plugin.json --strict
```

在 Claude Code 内调用 `/docs-notes:docs-notes-bootstrap`，其他三个流程同样以 `docs-notes:` 命名空间调用。插件由宿主缓存时，skill 会先定位缓存内完整包，再运行项目级安装器；不能直接在缓存调用项目 init，也不放宽原 CLI 的项目内运行时约束。

持久本地安装（这些命令由用户执行，会写 Claude 的插件配置）：

```text
/plugin marketplace add /absolute/docs-notes-toolkit
/plugin install docs-notes@docs-notes-local
```

默认发现根 skills/，无多余 MCP、hooks 或权限白名单；依照 Claude 原有权限审批执行本地命令。原生插件与项目包装入口同时安装可能出现两组命令，择一使用，避免重复执行同一任务。

## Codex 原生插件与兼容入口

根 manifest 为 [.codex-plugin/plugin.json](.codex-plugin/plugin.json)，本地 marketplace 为 [.agents/plugins/marketplace.json](.agents/plugins/marketplace.json)。在支持 plugin 子命令的 Codex CLI：

```sh
codex plugin marketplace add /absolute/docs-notes-toolkit
codex plugin add docs-notes@docs-notes-local
codex plugin list --json
```

开启新会话，从 `/skills` 选择或用 `$docs-notes-bootstrap` 等调用。较旧 CLI 不支持子命令时用上面的项目级安装器。IDE 扩展采用项目 skills 方式，不假定所有 IDE 版本支持原生插件管理。不要向现有 config.toml 生造 plugins 字段。

测试原生安装可给 Codex 一个已创建的临时 CODEX_HOME；不要覆盖真实用户 home。插件安装不需要模型请求，但执行任务仍服从客户端自身认证、沙箱及审批。

## Cursor 原生插件与兼容入口

根 [.cursor-plugin/plugin.json](.cursor-plugin/plugin.json) 与根 skills/ 构成 Cursor 原生插件，不是 VSIX，也不使用 `cursor --install-extension`。

官方本地导入：将完整目录放到用户自己的 `~/.cursor/plugins/local/docs-notes/`，重新加载窗口，在 Customize 确认四个 skills。企业环境可能需管理员允许 Local Plugin Imports；同名 marketplace 插件可能优先。该操作改变用户级扩展目录，本任务不自动执行。没有导入权限时使用推荐项目级 `.cursor/skills` 安装。

当前包未发布 Cursor marketplace；不把不存在的远端地址当安装命令，也不声称 Cursor UI 已完成加载。Cursor 命令行 `--version` 只证明客户端存在，不是 Agent skills 运行验证。

## 项目配置和门禁不变

四流程进入项目后读取其 maintenance.json 的 toolkitRoot 和 docs/notes 路径，不以插件缓存或工作目录替代项目根。已有配置不重置，快照与报告保存在项目授权位置。结构/历史门禁和信任限制见 [AUTOMATION](AUTOMATION.md)。无需任何模型提供商 SDK 调用。

## 可重复验证与结果层级

```sh
node docs-notes-toolkit/scripts/integrations.mjs validate
node --test docs-notes-toolkit/tests/cli.test.mjs docs-notes-toolkit/tests/boundaries.test.mjs docs-notes-toolkit/tests/integrations.test.mjs
```

集成测试在临时项目逐一安装三种入口，检查四个可解析 skill 链接，再通过复制后的 CLI 执行 init 和 bootstrap gate；还覆盖碰撞拒绝、改名复制、空格路径、未知工具和 symlink，不触碰真实全局配置。

本轮已验证 Claude Code 2.1.312 的原生 manifest 校验；Codex CLI 0.142.5 在隔离 CODEX_HOME 的本地 marketplace add、plugin add 和 list。Cursor 3.27.22 版本与官方格式已核对，项目入口及共享运行时通过自动测试；未在真实 Cursor GUI 中交互调用，也未发起任何付费模型任务。准确区分格式校验、原生安装、项目运行时测试与真实模型执行，不把前者冒称后者。

## 官方依据

- [Claude Code plugin manifest reference](https://code.claude.com/docs/en/plugins-reference)：manifest、标准 skills/、本地加载、校验及缓存路径。
- [Codex skills](https://learn.chatgpt.com/docs/build-skills)与[插件构建](https://developers.openai.com/plugins/build/plugins)：项目技能、调用、兼容 manifest 及 marketplace。
- [Cursor skills](https://cursor.com/docs/context/skills)与[plugins](https://cursor.com/docs/plugins)：项目路径、原生 manifest 和本地导入。

扩展机制会随客户端版本变化；安装时核对 `--help` 与官方文档。包内本地验证不等同于厂商市场审核或公开发布。
