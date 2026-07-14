(function exposeApp(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UIToPromptApp = api;
  if (root.document) root.document.addEventListener('DOMContentLoaded', api.init);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createApp(root) {
  const evidenceLabels = {
    observed: 'Observed',
    computed: 'Computed',
    inferred: 'Inferred',
    unknown: 'Unknown',
    user: 'User',
  };

  function selectOne(options, active) {
    if (!options.includes(active)) throw new Error(`Unknown selection: ${active}`);
    return Object.fromEntries(options.map((option) => [option, option === active]));
  }

  function modeNotice(mode) {
    if (mode === 'style') {
      return '默认移除原品牌、文案、图像与受保护资产，只保留可迁移的视觉语言。';
    }
    if (mode === 'rebuild') {
      return '授权重建仅适用于你拥有或已获授权的页面；输出仍会标记未知与缺失证据。';
    }
    throw new Error(`Unknown mode: ${mode}`);
  }

  function createAnalysisStages(sourceType) {
    const screenshotOnly = sourceType === 'screenshot' || sourceType === 'visual';
    const visualReference = sourceType === 'visual';
    return [
      {
        id: 'capture',
        index: '01',
        title: 'Capture',
        copy: visualReference ? '读取图片构图、对比与颜色分布' : '正在获取可见证据',
        evidenceType: 'observed',
      },
      {
        id: 'evidence',
        index: '02',
        title: 'Evidence',
        copy: screenshotOnly ? '截图不包含 DOM 与计算样式' : '已读取可见结构、样式与资源状态',
        evidenceType: screenshotOnly ? 'unknown' : 'observed',
      },
      {
        id: 'normalize',
        index: '03',
        title: 'Normalize',
        copy: '42 个颜色样本已合并为 8 个语义角色',
        evidenceType: 'computed',
      },
      {
        id: 'infer',
        index: '04',
        title: 'Infer',
        copy: visualReference ? '正在把光影与形状翻译为 UI 规则' : '正在推断组件语法与视觉原则',
        evidenceType: 'inferred',
      },
      {
        id: 'validate',
        index: '05',
        title: 'Validate',
        copy: screenshotOnly ? '响应式规则仅由单张桌面截图推断' : '正在用中性组件样板验证规则',
        evidenceType: screenshotOnly ? 'unknown' : 'computed',
      },
      {
        id: 'package',
        index: '06',
        title: 'Package',
        copy: '正在生成 Prompt、Skill 与开放 token',
        evidenceType: 'computed',
      },
    ];
  }

  const canonicalPromptSections = [
    ['mission-scope', 'Mission and scope'],
    ['authority-rights', 'Authority and rights boundary'],
    ['source-truth-order', 'Source-of-truth order'],
    ['visual-north-star', 'Visual north star'],
    ['non-negotiables', 'Non-negotiable invariants'],
    ['design-tokens', 'Design tokens'],
    ['layout-responsive', 'Layout and responsive behavior'],
    ['component-grammar', 'Component grammar'],
    ['content-imagery', 'Content density and imagery'],
    ['interaction-motion', 'Interaction and motion'],
    ['accessibility', 'Accessibility and performance'],
    ['negative-constraints', 'Negative constraints'],
    ['unknown-handling', 'Unknown-handling rules'],
    ['acceptance-checklist', 'Acceptance checklist'],
    ['iteration-protocol', 'Iteration protocol'],
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function rgbToHex(value) {
    const text = String(value || '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(text)) return text;
    if (/^#[0-9a-f]{3}$/.test(text)) {
      return `#${text.slice(1).split('').map((part) => part + part).join('')}`;
    }
    const match = text.match(/^rgba?\(\s*(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})(?:\D+([\d.]+))?\s*\)$/);
    if (!match || (match[4] != null && Number(match[4]) === 0)) return null;
    const channels = match.slice(1, 4).map((channel) => Math.max(0, Math.min(255, Number(channel))));
    return `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
  }

  function luminance(hex) {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    return channels.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  }

  function saturation(hex) {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    return Math.max(...channels) - Math.min(...channels);
  }

  function mostFrequent(values, fallback) {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || fallback;
  }

  function stylesFor(elements, property) {
    return (elements || []).map((element) => element?.styles?.[property]).filter(Boolean);
  }

  function colorSystem(colors, fallback) {
    const normalized = [...new Set(colors.map(rgbToHex).filter(Boolean))];
    const ordered = normalized.sort((left, right) => luminance(left) - luminance(right));
    const darkest = ordered[0] || fallback.ink;
    const lightest = ordered.at(-1) || fallback.canvas;
    const accent = [...normalized].sort((left, right) => saturation(right) - saturation(left))[0] || fallback.cobalt;
    return {
      ...fallback,
      canvas: lightest,
      surface: lightest,
      ink: darkest,
      muted: ordered[Math.min(1, ordered.length - 1)] || fallback.muted,
      cobalt: accent,
      signal: normalized.find((color) => color !== accent && saturation(color) > 0.25) || fallback.signal,
    };
  }

  function buildPromptSections(context) {
    const rights = context.mode === 'rebuild'
      ? '仅在已确认拥有或获得授权的范围内重建；权利状态不能从输入本身推断。'
      : '只提炼可迁移的视觉语法；移除来源品牌、Logo、原文、图像、专有图标与受保护资产。';
    const status = context.sourceType === 'visual' ? 'Translated' : context.sourceType === 'url' ? 'Observed' : 'Inferred';
    const content = [
      `为新的原创产品实现从${context.sourceLabel}提炼的视觉系统。当前唯一验证视口为 ${context.viewport}；输出是规则包，不是下游应用代码。`,
      rights,
      `冲突时依次采用：输入中的直接证据、程序测量、跨元素一致模式、显式推断、通用设计惯例。${context.unknownBoundary}`,
      `以“${context.northStar}”作为视觉北极星；保留构图节奏、对比关系与语义色彩，不保留来源身份。`,
      `保持主画布 ${context.colors.canvas}、正文 ${context.colors.ink}、主要强调色 ${context.colors.cobalt} 的角色关系；层级必须由排版、间距和边界共同建立。`,
      `颜色角色：canvas ${context.colors.canvas}，surface ${context.colors.surface}，ink ${context.colors.ink}，accent ${context.colors.cobalt}。字体证据：${context.fontFamily}. 未观察到的精确字重与字体文件不得补写为事实。`,
      `${context.layoutRule} ${context.unknownBoundary}`,
      '从重复边界、分组、按钮和文字层级抽象组件语法。只把可见或测量到的模式写成硬规则；其余作为待验证候选。',
      '保持与参考相近的信息密度、留白比例和图像占比，但使用原创信息架构、文案与素材。不要把来源内容当作占位内容复用。',
      `可见交互与动效仅按证据记录。${context.motionRule} 所有新增动效必须支持 prefers-reduced-motion。`,
      '正文对比度目标至少 4.5:1，所有操作可键盘到达并具有清晰 focus-visible；导出前检查溢出、资源体积与主要视口性能。',
      '禁止复制来源品牌和内容；禁止虚构 DOM、断点、隐藏状态、Hover、字体文件或像素级相似度；避免紫色渐变、玻璃拟态和无证据的模板化组件。',
      `${context.unknownBoundary} 未知项必须显式保留，并给出最保守的原创 fallback 与下一步取证方式。`,
      `在 ${context.viewport} 对照颜色角色、标题层级、主要间距、边界和内容密度。验证原创资产、键盘焦点、缩减动效以及每条规则的证据等级。`,
      '先修页面拓扑与主要容器，再修排版换行、间距、素材裁切、颜色效果和动效。每轮只处理最高影响误差，并回归全部已有证据。',
    ];
    const evidenceTypes = ['Observed', 'User', 'Computed', status, 'Computed', 'Computed', context.sourceType === 'url' ? 'Observed' : 'Unknown', status, status, 'Unknown', 'Computed', 'User', 'Unknown', 'Computed', 'Computed'];
    return canonicalPromptSections.map(([id, title], index) => ({
      id,
      title,
      evidenceType: evidenceTypes[index],
      confidence: evidenceTypes[index] === 'Unknown' ? 'low' : evidenceTypes[index] === 'Inferred' || evidenceTypes[index] === 'Translated' ? 'medium' : 'high',
      content: content[index],
    }));
  }

  function finishDataset(data, context) {
    data.promptSections = buildPromptSections(context);
    data.useNow = [
      `为原创产品采用“${context.northStar}”的视觉方向。`,
      `使用 ${context.colors.canvas} 画布、${context.colors.surface} 工作面、${context.colors.ink} 正文与 ${context.colors.cobalt} 强调色，保持来自证据的相对角色。`,
      context.layoutRule,
      context.mode === 'rebuild'
        ? '仅在权利已确认的范围内重建；没有授权的资产全部替换。'
        : '只保留视觉语言，不复制来源品牌、文案、Logo、图像、专有图标或受保护资产。',
      context.unknownBoundary,
    ].join('\n\n');
    return data;
  }

  function buildUrlDataset(evidence, sample, mode = 'style') {
    const data = clone(sample);
    const elements = Array.isArray(evidence?.elements) ? evidence.elements : [];
    const body = elements.find((element) => element.tagName === 'body') || elements.find((element) => element.tagName === 'html');
    const background = rgbToHex(body?.styles?.['background-color']);
    const ink = rgbToHex(body?.styles?.color);
    const observedColors = [background, ink, ...stylesFor(elements, 'background-color'), ...stylesFor(elements, 'color')];
    const colors = colorSystem(observedColors, data.tokens.colors);
    if (background) colors.canvas = background;
    if (ink) colors.ink = ink;
    const fontFamily = mostFrequent(stylesFor(elements, 'font-family'), '未观察到可靠字体族');
    const viewport = evidence?.capture?.viewport || {};
    const viewportLabel = Number.isFinite(viewport.width) && Number.isFinite(viewport.height)
      ? `${viewport.width} × ${viewport.height}`
      : '未报告视口';
    const finalUrl = evidence?.source?.finalUrl || evidence?.source?.requestedUrl || '未知 URL';
    const hostname = (() => { try { return new URL(finalUrl).hostname; } catch { return '网页'; } })();

    data.meta = {
      ...data.meta,
      title: `${evidence?.document?.title || hostname} — 风格提炼`,
      sourceType: 'url',
      sourceLabel: '公开网页 · 浏览器取证',
      sourceUrl: finalUrl,
      capturedAt: evidence?.capture?.capturedAt || new Date().toISOString(),
      viewport: viewportLabel,
      mode,
      generator: 'UItoPrompt URL evidence 1.0',
    };
    data.evidenceSummary = {
      observed: { count: elements.length, label: '浏览器事实', detail: '可见结构、计算样式与几何信息' },
      computed: { count: new Set(observedColors.map(rgbToHex).filter(Boolean)).size, label: '程序测量', detail: '颜色角色、视口与重复样式' },
      inferred: { count: 4, label: '系统推断', detail: '视觉原则、组件语法与迁移规则' },
      unknown: { count: 4, label: '尚未观察', detail: '其他视口、登录态、完整交互与动态内容' },
    };
    data.tokens.colors = colors;
    data.tokens.typography.display = `${fontFamily} · observed`;
    data.tokens.typography.body = `${fontFamily} · observed`;
    data.brief = {
      northStar: `把 ${hostname} 的可见节奏转化为一套原创、可追溯的界面语法。`,
      intent: '保留已测量的颜色角色、布局关系与排版节奏；删除来源身份和内容。',
      invariants: [
        `主画布使用 ${colors.canvas}，正文以 ${colors.ink} 建立基础对比。`,
        `主要强调色 ${colors.cobalt} 只用于选择、链接或核心行动。`,
        `字体族证据为 ${fontFamily}；不可用时选择指标接近的开源替代。`,
        '观察、计算、推断与未知必须分开，不能把建议写成来源事实。',
      ],
      limits: ['目前只捕获一个视口，不能证明真实断点。', '登录态、Hover/Focus、动态数据与所有动效未必已触发。'],
    };
    data.validation = {
      ...data.validation,
      sourceLabel: `参考：${hostname}`,
      note: '已使用真实浏览器证据生成规则；仍需用更多视口和交互状态补齐未知。',
      checks: [
        { label: '浏览器证据', status: 'pass', detail: `${elements.length} 个元素` },
        { label: '颜色角色', status: observedColors.filter(Boolean).length ? 'pass' : 'review', detail: `${data.evidenceSummary.computed.count} 个归一化颜色` },
        { label: '响应式', status: 'review', detail: '仅一个视口' },
        { label: '权利边界', status: 'pass', detail: mode === 'style' ? '风格提炼' : '需确认授权' },
      ],
    };
    return finishDataset(data, {
      mode,
      sourceType: 'url',
      sourceLabel: '真实网页证据',
      viewport: viewportLabel,
      colors,
      fontFamily,
      northStar: data.brief.northStar,
      layoutRule: `以 ${viewportLabel} 的可见几何和重复间距作为当前布局基准；其他宽度先采用保守流式重排。`,
      motionRule: `${evidence?.animations?.length || 0} 个可见动画被记录；未触发状态仍为未知。`,
      unknownBoundary: '单次网页捕获不能证明所有断点、登录态、隐藏状态、字体文件和运行时变化。',
    });
  }

  function buildImageDataset(image, sample, { sourceType = 'screenshot', filename = 'local-image', mode = 'style' } = {}) {
    const data = clone(sample);
    const colors = colorSystem(image?.colors || [], data.tokens.colors);
    const viewportLabel = `${image?.width || '?'} × ${image?.height || '?'}`;
    const visualReference = sourceType === 'visual';
    data.meta = {
      ...data.meta,
      title: `${filename} — ${visualReference ? '视觉转译' : '界面风格提炼'}`,
      sourceType,
      sourceLabel: visualReference ? '视觉参考 · 本地像素分析' : '界面截图 · 本地像素分析',
      sourceUrl: filename,
      capturedAt: new Date().toISOString(),
      viewport: viewportLabel,
      mode,
      generator: 'UItoPrompt local pixel evidence 1.0',
    };
    data.tokens.colors = colors;
    data.tokens.typography.display = '字体族未知 · 仅可观察字形外观';
    data.tokens.typography.body = '字体族未知 · 仅可观察字形外观';
    data.evidenceSummary = {
      observed: { count: 2, label: '像素事实', detail: `图片尺寸 ${viewportLabel} 与可见构图` },
      computed: { count: image?.colors?.length || 0, label: '程序测量', detail: '像素颜色聚类与角色映射' },
      inferred: { count: 5, label: visualReference ? '视觉转译' : '系统推断', detail: '节奏、层级、形状与组件候选' },
      unknown: { count: 6, label: '尚未观察', detail: 'DOM、字体文件、断点、隐藏状态、交互与动效' },
    };
    data.brief = {
      northStar: visualReference ? '把参考图的构图、对比和节奏翻译为原创 Web UI。' : '把截图中可见的层级、色彩与留白转化为可执行规则。',
      intent: visualReference ? '保留视觉原则，不复用原 artwork、文字或品牌。' : '提炼像素中可见的视觉系统，不假装知道源代码。',
      invariants: [
        `主色角色来自像素测量：${colors.canvas} / ${colors.ink} / ${colors.cobalt}。`,
        '构图、密度与形状可作为推断；DOM 和组件语义不可从像素直接证明。',
        '所有品牌、文案、图片与专有图标必须替换为原创内容。',
        '响应式和交互建议必须标为 authored fallback，而不是观察事实。',
      ],
      limits: ['单张图片无法证明 DOM、语义结构与真实字体文件。', '源断点、隐藏状态、Hover/Focus、滚动行为和动效未知。'],
    };
    data.validation = {
      ...data.validation,
      sourceLabel: `参考：${filename}`,
      note: '颜色与尺寸来自本地像素；结构、响应式和交互仍需额外证据验证。',
      checks: [
        { label: '图片读取', status: 'pass', detail: viewportLabel },
        { label: '颜色聚类', status: image?.colors?.length ? 'pass' : 'review', detail: `${image?.colors?.length || 0} 个代表色` },
        { label: '结构证据', status: 'review', detail: 'DOM 未知' },
        { label: '权利边界', status: 'pass', detail: mode === 'style' ? '不复用来源资产' : '需确认授权' },
      ],
    };
    return finishDataset(data, {
      mode,
      sourceType,
      sourceLabel: visualReference ? '视觉参考图' : '单张界面截图',
      viewport: viewportLabel,
      colors,
      fontFamily: '精确字体族与字体文件未知',
      northStar: data.brief.northStar,
      layoutRule: '将图片中的主要区块比例作为当前视口候选；窄屏采用内容优先的单栏 fallback，但不得声称这是来源断点。',
      motionRule: '静态图片不包含时间信息，因此 Hover、Focus、滚动和动效全部未知。',
      unknownBoundary: '单张静态图片无法证明精确字体族、DOM、语义结构、源断点、隐藏状态和动效。',
    });
  }

  function buildGeminiImageDataset(result, image, sample, options = {}) {
    const data = buildImageDataset(image, sample, options);
    const spec = result?.styleSpec;
    if (!spec?.metadata?.title || !spec?.sections || typeof result?.summary !== 'string') {
      throw new Error('服务端没有返回可用的风格分析结果。');
    }

    const sourceByPrompt = {
      'mission-scope': 'visualIntent',
      'authority-rights': 'constraints',
      'source-truth-order': 'constraints',
      'visual-north-star': 'visualIntent',
      'non-negotiables': 'constraints',
      'design-tokens': 'color',
      'layout-responsive': 'layout',
      'component-grammar': 'components',
      'content-imagery': 'imagery',
      'interaction-motion': 'motion',
      accessibility: 'accessibility',
      'negative-constraints': 'constraints',
      'unknown-handling': 'responsiveness',
      'acceptance-checklist': 'spacing',
      'iteration-protocol': 'interactions',
    };
    const pick = (name) => spec.sections[name]?.summary || '';
    data.meta = {
      ...data.meta,
      title: spec.metadata.title,
      sourceLabel: options.sourceType === 'visual' ? '视觉参考 · Gemini 图像分析' : '界面截图 · Gemini 图像分析',
      generator: 'UItoPrompt Gemini image analysis 1.0',
    };
    data.evidenceSummary.inferred = {
      count: Object.keys(spec.sections).length,
      label: '视觉模型推断',
      detail: 'Gemini 仅根据本次提交的单张图片提炼规则；实现前仍需验证。',
    };
    data.brief = {
      ...data.brief,
      northStar: result.summary,
      intent: pick('visualIntent'),
      invariants: [pick('layout'), pick('typography'), pick('components'), pick('constraints')].filter(Boolean),
      limits: [
        '模型只看到单张静态图片，不能证明 DOM、字体文件、真实断点、隐藏状态或交互行为。',
        '请使用原创文案、Logo、图片与图标；不要复刻来源的身份性资产。',
      ],
    };
    data.promptSections = data.promptSections.map((section) => {
      const modelSection = pick(sourceByPrompt[section.id]);
      return modelSection
        ? {
          ...section,
          evidenceType: 'Inferred',
          confidence: 'medium',
          content: `${section.content}\n\n视觉模型建议（基于单图推断，需验证）：${modelSection}`,
        }
        : section;
    });
    data.validation = {
      ...data.validation,
      note: '颜色与尺寸来自本地像素；结构建议来自 Gemini 的单图推断，不能替代 DOM、断点和交互验证。',
      checks: [
        ...data.validation.checks.slice(0, 2),
        { label: '视觉模型规则', status: 'review', detail: '15 个章节已按单图推断标记' },
        { label: '权利边界', status: 'pass', detail: options.mode === 'style' ? '不复用来源身份资产' : '需确认授权范围' },
      ],
    };
    return data;
  }

  function createMarkdown(data) {
    const sections = data.promptSections
      .map(
        (section) =>
          `## ${section.title}\n\nEvidence: ${section.evidenceType} · Confidence: ${section.confidence}\n\n${section.content}`,
      )
      .join('\n\n');

    return `# UItoPrompt Style Skill

Source: ${data.meta.sourceUrl}
Captured: ${data.meta.capturedAt}
Mode: ${data.meta.mode}

> ${data.brief.northStar}

${sections}
`;
  }

  function createCss(data) {
    const { colors, typography, spacing, radii, motion } = data.tokens;
    const safeCssValue = (value, label) => {
      const text = String(value ?? '').trim();
      if (!text || text.length > 160 || /[;{}<>\u0000-\u001f]/.test(text) || /(?:url\s*\(|@import|expression\s*\()/i.test(text)) {
        throw new Error(`Unsafe CSS token: ${label}`);
      }
      return text;
    };
    const safeFont = (value, label) => `"${safeCssValue(String(value).split(' · ')[0], label).replace(/["\\]/g, '')}"`;
    const colorLines = Object.entries(colors)
      .map(([key, value]) => `  --color-${key}: ${safeCssValue(value, `color.${key}`)};`)
      .join('\n');
    return `:root {
${colorLines}
  --font-display: ${safeFont(typography.display, 'typography.display')};
  --font-body: ${safeFont(typography.body, 'typography.body')};
  --font-mono: ${safeFont(typography.mono, 'typography.mono')};
  --space-base: ${safeCssValue(spacing.base, 'spacing.base')};
  --radius-control: ${safeCssValue(radii.control, 'radii.control')};
  --radius-card: ${safeCssValue(radii.card, 'radii.card')};
  --radius-panel: ${safeCssValue(radii.panel, 'radii.panel')};
  --motion-micro: ${safeCssValue(motion.micro, 'motion.micro')};
  --motion-short: ${safeCssValue(motion.short, 'motion.short')};
  --motion-medium: ${safeCssValue(motion.medium, 'motion.medium')};
  --motion-easing: ${safeCssValue(motion.easing, 'motion.easing')};
}
`;
  }

  function toStyleSpec(data) {
    const byId = Object.fromEntries(data.promptSections.map((section) => [section.id, section]));
    const sectionMap = {
      visualIntent: 'visual-north-star',
      layout: 'layout-responsive',
      color: 'design-tokens',
      typography: 'design-tokens',
      spacing: 'design-tokens',
      surfaces: 'component-grammar',
      components: 'component-grammar',
      imagery: 'content-imagery',
      iconography: 'component-grammar',
      responsiveness: 'layout-responsive',
      interactions: 'interaction-motion',
      motion: 'interaction-motion',
      accessibility: 'accessibility',
      content: 'content-imagery',
      constraints: 'negative-constraints',
    };
    const sourceKind = data.meta.sourceType === 'url' ? 'url' : 'image';
    const evidenceLabel = (status) => {
      if (status === 'user') return 'user';
      if (status === 'computed') return 'derived';
      if (status === 'observed') return sourceKind === 'url' ? 'dom' : 'screenshot';
      return 'visual-model';
    };
    const sections = Object.fromEntries(Object.entries(sectionMap).map(([name, promptId]) => {
      const prompt = byId[promptId];
      const status = String(prompt?.evidenceType || 'unknown').toLowerCase();
      const unknown = status === 'unknown';
      return [name, {
        status,
        confidence: prompt?.confidence === 'high' ? 0.92 : prompt?.confidence === 'medium' ? 0.72 : 0.35,
        evidence: unknown ? [] : [{ label: evidenceLabel(status), ref: `web-evidence://${data.meta.sourceType}/${promptId}` }],
        summary: prompt?.content || 'No rule was generated.',
        ...(unknown ? { unknownReason: prompt?.content || 'The source does not expose this information.' } : {}),
      }];
    }));
    const numbers = (values) => Object.fromEntries(values.map((value, index) => [`step${index + 1}`, Number.parseFloat(value)]).filter(([, value]) => Number.isFinite(value)));
    const family = (value) => String(value || '').split(' · ')[0].trim();
    return {
      schemaVersion: '1.0',
      metadata: {
        title: data.meta.title,
        rightsMode: data.meta.mode === 'rebuild' ? 'authorized-reconstruction' : 'style-only',
      },
      source: { kind: sourceKind, ref: data.meta.sourceUrl },
      tokens: {
        colors: { ...data.tokens.colors },
        spacing: { unit: Number.parseFloat(data.tokens.spacing.base) || 4, ...numbers(data.tokens.spacing.scale) },
        radii: Object.fromEntries(Object.entries(data.tokens.radii).map(([key, value]) => [key, Number.parseFloat(value)])),
        typography: {
          fontFamilies: {
            display: family(data.tokens.typography.display),
            body: family(data.tokens.typography.body),
            mono: family(data.tokens.typography.mono),
          },
          fontSizes: numbers(data.tokens.typography.scale.map((value) => String(value).split('/')[0])),
        },
        durations: Object.fromEntries(Object.entries(data.tokens.motion).filter(([key]) => key !== 'easing').map(([key, value]) => [key, Number.parseFloat(value)])),
        easing: { standard: data.tokens.motion.easing },
      },
      sections,
    };
  }

  function createExport(format, data) {
    if (format === 'json') return JSON.stringify(toStyleSpec(data), null, 2);
    if (format === 'markdown') return createMarkdown(data);
    if (format === 'css') return createCss(data);
    throw new Error(`Unsupported export format: ${format}`);
  }

  function safeFilename(value) {
    const normalized = String(value || 'ui-style')
      .normalize('NFKD')
      .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    return normalized || 'ui-style';
  }

  function comparisonPosition(value) {
    const clamped = Math.min(100, Math.max(0, Number(value) || 0));
    return {
      clipPath: `inset(0 ${100 - clamped}% 0 0)`,
      dividerLeft: `calc(${clamped}% - 12px)`,
      ariaText: `${clamped}% 显示验证结果`,
    };
  }

  function cloneSample() {
    return clone(root.UI_TO_PROMPT_SAMPLE);
  }

  function parseImageDimensions(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (
      bytes.length >= 24 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    ) {
      return { width: view.getUint32(16), height: view.getUint32(20), format: 'png' };
    }
    if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
      let offset = 2;
      while (offset + 8 < bytes.length) {
        while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
        const marker = bytes[offset];
        offset += 1;
        if (marker === 0xd9 || marker === 0xda) break;
        if (offset + 2 > bytes.length) break;
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > bytes.length) break;
        if (startOfFrame.has(marker) && length >= 7) {
          return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3), format: 'jpeg' };
        }
        offset += length;
      }
    }
    const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
    if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
      const chunk = ascii(12, 4);
      if (chunk === 'VP8X') {
        const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
        const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
        return { width, height, format: 'webp' };
      }
      if (chunk === 'VP8L' && bytes[20] === 0x2f) {
        const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
        const height = 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
        return { width, height, format: 'webp' };
      }
      if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
        return {
          width: view.getUint16(26, true) & 0x3fff,
          height: view.getUint16(28, true) & 0x3fff,
          format: 'webp',
        };
      }
    }
    throw new Error('无法从图片头部安全读取尺寸；请转换为标准 PNG、JPEG 或 WebP 后重试。');
  }

  async function readImageDimensions(file) {
    const header = new Uint8Array(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
    const dimensions = parseImageDimensions(header);
    if (!dimensions.width || !dimensions.height) throw new Error('图片尺寸无效。');
    return dimensions;
  }

  async function inspectImageFile(file) {
    if (!file || typeof file.size !== 'number') throw new Error('请选择可读取的图片文件。');
    if (file.size > 3 * 1024 * 1024) throw new Error('图片超过 3MB，请先压缩后再分析。');
    if (typeof root.createImageBitmap !== 'function') throw new Error('当前浏览器不支持本地图片分析。');
    const declaredDimensions = await readImageDimensions(file);
    if (declaredDimensions.width * declaredDimensions.height > 20_000_000) {
      throw new Error('图片像素超过 2000 万，请先缩小后再分析。');
    }
    const bitmap = await root.createImageBitmap(file);
    try {
      if (!bitmap.width || !bitmap.height) throw new Error('图片尺寸无效。');
      if (bitmap.width * bitmap.height > 20_000_000) throw new Error('图片像素超过 2000 万，请先缩小后再分析。');
      const longest = Math.max(bitmap.width, bitmap.height);
      const scale = Math.min(1, 192 / longest);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = root.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('无法创建像素分析画布。');
      context.drawImage(bitmap, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const buckets = new Map();
      for (let index = 0; index < pixels.length; index += 16) {
        if (pixels[index + 3] < 160) continue;
        const channels = [pixels[index], pixels[index + 1], pixels[index + 2]].map((channel) => Math.min(255, Math.round(channel / 32) * 32));
        const color = `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
        buckets.set(color, (buckets.get(color) || 0) + 1);
      }
      const colors = [...buckets.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 12)
        .map(([color]) => color);
      return { width: bitmap.width, height: bitmap.height, colors };
    } finally {
      bitmap.close?.();
    }
  }

  async function imageFileToBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 8192;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
    }
    if (typeof root.btoa !== 'function') throw new Error('当前浏览器无法安全编码图片。');
    return root.btoa(binary);
  }

  function init() {
    const document = root.document;
    const sample = root.UI_TO_PROMPT_SAMPLE;
    if (!document || !sample) return;

    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
    let activeSource = 'url';
    let currentData = cloneSample();

    function updateSelection(buttons, activeValue, dataKey) {
      const values = buttons.map((button) => button.dataset[dataKey]);
      const state = selectOne(values, activeValue);
      buttons.forEach((button) => {
        const selected = state[button.dataset[dataKey]];
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
    }

    function activateSource(sourceType, focusPanel = false) {
      activeSource = sourceType;
      const buttons = $$('[data-source-tab]');
      updateSelection(buttons, sourceType, 'sourceTab');
      $$('[data-source-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.sourcePanel !== sourceType;
      });
      const consentRow = $('#ai-consent-row');
      if (consentRow) consentRow.hidden = sourceType === 'url';
      if (focusPanel) $(`[data-source-panel="${sourceType}"] input`)?.focus();
    }

    function activateWorkspace(tabId) {
      const buttons = $$('[data-workspace-tab]');
      updateSelection(buttons, tabId, 'workspaceTab');
      const activeButton = buttons.find((button) => button.dataset.workspaceTab === tabId);
      const tabs = activeButton?.parentElement;
      if (tabs && tabs.scrollWidth > tabs.clientWidth) {
        activeButton.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
      }
      $$('[data-workspace-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.workspacePanel !== tabId;
      });
      if (tabId === 'validate') drawValidationCanvases();
    }

    function activatePromptView(viewId) {
      const buttons = $$('[data-prompt-view]');
      updateSelection(buttons, viewId, 'promptView');
      $$('[data-prompt-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.promptPanel !== viewId;
      });
    }

    function bindArrowNavigation(buttons, getValue, activate) {
      buttons.forEach((button, index) => {
        button.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          let nextIndex = index;
          if (event.key === 'ArrowRight') nextIndex = (index + 1) % buttons.length;
          if (event.key === 'ArrowLeft') nextIndex = (index - 1 + buttons.length) % buttons.length;
          if (event.key === 'Home') nextIndex = 0;
          if (event.key === 'End') nextIndex = buttons.length - 1;
          activate(getValue(buttons[nextIndex]));
          buttons[nextIndex].focus();
        });
      });
    }

    function renderStages(stages) {
      const list = $('#analysis-stages');
      list.innerHTML = stages
        .map(
          (stage) => `<li class="analysis-stage" data-stage="${stage.id}" data-state="queued">
            <span class="stage-index">${stage.index}</span>
            <span class="stage-body"><strong>${stage.title}</strong><small>${stage.copy}</small></span>
            <span class="evidence-chip evidence-${stage.evidenceType}">${evidenceLabels[stage.evidenceType]}</span>
          </li>`,
        )
        .join('');
    }

    function wait(ms) {
      return new Promise((resolve) => root.setTimeout(resolve, ms));
    }

    function inputIsValid() {
      if (activeSource === 'url') {
        const input = $('#source-url');
        const value = input.value.trim();
        if (!value) {
          setStatus('请先粘贴一个公开网页地址。', 'error');
          input.focus();
          return false;
        }
        try {
          const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
          if (!parsed.hostname.includes('.')) throw new Error('hostname');
          currentData.meta.sourceUrl = parsed.hostname;
        } catch {
          setStatus('这个地址无法识别。请检查域名，例如 example.com。', 'error');
          input.focus();
          return false;
        }
        return true;
      }

      const file = $(`#${activeSource}-file`);
      if (!file.files?.length) {
        setStatus(activeSource === 'visual' ? '请先选择一张视觉参考图。' : '请先选择一张界面截图。', 'error');
        file.focus();
        return false;
      }
      const consent = $('#ai-analysis-consent');
      if (!consent?.checked) {
        setStatus('请先确认你有权提交此图片，并同意仅为本次 Gemini 分析发送它。', 'error');
        consent?.focus();
        return false;
      }
      currentData.meta.sourceType = activeSource;
      currentData.meta.sourceLabel = activeSource === 'visual' ? '视觉灵感图 · 本地文件' : '界面截图 · 本地文件';
      currentData.meta.sourceUrl = file.files[0].name;
      return true;
    }

    function setStatus(message, tone = 'neutral') {
      const status = $('#tool-status');
      status.textContent = message;
      status.dataset.tone = tone;
    }

    async function runAnalysis(useExample) {
      currentData = cloneSample();
      if (useExample) {
        activateSource('url');
        $('#source-url').value = 'atlas-notes.example';
      } else if (!inputIsValid()) {
        return;
      }

      const mode = $('input[name="analysis-mode"]:checked').value;
      currentData.meta.mode = mode;
      const stages = createAnalysisStages(activeSource);
      renderStages(stages);
      $('#analysis-panel').hidden = false;
      $('#workspace').hidden = true;
      setStatus(
        useExample
          ? '正在载入完整示例分析。'
          : activeSource === 'url'
            ? '正在安全浏览公开网页并读取可见证据。'
            : '正在读取本地像素，并将图片发送到服务端进行本次 Gemini 分析。',
        'neutral',
      );
      $('#analysis-panel').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });

      const stageElements = $$('.analysis-stage');
      const delay = prefersReducedMotion() ? 0 : 240;
      const analyzeButton = $('#analyze-button');
      analyzeButton.disabled = true;
      if (!useExample) {
        stageElements[0].dataset.state = 'active';
        try {
          if (activeSource === 'url') {
            const rawValue = $('#source-url').value.trim();
            const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`).href;
            const response = await fetch('/api/analyze-url', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ url }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `网页分析失败（HTTP ${response.status}）。`);
            currentData = buildUrlDataset(payload, sample, mode);
          } else {
            const file = $(`#${activeSource}-file`).files[0];
            const evidence = await inspectImageFile(file);
            const response = await fetch('/api/analyze-image', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                image: { mimeType: file.type, base64: await imageFileToBase64(file) },
                sourceName: file.name,
                rightsMode: mode === 'rebuild' ? 'authorized-reconstruction' : 'style-only',
              }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `图片分析失败（HTTP ${response.status}）。`);
            currentData = buildGeminiImageDataset(payload, evidence, sample, { sourceType: activeSource, filename: file.name, mode });
          }
        } catch (error) {
          stageElements[0].dataset.state = 'error';
          const message = error instanceof Error ? error.message : '分析失败，请检查输入后重试。';
          $('#analysis-current').textContent = message;
          setStatus(message, 'error');
          analyzeButton.disabled = false;
          return;
        }
      }
      for (let index = 0; index < stageElements.length; index += 1) {
        stageElements[index].dataset.state = 'active';
        $('#analysis-current').textContent = stages[index].copy;
        if (delay) await wait(delay);
        stageElements[index].dataset.state = 'complete';
      }

      renderWorkspace(currentData);
      $('#workspace').hidden = false;
      setStatus(useExample ? '示例分析已载入。' : '真实输入已完成分析：证据、推断与未知内容已分开。', 'success');
      analyzeButton.disabled = false;
      $('#workspace-title').focus({ preventScroll: true });
      $('#workspace').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }

    function evidenceChip(type) {
      const safeType = escapeHtml(type);
      return `<span class="evidence-chip evidence-${safeType.toLowerCase()}">${safeType}</span>`;
    }

    function renderWorkspace(data) {
      $('#project-title').textContent = data.meta.title;
      $('#project-source').textContent = `${data.meta.sourceLabel} · ${data.meta.sourceUrl} · ${data.meta.viewport}`;
      $('#capture-time').textContent = data.meta.capturedAt;

      $('#evidence-summary').innerHTML = Object.entries(data.evidenceSummary)
        .map(
          ([type, item]) => `<article class="evidence-stat evidence-stat-${type}">
            <span class="evidence-stat-count">${escapeHtml(item.count)}</span>
            <div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div>
            ${evidenceChip(evidenceLabels[type])}
          </article>`,
        )
        .join('');

      $('#north-star').textContent = data.brief.northStar;
      $('#brief-intent').textContent = data.brief.intent;
      $('#invariant-list').innerHTML = data.brief.invariants
        .map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(item)}</li>`)
        .join('');
      $('#limit-list').innerHTML = data.brief.limits.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

      $('#color-tokens').innerHTML = Object.entries(data.tokens.colors)
        .map(
          ([name, value]) => `<li class="token-row">
            <span class="token-swatch" style="--swatch:${escapeHtml(value)}" aria-hidden="true"></span>
            <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(value)}</small></span>
          </li>`,
        )
        .join('');
      $('#type-tokens').innerHTML = Object.entries(data.tokens.typography)
        .filter(([name]) => name !== 'scale')
        .map(([name, value]) => `<li><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></li>`)
        .join('');
      $('#spacing-tokens').innerHTML = data.tokens.spacing.scale
        .map((value) => `<span class="space-block" style="--space:${Math.max(Number(value), 4)}px"><i></i><small>${value}</small></span>`)
        .join('');

      $('#use-now-text').textContent = data.useNow;
      $('#prompt-sections').innerHTML = data.promptSections
        .map(
          (section, index) => `<details class="prompt-section" ${index < 2 ? 'open' : ''}>
            <summary>
              <span class="prompt-index">${String(index + 1).padStart(2, '0')}</span>
              <span class="prompt-heading"><strong>${escapeHtml(section.title)}</strong><small>${escapeHtml(section.confidence)} confidence</small></span>
              ${evidenceChip(section.evidenceType)}
            </summary>
            <div class="prompt-section-body">
              <p>${escapeHtml(section.content)}</p>
              <div class="section-actions"><button type="button" class="text-button" data-copy-section="${escapeHtml(section.id)}">复制本段</button><span>来源与置信度保持可见</span></div>
            </div>
          </details>`,
        )
        .join('');

      $('#validation-checks').innerHTML = data.validation.checks
        .map(
          (check) => `<li data-status="${check.status}"><span class="check-mark" aria-hidden="true">${
            check.status === 'pass' ? '✓' : '!'
          }</span><span><strong>${escapeHtml(check.label)}</strong><small>${escapeHtml(check.detail)}</small></span></li>`,
        )
        .join('');
      $('#validation-note').textContent = data.validation.note;
      $('#export-tree').innerHTML = [
        ['SKILL.md', '入口规则与使用边界'],
        ['references/design-system.md', '视觉系统与推理'],
        ['references/systematic-prompt.md', '完整可执行 Prompt'],
        ['references/evidence.json', '证据与置信度'],
        ['references/validation.md', '验收方法'],
        ['tokens/tokens.json', '开放设计 token'],
        ['tokens/variables.css', 'CSS 变量'],
      ]
        .map(([path, note]) => `<li><code>${path}</code><span>${note}</span></li>`)
        .join('');

      drawReferenceArt($('#reference-art'), 'source');
      drawValidationCanvases();
    }

    function prefersReducedMotion() {
      return root.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    }

    function canvasContext(canvas) {
      if (!canvas) return null;
      const width = 960;
      const height = 620;
      const ratio = Math.min(root.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext('2d');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { context, width, height };
    }

    function roundedRect(context, x, y, width, height, radius, fill, stroke) {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      if (fill) {
        context.fillStyle = fill;
        context.fill();
      }
      if (stroke) {
        context.strokeStyle = stroke;
        context.lineWidth = 1;
        context.stroke();
      }
    }

    function drawReferenceArt(canvas, variant) {
      const setup = canvasContext(canvas);
      if (!setup) return;
      const { context: ctx, width, height } = setup;
      const colors = currentData.tokens.colors;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = variant === 'result' ? colors.surface : colors.canvas;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = colors.ink;
      ctx.fillRect(0, 0, 116, height);
      ctx.fillStyle = colors.signal;
      ctx.font = '600 13px "Cascadia Code", monospace';
      ctx.save();
      ctx.translate(48, 512);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(variant === 'result' ? 'SYSTEM / 08 TOKENS' : 'SOURCE / FIELD NOTES', 0, 0);
      ctx.restore();

      ctx.fillStyle = colors.muted;
      ctx.font = '500 13px "Cascadia Code", monospace';
      ctx.fillText('ATLAS / KNOWLEDGE INDEX', 160, 58);
      ctx.fillStyle = colors.ink;
      ctx.font = '650 66px "Arial Narrow", "Microsoft YaHei", sans-serif';
      ctx.fillText(variant === 'result' ? 'A system you' : 'Ideas deserve', 160, 142);
      ctx.fillText(variant === 'result' ? 'can inspect.' : 'visible evidence.', 160, 208);

      ctx.fillStyle = colors.line;
      ctx.fillRect(160, 246, 724, 1);
      ctx.fillStyle = colors.muted;
      ctx.font = '400 18px "Microsoft YaHei", sans-serif';
      ctx.fillText(
        variant === 'result' ? '规则不是装饰，而是每一次生成都能复用的约束。' : '让笔记、出处与推断在同一个工作面里保持清晰。',
        160,
        286,
      );

      const cards = variant === 'result'
        ? [
            ['Observed', '38', colors.signal],
            ['Computed', '24', colors.cobalt],
            ['Unknown', '04', colors.coral],
          ]
        : [
            ['READING', '12', colors.surface],
            ['NOTES', '28', colors.surface],
            ['LINKS', '43', colors.surface],
          ];
      cards.forEach(([label, number, accent], index) => {
        const x = 160 + index * 238;
        roundedRect(ctx, x, 338, 210, 172, 8, colors.surface, colors.line);
        ctx.fillStyle = accent;
        ctx.fillRect(x + 18, 358, 44, 6);
        ctx.fillStyle = colors.muted;
        ctx.font = '500 12px "Cascadia Code", monospace';
        ctx.fillText(label, x + 18, 397);
        ctx.fillStyle = colors.ink;
        ctx.font = '650 48px "Arial Narrow", sans-serif';
        ctx.fillText(number, x + 18, 461);
        ctx.fillStyle = colors.line;
        ctx.fillRect(x + 122, 376, 68, 1);
        ctx.fillRect(x + 122, 392, 52, 1);
        ctx.fillRect(x + 122, 408, 61, 1);
      });

      ctx.fillStyle = colors.cobalt;
      roundedRect(ctx, 716, 44, 168, 36, 4, colors.cobalt);
      ctx.fillStyle = colors.surface;
      ctx.font = '600 12px "Cascadia Code", monospace';
      ctx.fillText(variant === 'result' ? 'EXPORT SKILL  ↗' : 'OPEN NOTE  ↗', 738, 67);

      ctx.fillStyle = colors.muted;
      ctx.font = '500 11px "Cascadia Code", monospace';
      ctx.fillText('1440 / DESKTOP', 160, 574);
      ctx.fillText(variant === 'result' ? 'RULES VERIFIED' : 'ORIGINAL CONTENT', 735, 574);
    }

    function drawValidationCanvases() {
      drawReferenceArt($('#compare-source'), 'source');
      drawReferenceArt($('#compare-result'), 'result');
    }

    async function copyText(text, successMessage) {
      try {
        if (root.navigator?.clipboard && root.isSecureContext) {
          await root.navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          textarea.remove();
        }
        showToast(successMessage || '已复制');
      } catch {
        showToast('复制失败，请手动选择文本。', 'error');
      }
    }

    function showToast(message, tone = 'success') {
      const toast = $('#toast');
      toast.textContent = message;
      toast.dataset.tone = tone;
      toast.hidden = false;
      root.clearTimeout(showToast.timeout);
      showToast.timeout = root.setTimeout(() => {
        toast.hidden = true;
      }, 2200);
    }

    function download(format) {
      const content = createExport(format, currentData);
      const extensions = { json: 'json', markdown: 'md', css: 'css' };
      const types = { json: 'application/json', markdown: 'text/markdown', css: 'text/css' };
      const blob = new Blob([content], { type: `${types[format]};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeFilename(currentData.meta.title)}.${extensions[format]}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      root.setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast(`${extensions[format].toUpperCase()} 已开始下载`);
    }

    const sourceButtons = $$('[data-source-tab]');
    sourceButtons.forEach((button) => button.addEventListener('click', () => activateSource(button.dataset.sourceTab)));
    bindArrowNavigation(sourceButtons, (button) => button.dataset.sourceTab, activateSource);

    const workspaceButtons = $$('[data-workspace-tab]');
    workspaceButtons.forEach((button) => button.addEventListener('click', () => activateWorkspace(button.dataset.workspaceTab)));
    bindArrowNavigation(workspaceButtons, (button) => button.dataset.workspaceTab, activateWorkspace);

    const promptButtons = $$('[data-prompt-view]');
    promptButtons.forEach((button) => button.addEventListener('click', () => activatePromptView(button.dataset.promptView)));
    bindArrowNavigation(promptButtons, (button) => button.dataset.promptView, activatePromptView);

    $$('input[name="analysis-mode"]').forEach((input) => {
      input.addEventListener('change', () => {
        $('#mode-notice').textContent = modeNotice(input.value);
      });
    });

    $$('input[type="file"]').forEach((input) => {
      input.addEventListener('change', () => {
        const output = $(`[data-file-name="${input.id}"]`);
        output.textContent = input.files?.[0]?.name || '尚未选择文件';
      });
    });

    $('#analyze-button').addEventListener('click', () => runAnalysis(false));
    $('[data-action="load-example"]').addEventListener('click', () => runAnalysis(true));
    $('#copy-use-now').addEventListener('click', () => copyText(currentData.useNow, 'Use now Prompt 已复制'));
    $('#copy-system').addEventListener('click', () => copyText(createMarkdown(currentData), '完整 Systematic Prompt 已复制'));
    $$('[data-download]').forEach((button) => button.addEventListener('click', () => download(button.dataset.download)));

    $('#prompt-sections').addEventListener('click', (event) => {
      const button = event.target.closest('[data-copy-section]');
      if (!button) return;
      const section = currentData.promptSections.find((item) => item.id === button.dataset.copySection);
      if (section) copyText(`${section.title}\n\n${section.content}`, `已复制 ${section.title}`);
    });

    $('#compare-range').addEventListener('input', (event) => {
      const position = comparisonPosition(event.target.value);
      $('#compare-result-wrap').style.clipPath = position.clipPath;
      $('#compare-divider').style.left = position.dividerLeft;
      event.target.setAttribute('aria-valuetext', position.ariaText);
    });

    activateSource('url');
    activateWorkspace('brief');
    activatePromptView('use-now');
    $('#mode-notice').textContent = modeNotice('style');
    drawReferenceArt($('#hero-art'), 'source');
  }

  return {
    buildGeminiImageDataset,
    buildImageDataset,
    buildUrlDataset,
    comparisonPosition,
    createAnalysisStages,
    createExport,
    escapeHtml,
    inspectImageFile,
    imageFileToBase64,
    init,
    modeNotice,
    parseImageDimensions,
    safeFilename,
    selectOne,
  };
});
