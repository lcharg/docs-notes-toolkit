---
name: docs-notes-bootstrap
description: Use when a project lacks a maintainable docs and decision-note system, or when a coding agent is onboarding this documentation toolkit into an existing repository.
---

# 初始化 docs 与决策笔记

## 插件与项目运行时

本 skill 同时由 Claude Code、Codex 和 Cursor 插件加载。先定位本文件所在完整工具包根（skills/ 上两级），再确认目标项目；插件安装路径不等于项目根。如果工具包在用户插件缓存或项目外，获准后执行 `node <实际工具包根>/scripts/integrations.mjs install --tool <claude|codex|cursor> --root <目标绝对目录>`，将完整运行时及项目入口安全复制进项目；随后读取项目内同名规范 skill 继续。缓存中不存项目配置、基准或报告。若已有项目配置，先读取 toolkitRoot，复用它，不默认安装第二套。CLI 命令中的 docs-notes-toolkit 替换为真实项目内路径。安装器不初始化业务 docs、不修改全局配置或授权删除。

## 触发与输入

输入：明确目标仓库、写入权限、现有文档/notes/agent 入口。Node.js 20+ 用于执行随包检查，不需要安装依赖。只读任务仅报告计划，不运行写入型 init。目标项目规则和语言优先；不假定双语或 DSH 工具。

完整复制工具包，包括 scripts 和 templates；只复制四个 SKILL.md 不再足够。[公共规则](references/lifecycle.md)负责语义，[执行说明](../../AUTOMATION.md)规定机器配置与门禁。

## 执行步骤

1. 确认目标绝对位置和工具包位于目标内。读取指令，发现已有 docs、notes、入口和检查。已有布局用 init 参数映射，不创建第二套目录；现有人工维护配置不可直接当作 JSON 解析。
2. 授权初始化时，从目标根执行 `node docs-notes-toolkit/scripts/docs-notes.mjs init --root .`；按实际路径设置 `--docs`、`--notes`、`--entry`。冲突则停止并采用已有内容，不使用覆盖或删除绕过。init 默认创建最小英文页面，按项目语言调整，不生成业务架构事实。
3. 采用已有体系时，按[机器模板](../../templates/maintenance.config.json)建立项目 maintenance.json，填写实际路径、主状态映射与 `ownership`。repoRoot 相对 JSON 配置目录，其他路径相对仓库根；Markdown 链接仍相对包含文件。先核实来源再登记，不用清空映射回避更新。
4. 用[docs 导航](templates/docs-index.md)和[笔记政策](templates/notes-policy.md)模板补最小内容。笔记保留已有状态，机械编辑不补造决策理由。人工维护说明链接 JSON，避免重复维护两份路径配置。
5. 检查实际 agent 入口有一个受管段，链接机器配置及四个真实 skill。init 保留原入口正文；禁止编辑入口时只交未应用片段，接入未完成。再次运行 init 不重置配置或重复添加入口。
6. 运行 `node docs-notes-toolkit/scripts/docs-notes.mjs gate --config docs/maintenance.json --phase bootstrap`。失败按规则码和文件位置修复，不能以人工自检替代或隐藏非零退出。机器通过后再评审文档真实性、理由和读者用途。Node 不可用时报告自动化阻塞，不声称门禁通过。

## 产出与完成标准

| 产物 | 完成要求 |
|---|---|
| JSON 配置与导航 | 真实路径、状态、来源所有权；无业务事实捏造 |
| notes 政策与入口 | 复用既有布局、单个受管段、可发现四个流程 |
| bootstrap 结果 | 实际命令、退出码、未确认项；门禁0才称结构接入完成 |
| 后续执行责任 | 已授权 CI/hook 则接入非零阻断；未接入就写未自动强制 |

## 示例与误用

已有 `notes/plan.md` 时用 `--notes notes`，保留其提案状态；不同时建立 `.agent/notes`。断链、模板残留和未知主状态交由门禁拒绝；“计划已经实现”、是否需要 note 仍须核实。门禁不证明 harness 确实每次调用 skill，也不授权发布、提交或删除。
