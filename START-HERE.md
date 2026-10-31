# 接入可执行 docs 与决策笔记工具包

整目录复制到目标项目后即可运行；需要 Node.js 20+，无 npm install 或第三方依赖。不要求双语、固定 notes 名称或原仓库工具。以下命令统一从目标根运行，示例假设安装在根下 docs-notes-toolkit；若实际位于 tools/knowledge-kit，则把所有命令中的 docs-notes-toolkit 替换为 tools/knowledge-kit（含测试和四个 skills 中的命令）。工具包必须位于目标仓库内。

## 编码工具插件入口

Claude Code、Codex 和 Cursor 的原生 manifest、项目安装及调用见 [PLATFORMS](PLATFORMS.md)。推荐运行 `node docs-notes-toolkit/scripts/integrations.mjs install --tool all --root <目标绝对路径>`，安全生成各工具入口并保留完整运行时；此步不初始化 docs。插件缓存位于项目外时也先安装到项目，不能直接绕过 CLI 的项目路径约束。原有手工复制和下列 CLI 用法继续有效。

## 最短接入路径

1. 保持目录结构完整，包含 scripts、tests、templates 和 skills。不能只复制四个 SKILL.md；也不要单独安装四个目录后丢掉脚本。可从任意路径明确读取 skill；自动发现并非必需。
2. 读目标项目指令，确认实际根、已有 docs/notes/agent 入口和写入权限。先检查执行入口，再初始化：

```sh
node docs-notes-toolkit/scripts/docs-notes.mjs --help
node --test docs-notes-toolkit/tests/cli.test.mjs docs-notes-toolkit/tests/boundaries.test.mjs docs-notes-toolkit/tests/integrations.test.mjs
node docs-notes-toolkit/scripts/docs-notes.mjs init --root .
node docs-notes-toolkit/scripts/docs-notes.mjs gate --config docs/maintenance.json --phase bootstrap
```

3. init 自动生成可直接供 bootstrap gate 使用的 docs/maintenance.json、docs/index.md、notes 政策及 agent 受管入口段；默认 notes 为 .agent/notes、入口为 AGENTS.md。初始化机器配置可没有业务 ownership，结构门禁仍可执行，但不代表业务来源已覆盖。它生成最小英文导航与政策。已有 notes 时传 `--notes notes`；已有其他 docs 或入口用 `--docs`、`--entry`，配置位置可用 `--config`。冲突不覆盖，按[执行说明](AUTOMATION.md)采用已有内容并建立 JSON。根据项目语言编辑，不虚构业务事实。
4. 核对机器配置、导航和受管入口；将实际“主题 → document → sources”登记进 ownership。init 接入最小体系不表示全仓来源已覆盖。按项目授权将 check/gate 接入 CI 或提交前流程；未接入时明确标为人工触发，不能称自动强制。

## 可直接交给 agent 的接入提示

```text
为明确指定的目标仓库建立并持续维护 docs 与决策笔记，不总结整个工程。
先读 docs-notes-toolkit/skills/docs-notes-bootstrap/SKILL.md 和 AUTOMATION.md。
允许新建文档、修改文档及合并已有 agent 指令；移动、删除和发布另行确认。
复用现有 docs、notes 和指令；运行 Node CLI 初始化、配置检查及 bootstrap 门禁。
后续在变更前保存可信 snapshot，变更后填写 JSON 报告并运行对应阶段 gate。
不要覆盖无关文件、重置前态、杜撰命令/理由或用人工自检代替失败的机器检查。
无法运行 Node 或不能修改入口时报告阻塞，不宣称自动化接入已完成。
```

工具包路径可变，命令和入口链接都必须按实际位置填写。`repoRoot` 相对 JSON 所在目录，其他字段相对仓库根，Markdown 链接相对包含文件；不能依赖 agent 启动目录。

## 四个流程与阻断入口

| 事件 | Skill | 变更前 | 交付前 |
|---|---|---|---|
| 首次接入 | [bootstrap](skills/docs-notes-bootstrap/SKILL.md) | 核实权限和已有布局 | gate --phase bootstrap |
| 代码/配置/命令/行为变更 | [update](skills/docs-notes-update/SKILL.md) | snapshot | gate --phase update + baseline/report |
| 整理、替代、归档 | [curate](skills/docs-notes-curate/SKILL.md) | snapshot，核实移动/删除权限 | gate --phase curate + baseline/report |
| 已验证知识进入 docs | [promote](skills/docs-notes-promote/SKILL.md) | snapshot，核实 active 来源和读者用途 | gate --phase promote + baseline/report |

日常示例：

```sh
node docs-notes-toolkit/scripts/docs-notes.mjs snapshot --config docs/maintenance.json --output .docs-notes-before.json
# 更新项目文件，填写 workflow-report.json
node docs-notes-toolkit/scripts/docs-notes.mjs gate --config docs/maintenance.json --phase update --baseline .docs-notes-before.json --report workflow-report.json
```

完整参数、报告字段、基准可信来源、失败码和 CI 接线见 [AUTOMATION](AUTOMATION.md)。所有动作需使用本次变更前态；不能事后 snapshot 然后声称已检查变更。不自动执行任意项目命令，也不自动提交或发布。

## 模板与参考

- [机器配置](templates/maintenance.config.json)：项目根、受管范围、状态和显式所有权映射。
- [阶段报告](templates/workflow-report.json)：路径、动作、理由、归档来源与晋升证据。
- [人工维护说明](skills/docs-notes-bootstrap/templates/maintenance-profile.md)：链接 JSON，不重复维护第二套机器字段。
- [docs 导航](skills/docs-notes-bootstrap/templates/docs-index.md)与[notes 政策](skills/docs-notes-bootstrap/templates/notes-policy.md)：内容分工、生命周期及现状/历史隔离。
- [agent 入口](skills/docs-notes-bootstrap/templates/agent-entry.md)：单个受管段与真实 skill/命令链接。
- [决策笔记](skills/docs-notes-bootstrap/templates/decision-note.md)、[参考](skills/docs-notes-bootstrap/templates/reference-page.md)、[教程](skills/docs-notes-bootstrap/templates/tutorial-page.md)和[人工交接](skills/docs-notes-bootstrap/templates/change-report.md)：读者任务、理由、限制与真实验证。
- [生命周期](skills/docs-notes-bootstrap/references/lifecycle.md)和[验收场景](skills/docs-notes-bootstrap/tests/acceptance-scenarios.md)：机器无法替代的判断与应用试验。

模板不等于事实。项目输出不可残留占位符；没有证据就填明确未知或暂缓生成。配置模板中的示例路径必须替换成目标实际文件。

## 验收与限制

校验器可发现断链、状态错误、重复 topic、未处理的已登记来源变化、未交代的文档变化、归档篡改和非法晋升身份；不能判断语义重复、理由价值、真实实现或证据充分性。机器通过后仍读正文并执行必要行为验证，不把存在一个源码路径当成证明。

用[真实 CLI 测试](tests/cli.test.mjs)检查正常与违规场景，再在项目副本演练：初始化两次不重复，update 不留陈旧事实，promote 不把未来功能当现状，curate 不归档仍有价值记录。下一 agent 从项目入口应找到配置和对应命令。

复制包只提供可执行能力；CI/hook 必须明确接入并保留非零退出码。基准需可信且受控，不能自动证明人已批准删除或保证恶意修改者不篡改基线。已有更严格历史政策优先，工具能力不足时报告阻塞。
