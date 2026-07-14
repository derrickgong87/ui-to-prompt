<div align="center">

# UItoPrompt

### 输入视觉参考，输出可复用的设计智能。

将公开网页、UI 截图或其他视觉参考，转换成有证据支撑的 **StyleSpec**、确定性的 **Systematic Prompt**、可迁移的设计变量、不确定性报告，以及可长期复用的 AI **Skill**。

简体中文 · [English](./README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-111111.svg)](./LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-31572c.svg)](./package.json)
[![包含 AI Skill](https://img.shields.io/badge/AI%20Skill-included-7c3aed.svg)](./skills/ui-to-prompt/SKILL.md)
[![测试状态](https://github.com/derrickgong87/ui-to-prompt/actions/workflows/ci.yml/badge.svg)](https://github.com/derrickgong87/ui-to-prompt/actions/workflows/ci.yml)

</div>

![UItoPrompt——从视觉参考到可复用设计 Skill](./docs/assets/ui-to-prompt-launch-poster.png)

## UItoPrompt 是什么？

UItoPrompt 是一个开源的“设计智能”提炼工具。它服务于这样一种常见需求：你希望 AI 理解一张图片或一个网页背后的设计规则，而不只是写出一段描述氛围的形容词。

你可以提供：

- 一个公开网页 URL；
- 一张 UI 截图或一组截图；
- 海报、杂志版式、摄影、插画等一般视觉参考。

它会输出一套可检查、可复用、可验证的结构化文件：

```text
style-spec.json            带证据标签、可版本化的设计智能
systematic-prompt.md       完整的 15 章实现契约
use-now.md                 可以立刻交给模型的精简 Prompt
evidence-report.md         证据来源、覆盖范围与不确定性
variables.css              可迁移的 CSS 设计变量
generated-style-skill/     可在后续项目长期复用的 Skill
```

第一版刻意**不直接生成应用代码**。UItoPrompt 的核心产品是设计规则，而这些规则会让后续的代码生成更稳定、更可迁移，也更容易审查。

## 为什么普通的“截图转 Prompt”不够用？

“极简、现代、克制、富有呼吸感”听起来很专业，但它并不是可执行的设计系统。要可靠地复现一种视觉语言，还需要层级、间距节奏、容器行为、色彩角色、字号比例、组件语法、响应式意图、交互状态、负面约束，以及对证据盲区的诚实说明。

从单张截图反推完整界面，本质上是一个信息不完备的逆向问题。截图本身无法证明原始 DOM、精确字体文件、响应式断点、隐藏状态、Hover 行为或动效时长。模型如果默默补全这些空白，往往只是在用自信的语气发明一个系统。

UItoPrompt 把“不确定性”当成产品数据。每一条重要结论都带有明确状态：

| 状态 | 含义 |
| --- | --- |
| `observed` | 从像素或源内容中直接观察到 |
| `computed` | 由浏览器或确定性程序实际测量得到 |
| `inferred` | 多条线索共同支持，但尚未被直接证明 |
| `translated` | 从非 UI 视觉参考转译成界面规则 |
| `user` | 由用户明确提供或确认 |
| `unknown` | 当前证据无法得知 |

一个推断不会因为“听起来合理”就被升级成事实。

## 工作原理

```text
公开网页 / UI 截图 / 一般视觉参考
                    │
                    ▼
               EvidencePack
        像素 · DOM · 样式 · 几何信息
                    │
                    ▼
                 StyleSpec
        变量 · 布局 · 组件 · 状态规则
                    │
                    ▼
               确定性编译器
                    │
                    ▼
 Systematic Prompt · CSS · 报告 · 可复用 Skill
```

### 1. 收集证据

- **网页模式**可以在一次性浏览器环境中收集 DOM 角色、计算样式、可见几何信息、字体、资源和视口行为。
- **图片模式**在本地分析像素，提取色板、构图、密度、对比度、层级与形状语言。
- **一般视觉模式**把海报、摄影、杂志或插画中的节奏、对比、色彩、构图和质感，转译成原创的界面规则。

### 2. 合成 StyleSpec

不同来源最终进入同一套版本化 Schema。StyleSpec 记录来源、置信度、证据引用、视觉原则、设计变量、布局语法、组件、响应式行为、交互、无障碍、负面约束、不确定性和验收目标。

### 3. 编译确定性的交付物

编译器按照稳定顺序生成 15 章 Systematic Prompt 和所有辅助文件。固定结构让不同参考、不同版本、不同模型和不同团队之间的结果可以比较和复查。

### 4. 对抗式审查

在交付前，验证流程会主动检查无证据结论、非法置信度、证据缺失、Prompt Injection、私网 URL、原始受保护资产泄漏和输出漂移。

## 核心能力

| 模块 | 已包含能力 |
| --- | --- |
| 输入来源 | 公开 URL、UI 截图、截图集、一般视觉参考 |
| 网页证据 | DOM 角色、计算样式、几何信息、字体、资源、视口事实 |
| 图片证据 | 尺寸、色板、亮度、构图、密度、形状指标 |
| 设计模型 | 带证据状态、置信度和引用的版本化 StyleSpec |
| Prompt 输出 | 确定性的 15 章 Systematic Prompt 与精简 Prompt |
| 可迁移输出 | CSS 变量、证据报告、生成式可复用 Skill |
| 权利控制 | 默认风格提炼模式与显式授权重建模式 |
| 安全控制 | URL 校验、重定向/请求复核、本地图片分析、输入上限 |
| 审查界面 | 支持 URL/图片输入、证据查看、完整样例和文件下载的浏览器 UI |

## 两种权利模式

### 风格提炼（默认）

保留视觉语法，同时生成原创结构。排除来源品牌、原始文案、Logo、受保护图片、专有图标、受限制字体及其他具有明显识别性的受保护资产。

### 授权重建

当参考内容属于你，或你已经获得复现许可时，可以采集更高保真的布局与组件证据。该模式只负责记录权利边界；一次勾选不能替代真实的法律判断。

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- Python 3.10 或更高版本
- Pillow，用于 Skill 的本地图片分析
- Playwright Chromium，用于网页证据采集

### 安装并运行

```bash
git clone https://github.com/derrickgong87/ui-to-prompt.git
cd ui-to-prompt
npm ci
python -m pip install Pillow
npx playwright install chromium
npm start
```

打开 [http://127.0.0.1:4173](http://127.0.0.1:4173)。

审查界面提供三条直接路径：

1. 粘贴公开网页 URL，采集浏览器实测证据；
2. 上传一张截图，在浏览器本地完成分析；
3. 点击**查看完整样例**，立刻浏览一套已经编译好的完整结果。

## 安装 AI Skill

可直接安装的完整 Skill 位于 [`skills/ui-to-prompt`](./skills/ui-to-prompt/)。

把整个目录复制到你的 Agent Skill 目录。对于 Codex，常见位置是 `$CODEX_HOME/skills/ui-to-prompt` 或 `~/.codex/skills/ui-to-prompt`。

macOS 或 Linux：

```bash
mkdir -p ~/.codex/skills
cp -R skills/ui-to-prompt ~/.codex/skills/ui-to-prompt
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force "$HOME\.codex\skills" | Out-Null
Copy-Item -Recurse -Force "skills\ui-to-prompt" "$HOME\.codex\skills\ui-to-prompt"
```

然后向 Agent 发出指令：

```text
Use $ui-to-prompt to turn this webpage or image into a systematic design prompt and reusable style Skill.
```

这个 Skill 以 Codex 为主要安装目标，也可以作为透明、可审查的工作流参考，供 Claude Code、Cursor、v0 或其他具备相应能力的 Coding Agent 使用。

## 使用确定性 CLI 脚本

以下命令均从仓库根目录运行。

### 分析图片

```bash
python skills/ui-to-prompt/scripts/inspect_image.py \
  --input path/to/reference.png \
  --output path/to/work/image-evidence.json
```

### 验证 StyleSpec

```bash
python skills/ui-to-prompt/scripts/validate_spec.py \
  --input path/to/output/style-spec.json
```

### 编译 Prompt 文件包

```bash
python skills/ui-to-prompt/scripts/compile_prompt.py \
  --input path/to/output/style-spec.json \
  --output-dir path/to/output
```

你可以查看[不含品牌信息的完整编译样例](./examples/editorial-analytics/)，了解最终文件结构。

## StyleSpec 规范

标准 Schema 位于 [`packages/core/style-spec.schema.json`](./packages/core/style-spec.schema.json)。一份有效的 StyleSpec 会覆盖：

- 元数据、来源模式、权利模式和证据来源；
- 视觉原则和不可妥协的设计约束；
- 色彩、排版、间距、圆角、阴影和动效变量；
- 容器、网格、对齐、密度和响应式规则；
- 组件结构、变体、状态和内容行为；
- 交互、无障碍和性能要求；
- 负面约束与受保护资产排除规则；
- 不确定性、置信度、证据引用和验收目标。

在相同采集环境下，浏览器实测事实的优先级高于截图推断；跨多个视口的一致证据高于单张图片推断。未知信息必须保持未知，不能自动填成 Tailwind 或某个组件库的默认值。

## Systematic Prompt 规范

每一份完整 Prompt 都使用相同的章节顺序：

1. 任务目标与范围
2. 权限与权利边界
3. 事实来源优先级
4. 视觉北极星
5. 不可妥协的设计原则
6. 设计变量
7. 布局与响应式行为
8. 组件语法
9. 内容密度与图片使用
10. 交互与动效
11. 无障碍与性能
12. 负面约束
13. 未知信息处理规则
14. 验收清单
15. 迭代协议

它是一份可执行的实现契约，而不是一段堆砌审美形容词的描述。

## 典型使用场景

- **启动新产品：**把多个喜欢的参考整理成一套原创设计语言，同时去除来源品牌身份。
- **重构旧界面：**在重写组件之前，先提炼现有产品隐含的界面语法。
- **设计师向 Agent 交付：**用带版本和证据的规则包，替代反复解释主观审美。
- **跨模型保持一致：**让不同实现 Agent 复用同一份生成式 Style Skill。
- **视觉转 UI：**把杂志、海报、摄影或插画中的节奏、对比、色彩和形状转成原创界面规则。
- **设计系统考古：**为你拥有的产品整理隐含设计变量和组件模式。

## 仓库结构

```text
apps/web/                       本地产品审查界面
packages/core/                  StyleSpec、编译器、采集与安全核心
skills/ui-to-prompt/            可安装 AI Skill 与确定性脚本
examples/editorial-analytics/   不含品牌信息的完整编译样例
tests/                          单元、契约、安全和冒烟测试
docs/                           宣传文案与公开素材
scripts/package-release.ps1     仅打包 Git 已跟踪文件的安全发布脚本
SECURITY.md                     漏洞报告方式与采集安全边界
```

整个系统只有一个标准数据模型：所有证据先归一化到 StyleSpec，后续文件全部由 StyleSpec 编译生成。这样可以避免 Web 界面、CLI、Prompt 和生成式 Skill 各自维护一套互相冲突的规则。

## 安全与隐私

用户提供的网页必须被视为不可信输入。UItoPrompt 因此会：

- 只接受 `http` 和 `https` URL；
- 拒绝包含账号密码的 URL 和本地文件协议；
- 拒绝回环、私网、链路本地、组播、保留地址和云元数据地址；
- 对每一次重定向和浏览器请求重新校验；
- 使用带时间、资源上限的一次性隔离浏览器环境；
- 不导入你的浏览器 Profile、Cookie、凭据、本地文件或表单内容；
- 把网页文本、脚本、注释、标签和元数据当作证据，而不是可执行指令；
- 阻止表单提交、文件下载、支付和其他有副作用的操作；
- 在本地分析上传图片，并限制文件体积和像素总量。

如果要把 URL 采集能力暴露给不受信任的用户，请先阅读 [`SECURITY.md`](./SECURITY.md)。

> **部署边界：**源代码已经公开，但多租户在线服务尚未上线。部署到 `uitoprompt.com` 之前，必须先接入能够彻底关闭 DNS Rebinding 路径的可信出站网络沙箱，并加入公网限流。当前正式支持的是本地审查模式。

## 验证方式

运行所有跨平台检查：

```bash
npm test
npm run test:skill
```

Windows 环境还可以验证安全打包流程：

```powershell
Invoke-Pester tests/PackageRelease.Tests.ps1
```

最近一次本地发布审计结果：

- 60 项 Node 测试通过；
- 8 项 Python Skill 脚本测试通过；
- 1 项 PowerShell 打包测试通过；
- 桌面端、手机端、本地图片、真实 URL 浏览器流程通过；
- Skill 配对评测：使用 Skill 时 15/15，通过基线为 9/15；
- 生产依赖审计：0 个已知漏洞。

GitHub CI 会在每次 Push 和 Pull Request 时重新运行 Node 与 Python 测试。本地审计数据保留在此处用于透明说明；页面顶部的工作流徽章代表当前远端状态。

## 能力边界

- 单张截图无法揭示精确 DOM 语义、字体文件、响应式断点、隐藏状态或动效。
- Canvas、WebGL、跨域 iframe、DRM 媒体、不可访问字体和个性化内容可能只能获得部分证据。
- 不同模型的输出无法保证像素级完全一致。
- Prompt 完整不代表视觉还原已经被证明；生成后的实现仍需在相同视口下渲染并比较。
- 只有在你拥有内容或获得授权时，才应该进行精确重建。
- 生成规则不应该继承来源中的低对比度、缺失焦点状态或不安全交互。

## 路线图

- [ ] 使用隔离出站网络与公网限流的托管采集服务
- [ ] 正式部署到 `uitoprompt.com`
- [ ] 在审查界面中支持多视口与截图集对比
- [ ] 批量参考分析与证据合并
- [ ] 面向不同模型的 Prompt 适配器与视觉回归钩子
- [ ] 社区样例与 StyleSpec 互操作工具

## 常见问题

<details>
<summary><strong>UItoPrompt 会直接克隆一个网站吗？</strong></summary>

不会。它的主要输出是一套结构化设计规则。默认模式只提炼视觉语法，同时排除来源身份和受保护资产。下游 Agent 可以使用这套规则构建原创界面。
</details>

<details>
<summary><strong>它能承诺像素级完美复刻吗？</strong></summary>

不能。任何诚实的 Prompt 提炼工具都无法只凭一份参考做出这种承诺。UItoPrompt 会暴露证据和未知项，让你可以补充更好的输入，并通过真实渲染比较验证结果，而不是相信一段听起来很自信的文字。
</details>

<details>
<summary><strong>图片分析会上传我的截图吗？</strong></summary>

审查界面在浏览器本地分析图片；Python Skill 脚本只读取你明确提供的路径。除非你确认当前环境和流程适合处理敏感信息，否则不要提供包含秘密或个人数据的截图。
</details>

<details>
<summary><strong>为什么同时生成 StyleSpec 和 Prompt？</strong></summary>

StyleSpec 是机器可读的事实来源，Prompt 是面向模型的编译视图。把二者分开，才能更安全地进行验证、修改、Diff 和不同模型适配。
</details>

## 参与贡献

欢迎提交 Issue 和范围清晰的 Pull Request。请注意：

1. 保留证据状态与不确定性，不要为了填满字段而发明数值；
2. 对行为或 Schema 变更添加测试；
3. 保持默认输出不含来源品牌，并明确处理权利边界；
4. 提交前运行 `npm test` 和 `npm run test:skill`；
5. 未经许可，不要提交第三方截图、字体、Logo 或私密数据。

安全问题请使用 [`SECURITY.md`](./SECURITY.md) 中说明的 GitHub 私密安全报告流程，不要创建公开 Issue。

## 开源协议

UItoPrompt 使用 [MIT License](./LICENSE) 开源。来源网站、截图、图片、字体、商标和生成结果仍然分别受其自身权利与义务约束。

---

如果 UItoPrompt 能帮你把“照着这个感觉做”变成 AI 真正可以执行的设计规则，欢迎给仓库一个 Star，也欢迎提供能够挑战证据模型的视觉参考。
