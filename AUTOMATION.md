# 可执行检查与流程门禁

工具包自带无第三方依赖的 Node.js 校验器。需要 Node.js 20 或更新版本，不需要 npm install、原仓库、联网、全局插件或特定编程语言。所有命令从目标项目根执行；工具包目录若改名，替换命令中的 `docs-notes-toolkit`。CLI 路径始终由调用方明确提供。

## 一个入口，四个命令

```sh
node docs-notes-toolkit/scripts/docs-notes.mjs --help
node docs-notes-toolkit/scripts/docs-notes.mjs init --root .
node docs-notes-toolkit/scripts/docs-notes.mjs check --config docs/maintenance.json
node docs-notes-toolkit/scripts/docs-notes.mjs gate --config docs/maintenance.json --phase bootstrap
```

`init` 是唯一负责写项目接入文件的入口；其余检查和门禁不改写文档、归档或报告。`snapshot` 只新建指定基准文件，拒绝覆盖。校验器不会执行配置或报告中记录的命令。

初始化可用 `--docs`、`--notes`、`--entry` 指定既有布局，例如 `init --root . --docs handbook --notes notes --entry AGENTS.md`。配置默认位于 docs/maintenance.json，`--config` 可选择相对于项目根的位置。初始化只创建最小英文导航与政策，不虚构业务事实；之后可以按项目语言改写。已有文档冲突会失败并要求人工采用已有内容，不会覆盖。再次初始化复用已有配置，不重置所有权，也不重复添加 agent 入口段。

## 修改前建立基准，修改后执行门禁

```sh
node docs-notes-toolkit/scripts/docs-notes.mjs snapshot --config docs/maintenance.json --output .docs-notes-before.json
# 执行当前任务，填写本次 workflow-report.json
node docs-notes-toolkit/scripts/docs-notes.mjs gate --config docs/maintenance.json --phase update --baseline .docs-notes-before.json --report workflow-report.json
```

整理时把 `update` 改为 `curate`；晋升改为 `promote`。基准必须在变更前从已检查通过的状态生成，不能在变更后重建并称作前态。初始化使用 `bootstrap`，无需基准或报告。每次独立任务使用新的基准输出路径；不要把快照放进归档或用它覆盖已有文件。

基准包含根无关路径、文件内容和哈希，可能包含项目文档及登记的源码；按项目数据政策保管，不发布到外部。基准是受信任的输入，不是抗恶意篡改的签名：CI 应从可信基线生成/提供，不能让修改者用当前内容替换基线来规避检查。哈希用于检测内容变化和损坏，不证明记录者诚实。

## JSON 配置与报告

机器配置是项目自己的 `maintenance.json`，不是工具包模板。`repoRoot` 相对配置所在目录解析，其他项目路径相对仓库根。目录名、主状态字段和状态值均可映射；不从当前 shell 目录推断项目根。参阅[机器配置模板](templates/maintenance.config.json)，人工说明可继续使用[维护配置说明模板](skills/docs-notes-bootstrap/templates/maintenance-profile.md)。路径越界或逃逸符号链接会被拒绝。

`ownership` 每项登记 `topic`、详细文档 `document`、事实来源 `sources`；同一 topic 不能指向多个详细所有者。它是显式依赖映射，不是全仓语义去重器。初始化时可为空，接入实际业务文档后应逐步登记；未登记的源码变化不在自动失效检测覆盖内。

报告使用[workflow-report 模板](templates/workflow-report.json)：`version` 为1，`phase` 与门禁一致；`decisions` 记录路径、动作、涉及文档和非空理由，`promotions` 记录晋升来源、目标、证据路径和理由。报告和基准路径由命令显式传入；二者不是“检查已通过”的证明，门禁会重新检查当前文件。

- 修改或新增受管文档/笔记：decision 的 `path` 指向该文件，`action` 为 `updated`，填写 `reason` 和相关 `documents`。
- 登记的事实源改变而文档无需更新：针对事实源路径提交 `action: unchanged` 和具体理由，不能用空白报告跳过。
- 移入历史：`path` 是新归档路径，`action: archived`，`from` 指向基准中的原当前笔记，说明理由。原文件应移除；需要更严格政策时先评审，不把门禁当授权。
- 删除：必须有 `action: deleted` 与理由。机器只能确认报告明确记录删除，不能确认人已授权；权限仍由项目约束。
- 晋升：`promotions` 非空，来源为当前已实施笔记且仍保留，目标为本次变化的正式文档，`evidence` 为实际存在的项目路径。证据路径存在不等于证明实现正确。

主状态写在第一个 H2 之前，例如 `Status: active`。拒绝记录可用 `Status: rejected — 原因`，或独立的 `Reason:` / `Rejection reason:` 行。状态值和 statusField 可配置，主状态映射必须互不重叠；H2 后的局部状态不参与主身份判断。未实现内容即使放在 active 笔记正文中，仍需语义评审。

基准允许新增 ownership，但拒绝修改/删除既有映射或改变受管范围、状态配置，以防本次变更缩小检查范围。确实需要迁移配置时，应单独评审并以新的可信接入状态开始下一任务；不要在同次 gate 偷换范围。受管 docs/notes 内的符号链接会显式失败，不会静默跳过；需改为普通文件或调整项目约定。

支持的 Markdown 子集为 ATX 标题、重复标题数字后缀、显式 `<a id>` 锚点、行内/引用定义/图片链接、百分号编码与 query/fragment；忽略 fenced 与 inline code 中的链接。`{{...}}` 在代码示例中也视为残留模板；尖括号占位符只检查正文，已知 HTML 标签和自动链接除外。不支持完整 CommonMark、setext 标题、任意嵌套/转义方言或 HTML href 验证；嵌套目的地可改用 angle/reference，复杂语法另用项目 Markdown 检查。

归档标记采用前置一行 `Archived: YYYY-MM-DD`；门禁移除该行后比较原正文，并只允许保留原目标的相对链接重定位。默认只比较受管 Markdown 历史。非 Markdown 归档附件、主文档根以外的入站引用不在扫描覆盖内，须项目额外验证。

完整示例：

```json
{
  "version": 1,
  "phase": "update",
  "decisions": [
    {
      "path": "docs/config.md",
      "action": "updated",
      "documents": ["docs/config.md"],
      "reason": "Retry configuration changed; synchronized its detailed reference."
    }
  ],
  "promotions": []
}
```

## 自动检查覆盖

| 检查 | 发现什么 | 不能证明什么 |
|---|---|---|
| 配置、路径、入口 | 必填字段、范围错误、必需页面缺失、受管入口段重复/缺失、实际 skill 链接错误 | harness 是否真的在所有任务读取入口 |
| Markdown 引用 | 受支持链接、图片和引用定义的本地目标与标题锚点错误；代码内容不误作链接 | 网络 URL 可访问、任意 Markdown 方言完整兼容 |
| 占位符 | 模板残留，不把正常 HTML 标签或自动链接当占位符 | 页面是否足够完整或语言自然 |
| 主状态 | 每份当前 note 首个 H2 之前的主状态缺失/未知/重复；映射允许项目用自己的名称 | 已标 active 的内容确实已实现；H2 以下标注只作局部正文 |
| 所有权与失效 | 重复 topic、无效所有者/事实源；相对基准的已登记 source 变化未更新文档且无理由 | 所有可能受影响的源码都已登记、理由是否成立 |
| 历史保护 | 基准中已归档文件内容变化/删除；未从 active 记录移入；归档正文被改写 | 一份 active 的理由是否不再有价值 |
| 晋升与交接 | 缺报告/阶段错误/未交代受管变化；来源是提案、目标未变化或证据不存在 | 理由与负面保证完整保留、证据能否支持新文档 |

`check` 只确认当前结构，不证明历史未被修改；必须用可信前态执行 `gate` 才能比较。归档不作为现状来源检查，其冻结内容由基准比较；文档指向归档的入站目标仍须存在。没有声称支持的语法或发现范围不能靠绿色结果推断为已验证。

## 失败提示和退出状态

诊断统一包含规则码、文件位置、问题和修复方向，例如：

```text
[LINK_TARGET] docs/config.md:12: local target does not exist; fix the link or restore the file
```

示例展示诊断结构，实际规则码以执行结果为准。退出0表示该入口在声明范围内通过，退出1表示规则违规，退出2表示参数/配置无法使用。不要使用 `|| true`、重置基准或清空所有权来制造成功。

## 接到真实 CI 或提交前检查

复制工具包不会自动安装 hooks 或修改 CI。获得项目授权后，把 `check` 和相应 `gate` 作为阻断步骤接入既有流程，并保留非零退出状态。可信基准可在任务开始保存，在隔离的 CI 基线检出中生成，或作为受控任务产物提供；不要混用来源不明的旧快照。不同阶段报告必须随本次变更提供。

仅运行 `check` 只有当前结构保护，不能声称已强制历史冻结、状态转移或变更交代。要采用本工具包四阶段的完整保护，必须在变更前生成/获取可信 snapshot，再在交付前运行对应 gate 并保留非零退出码；CI 中也必须提供这两个时点及本次报告。只有明确选择纯结构检查时才单独运行 check。写进 skill 或复制目录不会自动接线。

## 工具包自身测试

```sh
node --test docs-notes-toolkit/tests/cli.test.mjs docs-notes-toolkit/tests/boundaries.test.mjs docs-notes-toolkit/tests/integrations.test.mjs
```

测试使用临时项目和真实 CLI 子进程，断言正常退出、违规诊断与非零状态，包括初始化重复执行、路径越界、断链、状态/占位符、所有权变更、归档冻结、错误晋升、阶段报告和整目录改名复制。无需安装第三方依赖；测试临时项目不改当前业务文档。
