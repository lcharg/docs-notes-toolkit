<!-- DOCS_NOTES_TOOLKIT:START -->
## 文档与决策笔记维护

先读 <maintenance.json 真实相对链接>，按机器配置解析 docs、notes、状态及所有权；另读 <AUTOMATION.md 真实相对链接>。变更前 snapshot，变更后按阶段 gate；只跑 check 不代替历史和变更检查。不要假定目录或双语要求。

- 初始化缺失体系：读取 docs-notes-bootstrap 的 SKILL.md。
- 修改代码、配置、命令或用户行为：使用 docs-notes-update，在同一变更中更新受影响文档与当前笔记；无影响要解释原因。
- 整理重复、过时或被替代笔记：使用 docs-notes-curate；移动和删除按授权处理。
- 将已验证知识转为正式指南或参考：使用 docs-notes-promote；保留决策理由，提案不写成现状。

上述名称须链接到完整工具包内四个真实 SKILL.md；脚本和模板须一并保留。门禁非零时停止交付并修复，不重置基准或隐去失败。skills 不会自动运行；CI/hook 需另获授权接入。本入口不授权发布、推送或删除。
<!-- DOCS_NOTES_TOOLKIT:END -->
