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
    const colorLines = Object.entries(colors)
      .map(([key, value]) => `  --color-${key}: ${value};`)
      .join('\n');
    return `:root {
${colorLines}
  --font-display: "${typography.display.split(' · ')[0]}";
  --font-body: "${typography.body.split(' · ')[0]}";
  --font-mono: "${typography.mono.split(' · ')[0]}";
  --space-base: ${spacing.base};
  --radius-control: ${radii.control};
  --radius-card: ${radii.card};
  --radius-panel: ${radii.panel};
  --motion-micro: ${motion.micro};
  --motion-short: ${motion.short};
  --motion-medium: ${motion.medium};
  --motion-easing: ${motion.easing};
}
`;
  }

  function createExport(format, data) {
    if (format === 'json') return JSON.stringify(data, null, 2);
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
    return JSON.parse(JSON.stringify(root.UI_TO_PROMPT_SAMPLE));
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
      if (focusPanel) $(`[data-source-panel="${sourceType}"] input`)?.focus();
    }

    function activateWorkspace(tabId) {
      const buttons = $$('[data-workspace-tab]');
      updateSelection(buttons, tabId, 'workspaceTab');
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
          : '静态原型不会上传文件；下面演示相同输入的分析与导出结构。',
        'neutral',
      );
      $('#analysis-panel').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });

      const stageElements = $$('.analysis-stage');
      const delay = prefersReducedMotion() ? 0 : 240;
      for (let index = 0; index < stageElements.length; index += 1) {
        stageElements[index].dataset.state = 'active';
        $('#analysis-current').textContent = stages[index].copy;
        if (delay) await wait(delay);
        stageElements[index].dataset.state = 'complete';
      }

      renderWorkspace(currentData);
      $('#workspace').hidden = false;
      setStatus('分析结构已就绪：观察、计算、推断与未知内容已分开。', 'success');
      $('#workspace-title').focus({ preventScroll: true });
      $('#workspace').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }

    function evidenceChip(type) {
      return `<span class="evidence-chip evidence-${type.toLowerCase()}">${type}</span>`;
    }

    function renderWorkspace(data) {
      $('#project-title').textContent = data.meta.title;
      $('#project-source').textContent = `${data.meta.sourceLabel} · ${data.meta.viewport}`;
      $('#capture-time').textContent = data.meta.capturedAt;

      $('#evidence-summary').innerHTML = Object.entries(data.evidenceSummary)
        .map(
          ([type, item]) => `<article class="evidence-stat evidence-stat-${type}">
            <span class="evidence-stat-count">${item.count}</span>
            <div><strong>${item.label}</strong><small>${item.detail}</small></div>
            ${evidenceChip(evidenceLabels[type])}
          </article>`,
        )
        .join('');

      $('#north-star').textContent = data.brief.northStar;
      $('#brief-intent').textContent = data.brief.intent;
      $('#invariant-list').innerHTML = data.brief.invariants
        .map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span>${item}</li>`)
        .join('');
      $('#limit-list').innerHTML = data.brief.limits.map((item) => `<li>${item}</li>`).join('');

      $('#color-tokens').innerHTML = Object.entries(data.tokens.colors)
        .map(
          ([name, value]) => `<li class="token-row">
            <span class="token-swatch" style="--swatch:${value}" aria-hidden="true"></span>
            <span><strong>${name}</strong><small>${value}</small></span>
          </li>`,
        )
        .join('');
      $('#type-tokens').innerHTML = Object.entries(data.tokens.typography)
        .filter(([name]) => name !== 'scale')
        .map(([name, value]) => `<li><span>${name}</span><strong>${value}</strong></li>`)
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
              <span class="prompt-heading"><strong>${section.title}</strong><small>${section.confidence} confidence</small></span>
              ${evidenceChip(section.evidenceType)}
            </summary>
            <div class="prompt-section-body">
              <p>${section.content}</p>
              <div class="section-actions"><button type="button" class="text-button" data-copy-section="${section.id}">复制本段</button><span>来源与置信度保持可见</span></div>
            </div>
          </details>`,
        )
        .join('');

      $('#validation-checks').innerHTML = data.validation.checks
        .map(
          (check) => `<li data-status="${check.status}"><span class="check-mark" aria-hidden="true">${
            check.status === 'pass' ? '✓' : '!'
          }</span><span><strong>${check.label}</strong><small>${check.detail}</small></span></li>`,
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
    comparisonPosition,
    createAnalysisStages,
    createExport,
    init,
    modeNotice,
    safeFilename,
    selectOne,
  };
});
