(function exposeSample(root, factory) {
  const sample = factory();
  if (typeof module === 'object' && module.exports) module.exports = sample;
  root.UI_TO_PROMPT_SAMPLE = sample;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSample() {
  return {
    meta: {
      title: 'Atlas Notes — 编辑式知识工作台',
      sourceType: 'url',
      sourceLabel: '公开网页 · 桌面视口',
      sourceUrl: 'atlas-notes.example',
      capturedAt: '2026-07-14 16:20 CST',
      viewport: '1440 × 960',
      mode: 'style',
      generator: 'UItoPrompt static prototype',
    },
    evidenceSummary: {
      observed: {
        count: 38,
        label: '可见证据',
        detail: '截图、文字层级、主要组件与可见状态',
      },
      computed: {
        count: 24,
        label: '程序测量',
        detail: '颜色聚类、比例、间距节奏与对比度',
      },
      inferred: {
        count: 9,
        label: '系统推断',
        detail: '语义角色、组件语法与视觉原则',
      },
      unknown: {
        count: 4,
        label: '尚未观察',
        detail: '移动端重排、键盘状态、动态数据与完整动效',
      },
    },
    brief: {
      northStar: '像一本正在被编辑的研究笔记：温暖、有秩序，所有信息都留下可追溯的出处。',
      intent: '保留编辑式节奏、克制色彩与证据标记；使用原创品牌、文案和图像，不复制来源身份。',
      invariants: [
        '暖纸色作为主画布，纯白只用于需要聚焦的工作面。',
        '标题与正文形成明显尺度差，不依赖多种装饰字体制造层级。',
        '钴蓝只表达选择和行动，酸性黄只表达证据与扫描标记。',
        '组件以细边框和结构分区为主，避免玻璃质感与浮夸阴影。',
        '所有推断必须暴露来源等级；未知内容不得伪装成确定事实。',
      ],
      limits: [
        '当前样例没有观察登录态、空数据态与错误态。',
        '响应式规则由单张桌面截图推断，需要补充移动端证据。',
      ],
    },
    tokens: {
      colors: {
        canvas: '#f4f1e8',
        surface: '#fffefa',
        ink: '#191a17',
        muted: '#686a62',
        line: '#d7d2c5',
        cobalt: '#3157f5',
        signal: '#ddf45a',
        coral: '#f05a3c',
        success: '#1e7a55',
      },
      typography: {
        display: 'General Sans / 思源黑体 · 650',
        body: 'Instrument Sans / 思源黑体 · 420',
        mono: 'IBM Plex Mono / Cascadia Code · 500',
        scale: ['12 / 16', '14 / 20', '16 / 24', '22 / 28', '38 / 42', '72 / 68'],
      },
      spacing: {
        base: '4px',
        scale: ['4', '8', '12', '16', '24', '32', '48', '72'],
      },
      radii: {
        control: '4px',
        card: '8px',
        panel: '14px',
      },
      motion: {
        micro: '120ms',
        short: '180ms',
        medium: '240ms',
        easing: 'cubic-bezier(.2,.8,.2,1)',
      },
    },
    promptSections: [
      {
        id: 'mission-scope',
        title: 'Mission and scope',
        evidenceType: 'Observed',
        confidence: 'high',
        content: '为知识密集型产品创建编辑式工作台。界面应显得经过整理但仍保留研究过程的痕迹，让用户一眼区分正文、证据、推断和待确认事项。',
      },
      {
        id: 'authority-rights',
        title: 'Authority and rights boundary',
        evidenceType: 'User',
        confidence: 'high',
        content: '仅复用视觉语言和布局原则。移除来源品牌名、标志、原始文案、照片、插画和专有图标；所有内容必须重新创作。',
      },
      {
        id: 'source-truth-order',
        title: 'Source-of-truth order',
        evidenceType: 'Computed',
        confidence: 'high',
        content: '证据冲突时依次采用：同一捕获环境中的浏览器事实、对应视口截图、跨视口一致观察、单图推断、通用设计惯例。未知项继续保持未知，不用常见框架默认值补齐。',
      },
      {
        id: 'visual-north-star',
        title: 'Visual north star',
        evidenceType: 'Inferred',
        confidence: 'medium',
        content: '以“证据账本”作为视觉隐喻：暖纸画布、黑墨排版、精确分栏、细线标注，以及少量用于选择和证据的高饱和信号色。',
      },
      {
        id: 'non-negotiables',
        title: 'Non-negotiable invariants',
        evidenceType: 'Computed',
        confidence: 'high',
        content: '保持强标题尺度差、4px 间距基准、低圆角层级和边框主导的表面。禁止紫色渐变、玻璃卡片、机器人插画、均匀三列功能卡和无解释的相似度百分比。',
      },
      {
        id: 'design-tokens',
        title: 'Design tokens',
        evidenceType: 'Computed',
        confidence: 'high',
        content: '画布 #F4F1E8，工作面 #FFFEFA，文字 #191A17，分隔线 #D7D2C5，交互钴蓝 #3157F5，证据标记 #DDF45A，警示 #F05A3C。圆角仅使用 4/8/14px。',
      },
      {
        id: 'layout-responsive',
        title: 'Layout and responsive behavior',
        evidenceType: 'Unknown',
        confidence: 'low',
        content: '桌面采用 12 栏非对称网格；结果区允许 280px 证据栏、弹性预览区和 420px Prompt Inspector。760px 以下改为单栏页签，比较视图进入全屏。移动端规则需用额外截图验证。',
      },
      {
        id: 'component-grammar',
        title: 'Component grammar',
        evidenceType: 'Observed',
        confidence: 'high',
        content: '按钮、标签和表单共享直角偏低圆角；状态主要通过边框、文字和小面积色块表达。卡片内部用编号、标题、证据标签和正文构成稳定阅读顺序。',
      },
      {
        id: 'content-imagery',
        title: 'Content density and imagery',
        evidenceType: 'Inferred',
        confidence: 'medium',
        content: '使用完整、具体的中文产品文案。图像应为真实界面或本地生成的抽象编辑画面，禁止灰色占位块、AI 人物、发光球体和与功能无关的装饰图。',
      },
      {
        id: 'interaction-motion',
        title: 'Interaction and motion',
        evidenceType: 'Inferred',
        confidence: 'medium',
        content: '动效只解释因果：捕获、归类、验证和导出。时长 120–240ms；进入 ease-out，移动 ease-in-out。系统偏好 reduced motion 时取消位移与循环扫描。',
      },
      {
        id: 'accessibility',
        title: 'Accessibility and performance',
        evidenceType: 'Computed',
        confidence: 'high',
        content: '正文对比度至少 4.5:1；所有操作可键盘到达并有清晰 focus-visible；颜色之外必须同时使用文字或图形表达状态；Canvas 提供可读替代说明。',
      },
      {
        id: 'negative-constraints',
        title: 'Negative constraints',
        evidenceType: 'User',
        confidence: 'high',
        content: '不要紫色渐变、玻璃拟态、霓虹 AI 风、巨大无意义圆角、满屏阴影、居中堆叠的 SaaS 模板、通用占位文案或未经验证的“像素级完美”声明。',
      },
      {
        id: 'unknown-handling',
        title: 'Unknown-handling rules',
        evidenceType: 'Unknown',
        confidence: 'high',
        content: '证据不足时明确写“未观察”，不要发明精确数值。字体不可用时选择字面宽度和 x-height 接近的开源替代，并在交付说明中记录替换。',
      },
      {
        id: 'acceptance-checklist',
        title: 'Acceptance checklist',
        evidenceType: 'Observed',
        confidence: 'high',
        content: '在 1440×960、1024×768、390×844 三个视口检查布局。验证主次文字、颜色语义、4/8/14px 圆角、键盘焦点、缩减动效和来源标签。生成预览不得复用来源品牌资产。',
      },
      {
        id: 'iteration-protocol',
        title: 'Iteration protocol',
        evidenceType: 'Computed',
        confidence: 'high',
        content: '先校正页面拓扑与主要容器，再处理排版换行、间距、素材裁切、颜色效果和动效。每轮只修复最高影响误差，并回归全部视口，避免修好桌面却破坏移动端。',
      },
    ],
    useNow: [
      '创建一个编辑式知识工作台，视觉隐喻是“可追溯的证据账本”。',
      '使用暖纸画布 #F4F1E8、工作面 #FFFEFA、文字 #191A17、交互钴蓝 #3157F5；证据标记 #DDF45A 只用于小面积高亮。',
      '保持 4px 间距基准与 4/8/14px 圆角层级，以细边框和排版建立结构，避免玻璃拟态、紫色渐变和模板化三列卡片。',
      '桌面采用非对称网格，760px 以下变为单栏页签。所有交互支持键盘焦点与 reduced motion。',
      '仅复用视觉语言，不复制来源品牌、文案、图像、标志或专有图标。未知规则必须标记，禁止伪造像素级精度。',
    ].join('\n\n'),
    validation: {
      sourceLabel: '参考：编辑式知识页面',
      resultLabel: '验证：中性组件样板',
      note: '此处验证设计规则是否形成目标气质，不声称是目标页面的重建结果。',
      checks: [
        { label: '颜色角色', status: 'pass', detail: '9 个 token 已应用' },
        { label: '排版层级', status: 'pass', detail: '5 级节奏稳定' },
        { label: '响应式', status: 'review', detail: '需要移动端证据' },
        { label: '品牌资产', status: 'pass', detail: '未复用来源内容' },
      ],
    },
  };
});
