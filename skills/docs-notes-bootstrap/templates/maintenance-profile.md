# 文档维护配置

此文件是可选人工说明，不是机器配置。先用 init 或根 templates/maintenance.config.json 建立项目自己的 maintenance.json，本页链接它，不重复维护两份路径与状态字段。替换尖括号；未知明确记录，不生成假命令。示例目录不是强制约定。

## 项目配置

路径解析约定：`repo_root` 相对于本配置文件所在目录（例如配置在 docs/maintenance.md 则根为 `..`），不相对于当前工作目录。其余路径字段都相对于解析后的仓库根。正文 Markdown 超链接仍相对于包含它的文件。

| 字段 | 项目实际选择 |
|---|---|
| repo_root | <相对本配置目录的位置，例如 ..> |
| docs_root / docs_entry | <例如 docs / docs/index.md；已有入口优先> |
| notes_root / notes_policy | <例如 .agent/notes / .agent/notes/policy.md；已有 notes 目录优先> |
| archive_root | <例如 .agent/notes/archive；尚未归档可只登记不建空目录> |
| agent_entry | <harness 实际读取的指令文件；不存在时记录拟建位置与授权> |
| skill_root | <四个兄弟 skill 所在位置> |
| profile_path | <本文件实际位置> |
| language | <项目选定的单一语言或已有多语言要求；不默认双语> |
| status_mapping | <proposed=…；active/已实施=…；rejected=…> |
| archive_policy | <缺省 frozen-body；已有项目政策则写具体约定> |
| authoring_scope | <允许新建/编辑/移动的路径；不包含自动发布> |
| deletion_permission | <缺省每次另外确认；或记录已有持久授权> |
| docs_checks | <核实过的命令和作用；没有则写人工检查项目> |
| behavior_checks | <已知相关命令及前置条件；未知不猜> |
| generated_docs | <已有生成器、事实源、输出和检查；无则写无> |
| optional_features | <多语言/网站/CI/预算/归档封印等；不采用写无> |

## 事实所有权

| 主题 | 详细文档所有者 | 事实源 | 更新触发 |
|---|---|---|---|
| <读者关心的主题> | <可点击的真实文件链接> | <实现/测试/配置/实际操作> | <会使说明失效的变更> |

## 自动化执行

- 机器配置：<maintenance.json 的真实相对链接>。
- 结构检查：<实际 check 命令及结果>。
- 阶段门禁：<phase、可信基准、本次 JSON 报告、实际命令/退出码>。
- 自动接线：<CI/hook 已接入位置；未接入明确写未接入>。
- 语义/行为评审：<机器不能证明的事实、理由与执行结果>。

## 当前接入状态

- 初始化执行范围：<新建与复用文件；未覆盖的既有内容>。
- 尚待确认：<输入/事实/权限/检查缺口；没有则写无>。
- 后续维护入口：<agent_entry 中已接入的位置；若未写入则给出待应用片段并写“未自动接入”>。
