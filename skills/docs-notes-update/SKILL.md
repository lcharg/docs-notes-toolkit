---
name: docs-notes-update
description: Use when code, configuration, commands, or user-visible behavior changes, or when current documentation and decision notes disagree with the implementation.
---

# 随变更维护 docs 与决策笔记

## 插件与项目运行时

本 skill 同时由 Claude Code、Codex 和 Cursor 插件加载。先定位本文件所在完整工具包根（skills/ 上两级），再确认目标项目；插件安装路径不等于项目根。如果工具包在用户插件缓存或项目外，获准后执行 `node <实际工具包根>/scripts/integrations.mjs install --tool <claude|codex|cursor> --root <目标绝对目录>`，将完整运行时及项目入口安全复制进项目；随后读取项目内同名规范 skill 继续。缓存中不存项目配置、基准或报告。若已有项目配置，先读取 toolkitRoot，复用它，不默认安装第二套。CLI 命令中的 docs-notes-toolkit 替换为真实项目内路径。安装器不初始化业务 docs、不修改全局配置或授权删除。

## 触发与输入

输入：目标仓库、项目 maintenance.json、变更范围、写入权限和变更前基准。缺少机器配置先执行 docs-notes-bootstrap；文本旧配置按[执行说明](../../AUTOMATION.md)迁移，不凭文本声称机器检查已接入。

读取[公共规则](../docs-notes-bootstrap/references/lifecycle.md)。以下命令从目标根执行，工具包及配置路径按项目实际位置替换。

## 执行步骤

1. 读取指令与 JSON，确认 scope 和事实源。变更前运行 `node docs-notes-toolkit/scripts/docs-notes.mjs snapshot --config docs/maintenance.json --output .docs-notes-before.json`。已有代码变更时从可信未修改基线获取快照；不得在事后重新取当前快照伪装前态。缺前态则报告门禁阻塞。
2. 检索变更标识、旧值、命令、路径、当前笔记及 `ownership`。建立“事实源 → docs → notes → 派生物”影响表。机器只覆盖登记的来源；新增领域应补映射，不能假定未登记就无文档影响。
3. 优先更新已有详细所有者，重复事实改链接。规则进参考、操作进教程；有生成器则改源再生成，没有则不强加。实施与文档冲突而无代码权限时报告，不擅改实现。
4. 判断长期理由：机械编辑无需新 note；原决策实现位置变动就更新既有 note。proposed 核实落地才转 active 并改正文；反转新建后继并关联。只改状态不能证明实现；真实替代方案不可编造。
5. 更新导航、映射和入站链接。来源变而 docs 不需变时，报告具体理由，而不是为了通过而随意改一个字符。稳定知识转移使用 promote，整理使用 curate，不顺手删除历史。
6. 按[JSON 报告模板](../../templates/workflow-report.json)填写本次 `phase: update`。每个变化的受管文档/笔记列 decision；登记来源变化而所有者无需更新时，针对该来源记录 `action: unchanged` 和理由。机器检查理由非空，成立与否由评审判断。
7. 运行 `node docs-notes-toolkit/scripts/docs-notes.mjs gate --config docs/maintenance.json --phase update --baseline .docs-notes-before.json --report workflow-report.json`。保留失败码并修复；另跑项目实际行为验证。别人的测试结果不是本次执行，文档门禁也不是行为验证。
8. 以[人工交接字段](../docs-notes-bootstrap/templates/change-report.md)报告改动、刻意保留、无需 note 的依据、门禁命令/退出码及未验证项。提交和发布不随文档更新自动授权。

## 产出与完成标准

| 产出 | 完成条件 |
|---|---|
| 所有权与当前文档 | 变化事实有去向；重复细节改链接；提案不混现状 |
| note 决定 | 更新/新增/不变有依据，事实与理由不丢 |
| JSON 报告与门禁 | 当前配置+可信前态+本次报告一致，update 返回0 |
| 验证交接 | 机器检查与语义/行为评审分别报告，缺基准不冒称通过 |

## 示例与误用

retry2改5时只在配置参考维护值；README 链接它。来源改了而文档没变、也没有明确 unchanged 理由，门禁应失败；空报告、重建前态、清空 ownership 和仅运行 check 均不能替代 update 门禁。即使返回0，也仍需检查“5”的含义及实现。
