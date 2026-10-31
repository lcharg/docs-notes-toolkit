---
name: docs-notes-promote
description: Use when decision notes contain verified, repeatedly useful procedures or current rules that readers should find in formal documentation instead of rediscovering in notes.
---

# 将稳定知识沉淀到正式 docs

## 插件与项目运行时

本 skill 同时由 Claude Code、Codex 和 Cursor 插件加载。先定位本文件所在完整工具包根（skills/ 上两级），再确认目标项目；插件安装路径不等于项目根。如果工具包在用户插件缓存或项目外，获准后执行 `node <实际工具包根>/scripts/integrations.mjs install --tool <claude|codex|cursor> --root <目标绝对目录>`，将完整运行时及项目入口安全复制进项目；随后读取项目内同名规范 skill 继续。缓存中不存项目配置、基准或报告。若已有项目配置，先读取 toolkitRoot，复用它，不默认安装第二套。CLI 命令中的 docs-notes-toolkit 替换为真实项目内路径。安装器不初始化业务 docs、不修改全局配置或授权删除。

## 触发与输入

输入：目标、maintenance.json、来源笔记、读者需求、授权范围及可信变更前态。缺配置先 bootstrap。读[公共规则](../docs-notes-bootstrap/references/lifecycle.md)与[执行说明](../../AUTOMATION.md)；稳定不是年龄，晋升单位不是整篇笔记。

## 执行步骤

1. 变更前执行 `node docs-notes-toolkit/scripts/docs-notes.mjs snapshot --config docs/maintenance.json --output .docs-notes-before.json`。检查 source 当前主状态及实际实现。proposed 不直接晋升；先另行核实落地，明确更新为 active 后建立可信基准，不能在同次晋升偷偷洗状态。
2. 逐条去向：当前规则进 reference；已验证操作进 tutorial/runbook；为什么及替代方案留 note；未实现方向仍 proposed；临时过程不晋升。部分已实现的混合笔记只迁核实过的条目。
3. 确认每条有读者任务、已有实现/真实操作、范围与失败语义、详细所有者和更新触发。只有“存在已验证步骤”的说法但没有步骤、命令或事实源时，先产待补输入与结构草稿，不编造。没有真实替代方案不补造历史。
4. 优先补已有文档；无所有者用[reference](../docs-notes-bootstrap/templates/reference-page.md)或[tutorial](../docs-notes-bootstrap/templates/tutorial-page.md)。目标先验证，再将来源详细用法改为目标链接。保留理由、后果、负面保证、验证缺口和提案；来源 note 仍存在，不因迁移细节自动归档。
5. 更新导航和 JSON ownership；登记实际证据路径。路径存在仅是可追查证据入口，不证明事实成立。操作实际运行与静态检查分别记录；没有执行不能声称成功。
6. 填写[workflow-report](../../templates/workflow-report.json)，phase=promote；所有文档/笔记变化列 decisions，promotions 至少包含 source、target、evidence 和非空 reason。目标必须位于当前 docs 且相对基准有变化；来源为已实施当前记录，不能指向归档或删除理由源。
7. 运行 `node docs-notes-toolkit/scripts/docs-notes.mjs gate --config docs/maintenance.json --phase promote --baseline .docs-notes-before.json --report workflow-report.json`。提案来源、未变化目标、缺证据或报告未交代变更须修复，不能只运行 check 放行。另行评审证据是否真能支持正文和理由是否完整。
8. 用[人工交接字段](../docs-notes-bootstrap/templates/change-report.md)记录知识去向、真实编辑、保留理由、未晋升内容、门禁结果与未验证项。归档另走 curate，提交/发布/删除需各自授权。

## 产出与完成标准

| 产物 | 完成条件 |
|---|---|
| 去向与正式文档 | 当前知识有用途、范围、失败限制、所有者及证据 |
| 来源笔记 | 理由/替代/代价保留，详细用法改链接，提案未伪装现状 |
| 配置和报告 | ownership 更新，promotion 与实际变化匹配 |
| 验证 | promote 返回0；语义/操作评审分别报告，未知不冒称完成 |

## 示例与误用

超时规则进参考、真实排障进教程、无限等待的否决理由留笔记、未实现容灾留 proposed。机器可拒绝主状态为 proposed 的来源，却不能判断 active 正文是否暗藏未来能力，也不能证明证据文件内容；这两项仍需阅读。改状态骗门禁、为过检查丢理由和用生成报告代替运行均不接受。
