# docs 与决策笔记工具包

[English](README.md) | 中文

为项目建立并持续维护正式文档和决策笔记。将整个目录复制到其他项目即可使用，不需要来源仓库中的任何文件。

## 快速开始

1. 在 [PLATFORMS](PLATFORMS.md) 选择 Claude Code、Codex、Cursor 原生插件或安全的项目级安装，再按 [START-HERE](START-HERE.md) 接入。
2. 向接收 coding agent 提供目标项目位置，要求读取[初始化 skill](skills/docs-notes-bootstrap/SKILL.md)。即使 harness 不自动发现该目录，也可按明确路径读取。
3. 用随包 CLI 生成可用机器配置和初始化文件；后续先保存可信变更前态，再执行阶段门禁。此举不安装自动定期检查，CI/hooks 需明确接入。[AUTOMATION](AUTOMATION.md) 提供命令、诊断及接线说明。

不要复制来源项目的文档、验证报告或临时测试数据。随包提供的中英文 README 方便阅读，不要求接收项目的文档采用双语。

## 内容

| 路径 | 用途 |
|---|---|
| [START-HERE](START-HERE.md) | 接入步骤、复制方式和可直接使用的提示 |
| [平台安装](PLATFORMS.md) | Claude Code、Codex、Cursor manifest、调用方式及验证限制 |
| [项目安装器](scripts/integrations.mjs) | 碰撞保护的运行时复制及各工具项目 skill 入口 |
| [AUTOMATION](AUTOMATION.md) | 无依赖 CLI、配置、阶段门禁和失败处理 |
| [可执行检查](scripts/docs-notes.mjs) | init、check、snapshot 和 gate 命令 |
| [CLI 测试](tests/cli.test.mjs)与[边界测试](tests/boundaries.test.mjs) | 通过真实子进程覆盖正常与违规场景 |
| [验证范围](VALIDATION.md) | 可重复测试入口与证据/信任限制 |
| [初始化](skills/docs-notes-bootstrap/SKILL.md) | 从零建立或接入项目文档体系 |
| [日常更新](skills/docs-notes-update/SKILL.md) | 随变更同步文档和理由 |
| [整理归档](skills/docs-notes-curate/SKILL.md) | 按决策价值保留、合并与归档笔记 |
| [知识沉淀](skills/docs-notes-promote/SKILL.md) | 将已验证规则和操作转为正式 docs |
| [生命周期参考](skills/docs-notes-bootstrap/references/lifecycle.md) | 共享所有权、状态、保留和晋升规则 |
| [模板](skills/docs-notes-bootstrap/templates/) | 八份项目配置与内容模板 |
| [验收场景](skills/docs-notes-bootstrap/tests/acceptance-scenarios.md) | 可重复的接入与维护检查 |

保持整个工具包完整，包括 `scripts/`、`templates/`、`tests/` 和四个同级 skill 目录。Skills 会调用随包自动化及共享材料，单独移动四个 skill 目录不再是完整安装。Harness 无法自动发现时，按明确文件路径读取。

## 要求与限制

随包检查和测试需要 Node.js 20 或更新版本，只使用标准库，不需要安装步骤或来源仓库依赖。目标项目现有规则、路径和语言优先。不以双语输出、固定笔记路径、包管理器、生成器、网站或自动发现 skill 为前提。

工具包不授权删除、提交、推送或发布，也不创建 hooks 或定时任务。模板故意保留占位符；agent 必须根据实际证据填写或明确处理，再生成目标项目需要维护的文档。
