# Hannah 对接说明

2026-10-15。Hannah 负责候选人建档与 Matching，Yuming 负责 Submission 与集成。

## 交付一：候选人资料

从用户指定的 LinkedIn 资料导入教育、工作经历、技能等已有信息，让用户确认，并集中提示补齐必填项。无法导入时支持手动填写；不推断缺失事实，不覆盖已确认资料。

| 文件 | 内容 |
| --- | --- |
| `data/candidate.json` | 一个人的身份、经历和可复用事实，沿用现有 `schemaVersion: 2` 结构 |
| `data/preferences.md` | 求职方向、工作方式、地点等偏好 |
| `data/resumes.json` | 岗位类别对应的简历 PDF 路径与哈希 |

- **必填未完成：**先补齐，再开始自动填写申请。
- **选填未完成：**可以继续；岗位要求时再进入 Review。
- 明确的“无”“不适用”“不愿披露”与未填写分开处理。
- 必填／选填清单见 [evaluation.md](evaluation.md#候选人资料)，不另维护一套规则。

**Implementation status (2026-10-29):** The designated LinkedIn URL choice, browser-observation preview and confirmed new-candidate intake are implemented; see [LinkedIn intake](linkedin-import.md). Live LinkedIn extraction validation, complete application-required-field checks and existing-candidate correction writes remain pending. Profile validation alone does not establish completeness. Coordinate shared fields with Yuming; keep real inputs local and commit fictional fixtures only.

## 交付二：匹配后的岗位

统一写入 **`data/opportunities.json`**，不另建岗位列表。每个岗位提供：

| 字段 | 要求 |
| --- | --- |
| `jobId` | 稳定岗位 ID，重复发现时复用 |
| `company`、`title`、`location` | 公司、职位、地点 |
| `officialUrl`、`category` | 官方 HTTPS 链接、明确配置的岗位类别 |
| `sources`、`firstSeen`、`lastVerified` | 真实来源、首次发现与最近核验日期 |
| `note` | 简短的匹配依据、差距与待确认条件 |
| `availability`、`stage` | 招聘开放状态；交接阶段为 `new` 或 `ready` |

通过现有 **jobs CLI／API** 更新，再执行：

```sh
npm run jobs -- validate --path data/opportunities.json
```

CLI 的 `--status new|ready` 会映射到存储状态。不要整份覆盖 JSON，也不要修改 Submission 的申请、审批和提交记录。具体写入命令见 [commands.md](commands.md)。

LinkedIn 个人资料导入与岗位来源是两回事；如果还要从 LinkedIn 发现岗位，需要补充当前尚不支持的来源枚举，不能冒用其他来源。

## 对接完成标准

用户能确认资料并补齐必填项；岗位记录能通过校验、出现在现有工作台，并由 Submission 使用同一 ID 继续处理。`ready` 和 Review 中的 Approve 都不代表已获准向雇主提交。
