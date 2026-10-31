---
name: docs-notes-curate
description: Use when decision notes are duplicated, stale, superseded, difficult to retrieve, or being reviewed for retention and historical archiving.
---

# 整理与归档决策笔记

## 插件与项目运行时

本 skill 同时由 Claude Code、Codex 和 Cursor 插件加载。先定位本文件所在完整工具包根（skills/ 上两级），再确认目标项目；插件安装路径不等于项目根。如果工具包在用户插件缓存或项目外，获准后执行 `node <实际工具包根>/scripts/integrations.mjs install --tool <claude|codex|cursor> --root <目标绝对目录>`，将完整运行时及项目入口安全复制进项目；随后读取项目内同名规范 skill 继续。缓存中不存项目配置、基准或报告。若已有项目配置，先读取 toolkitRoot，复用它，不默认安装第二套。CLI 命令中的 docs-notes-toolkit 替换为真实项目内路径。安装器不初始化业务 docs、不修改全局配置或授权删除。

## 触发与输入

输入：目标、项目 maintenance.json、明确笔记集合、编辑/移动/删除权限及可信前态。没有删除权限不得删除；没有范围不扩全仓。先读[生命周期](../docs-notes-bootstrap/references/lifecycle.md)和[门禁说明](../../AUTOMATION.md)。

## 执行步骤

1. 整理前运行 `node docs-notes-toolkit/scripts/docs-notes.mjs snapshot --config docs/maintenance.json --output .docs-notes-before.json`。check 通过不能替代历史比较；缺旧基准时不得声称发现了更早的历史篡改。
2. 读取范围内当前记录、实现、docs、新旧关系及入站链接，逐份列当前约束、独有理由、替代范围、证据、建议动作与权限。不按年龄/字数/配额分类，也不因晋升就整体归档。
3. 按表处理，未经授权只建议：

| 观察条件 | 动作 |
|---|---|
| 安全、兼容、替代方案、负面保证仍约束未来 | 保留当前并修正事实位置 |
| 同一决策重复或完全替代 | 先保存全部独有理由/后果/验证/缺口，再按授权合并或归档 |
| 部分替代 | 保留有效部分，标范围并双向关联 |
| 已实施且无未来指导，但有历史价值 | 可归档；机器仍检查 active 来源与正文完整性 |
| 机械日志无长期理由 | 建议删除；无权限保留，不塞归档绕过删除约束 |
| proposed 尚未决定或完成 | 保持 proposed，不自动否决/归档 |
| 明确 rejected 且仍防止诱人错误 | 保留；无价值时建议授权删除 |

4. 归档按项目更严格规则执行。默认允许移入 archiveRoot、添加 `Archived: YYYY-MM-DD` 并机械重定位相对链接保持原目标，然后冻结；不改决策事实。严格政策禁止重定位则采用其许可方案或报告受阻。工具默认门禁不表示项目已经授权移动或采用另一种历史策略。
5. 修复所有入站引用：当前依据指向当前所有者，有意历史引用才保留归档目标。机器会检查扫描范围内入站链接，但不能判断引用是否误用为现状。冻结历史不按现在的语义刷新。
6. 填写[JSON 报告](../../templates/workflow-report.json)，phase=curate。归档 decision 记录新 path、action=archived、from=原路径和理由；删除 action=deleted 并说明，人类授权另查。所有变化文档/笔记也记录；无变化留分类理由。
7. 运行 `node docs-notes-toolkit/scripts/docs-notes.mjs gate --config docs/maintenance.json --phase curate --baseline .docs-notes-before.json --report workflow-report.json`。现有归档改一字或删除也必须失败，不能重做基准放行；未授权动作即使能过机器也不得执行。
8. 交付逐项结论、实际动作、门禁结果、保留理由和阻塞。正文是否值得保留、是否完整保存替代方案仍需语义评审，不以哈希替代。

## 产出与完成标准

范围内记录均有分类；有效理由未丢；有权限的移动修复引用；JSON 报告与前态对应；curate 返回0且权限/价值评审通过才交付。普通 check 不证明冻结未被修改。基准和报告是受信任输入，CI 应控制基准来源。

## 示例与误用

旧安全记录留当前，未决提案不归档，机械日志无删除权保留，半替代记录保留未替代部分。新归档 active 必须对应原记录，不能改状态伪装；已冻结内容不能修改后重新快照。归档门禁验证身份和完整性，不自动决定归档价值。
