/**
 * 设置页（v20）：从「通用设置里的一行」搬出来，成为设置导航里的独立一页。
 *
 * ## 为什么搬出来
 *
 * 宿主对这两个插槽的分工写得很明确（`settings.general.item` 的契约原文）：
 *
 * > One preference row inside the General section — the additive seat for a
 * > single setting that needs no page of its own (a whole page is `settings.section`).
 *
 * 这个插件有 6 项设置 + 3 个数据操作，早就不是「a single setting」了。塞在
 * 通用页里的后果是：它把通用页撑成最长的那个，而它自己的内容又挤成一团
 * ——7 个按钮、一行埋点、两行说明全堆在同一个 12px 间距里。
 *
 * 现在注册成 `settings.section`：设置导航里多一个「沉浸觉察」入口，页面里
 * 用宿主自己的行语法（标题 + 说明在左、控件在右、行间发丝线）排开。
 *
 * ## 信息架构
 *
 *   提醒     启用 / 触发阈值 / 空闲冻结 / 常驻读数
 *   记录     已提醒多少次 + 收藏、汇总、复制统计
 *   危险     清除本插件数据（两次确认）
 *
 * 关闭插件后「记录」与「清除」仍然可见：它们是数据管理，跟「要不要提醒」
 * 是两件事 —— 旧版把它们一起藏了，等于关了插件就再也进不去画廊。
 *
 * @module src/client/settings-row
 */

/**
 * 渲染设置页。
 *
 * @param props - { React, t, useImmersionGlow, actions, onCopyStats,
 *   onOpenGallery, onOpenSummary }
 * @returns React 元素。
 */
function SettingsPage(props) {
  const { React, t, useImmersionGlow, actions, onCopyStats, onOpenGallery, onOpenSummary } = props;
  const h = React.createElement;

  const settings = useImmersionGlow((state) => state.settings);
  const telemetry = useImmersionGlow((state) => state.telemetry);
  const collectionCount = useImmersionGlow((state) => state.collections.length);

  // 阈值输入用本地受控态：允许用户输到一半（如空串、结尾逗号）而不写回 store。
  const [thresholdText, setThresholdText] = React.useState(
    settings.thresholdsMin.join(', '),
  );
  const [thresholdInvalid, setThresholdInvalid] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);

  // 外部改动（如清除数据）后同步回输入框。
  React.useEffect(() => {
    setThresholdText(settings.thresholdsMin.join(', '));
    setThresholdInvalid(false);
  }, [settings.thresholdsMin]);

  const commitThresholds = (text) => {
    setThresholdText(text);
    const parsed = parseThresholds(text);
    if (!parsed.ok) {
      setThresholdInvalid(true);
      return;
    }
    setThresholdInvalid(false);
    // 值没变就不写，避免无意义持久化。
    const current = settings.thresholdsMin.join(',');
    if (parsed.value.join(',') !== current) {
      actions.updateSettings({ thresholdsMin: parsed.value });
    }
  };

  const commitIdleMinutes = (raw) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1 || value > 120) return;
    actions.updateSettings({ idleTimeoutMs: Math.round(value) * 60000 });
  };

  const clearData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    actions.resetAll(Date.now());
    setConfirmClear(false);
  };

  /** 一个开关。标题在行左边，控件只是一个复选框（与宿主设置一致）。 */
  const toggle = (checked, onChange, label) =>
    h(
      'label',
      { className: 'ig-switch', title: label },
      h('input', {
        type: 'checkbox',
        checked,
        'aria-label': label,
        onChange: (event) => onChange(event.target.checked),
      }),
    );

  /**
   * 一行设置：左边标题 + 说明，右边控件。
   *
   * 这就是宿主设置页的行语法（标题 14 / 说明 12 / 行间 0.5px 发丝线）。
   * 旧版把「标签在上、输入框在下」的竖排字段塞进通用页，行语法和宿主不一致，
   * 所以一眼看上去就不像设置项。
   */
  const row = (key, title, desc, control, options) => {
    const danger = options !== undefined && options.danger === true;
    return h(
      'div',
      { className: danger ? 'ig-settings-row ig-settings-row--danger' : 'ig-settings-row', key },
      h(
        'div',
        { className: 'ig-settings-row-text' },
        h('span', { className: 'ig-settings-row-title' }, title),
        desc === null || desc === undefined
          ? null
          : h('span', { className: 'ig-settings-row-desc' }, desc),
      ),
      control === null || control === undefined
        ? null
        : h('div', { className: 'ig-settings-row-control' }, control),
    );
  };

  const enabled = settings.enabled === true;

  return h(
    'div',
    { className: 'ig-settings-page' },

    h('h2', { className: 'ig-settings-page-title' }, t('settings.title')),
    h('p', { className: 'ig-settings-page-intro' }, t('settings.desc')),

    h(
      'div',
      { className: 'ig-settings-rows' },

      // ── 提醒 ────────────────────────────────────────────────────
      row(
        'enabled',
        t('settings.enabled'),
        enabled ? t('settings.enabled.desc') : t('settings.disabled.desc'),
        toggle(enabled, (checked) => actions.updateSettings({ enabled: checked }), t('settings.enabled')),
      ),

      enabled
        ? row(
            'thresholds',
            t('settings.thresholds'),
            thresholdInvalid ? t('settings.thresholds.invalid') : t('settings.thresholds.hint'),
            h('input', {
              className: thresholdInvalid ? 'ig-input ig-input--invalid' : 'ig-input',
              type: 'text',
              value: thresholdText,
              onChange: (event) => commitThresholds(event.target.value),
              'aria-invalid': thresholdInvalid,
              'aria-label': t('settings.thresholds'),
              inputMode: 'numeric',
              style: { width: '180px' },
            }),
          )
        : null,

      enabled
        ? row(
            'idle',
            t('settings.idle'),
            t('settings.idle.hint'),
            h('input', {
              className: 'ig-input',
              type: 'number',
              min: 1,
              max: 120,
              step: 1,
              value: String(Math.round(settings.idleTimeoutMs / 60000)),
              onChange: (event) => commitIdleMinutes(event.target.value),
              'aria-label': t('settings.idle'),
              style: { width: '96px' },
            }),
          )
        : null,

      enabled
        ? row(
            'cornerMeter',
            t('settings.cornerMeter'),
            t('settings.cornerMeter.desc'),
            toggle(
              settings.showCornerMeter,
              (checked) => actions.updateSettings({ showCornerMeter: checked }),
              t('settings.cornerMeter'),
            ),
          )
        : null,

      // ── 记录（与开关无关，关掉插件也要能进去）─────────────────────
      row(
        'records',
        t('settings.records.title'),
        t('settings.telemetry', {
          impressions: telemetry.impressions,
          opens: telemetry.opens,
        }),
        [
          h(
            'button',
            {
              type: 'button',
              className: 'ig-btn',
              key: 'gallery',
              onClick: onOpenGallery,
              disabled: collectionCount === 0,
            },
            collectionCount > 0
              ? t('gallery.openFromSettings', { n: collectionCount })
              : t('gallery.emptyFromSettings'),
          ),
          h(
            'button',
            { type: 'button', className: 'ig-btn', key: 'summary', onClick: onOpenSummary },
            t('settings.openSummary'),
          ),
          h(
            'button',
            { type: 'button', className: 'ig-btn ig-btn--quiet', key: 'copy', onClick: onCopyStats },
            t('settings.copy'),
          ),
        ],
      ),

      // ── 危险操作 ────────────────────────────────────────────────
      row(
        'clear',
        t('settings.clearData'),
        t('settings.clearData.desc'),
        h(
          'button',
          {
            type: 'button',
            className: 'ig-btn ig-btn--quiet ig-btn--danger',
            onClick: clearData,
          },
          // 按钮文案不与标题重复（两处都写「清除本插件数据」只会显得啰嗦）。
          confirmClear ? t('settings.clearData.confirm') : t('settings.clearData.action'),
        ),
        { danger: true },
      ),
    ),
  );
}
