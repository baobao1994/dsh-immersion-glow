/**
 * 设置行（PRD §2.1 F4 最小形态 + §4.9 埋点展示）。
 *
 * 挂载点：`settings.general.item`（kind: list, scope: root）。
 *
 * 关键事实（已核对插槽目录）：这个插槽的 ownerProps 是空的，**没有任何人投影
 * `label`** —— 官方文档写明 "[the row] draws its own internals, including its
 * label: nothing projects a `label` here"。所以 PRD §4.7 里的
 * `label: () => t('settings.row.label')` 是死代码，本实现不传 label，标题自己画。
 *
 * 行内容：
 *   - 标题 + 描述 + 启用开关
 *   - 触发阈值（逗号分隔的数字列表，非法输入就地标红且不写回）
 *   - 空闲冻结分钟
 *   - 右上角常驻读数开关
 *   - 收藏 / 汇总入口
 *   - 埋点一行 + 复制统计
 *   - 清除本插件数据（两次确认）
 *
 * 强度选择（呼吸 / 静默）已随光带退役删除（ADR-123）；输入框常驻计时已在
 * v4 搬到右上角（见 hud.js），本行不再有那个开关。
 *
 * @module src/client/settings-row
 */

/**
 * 渲染设置行。
 *
 * @returns React 元素。
 */
function SettingsRow(props) {
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

  const switchRow = (labelText, checked, onChange) =>
    h(
      'label',
      { className: 'ig-switch' },
      h('input', { type: 'checkbox', checked, onChange: (event) => onChange(event.target.checked) }),
      labelText,
    );

  return h(
    'div',
    { className: 'ig-settings' },

    h(
      'div',
      { className: 'ig-settings-head' },
      h(
        'div',
        { className: 'ig-settings-text' },
        h('span', { className: 'ig-settings-title' }, t('settings.title')),
        h('span', { className: 'ig-settings-desc' }, t('settings.desc')),
      ),
      switchRow(t('settings.enabled'), settings.enabled, (checked) =>
        actions.updateSettings({ enabled: checked }),
      ),
    ),

    settings.enabled
      ? h(
          'div',
          null,

          h(
            'div',
            { className: 'ig-settings-fields' },

            // 阈值
            h(
              'label',
              { className: 'ig-field' },
              h('span', { className: 'ig-field-label' }, t('settings.thresholds')),
              h('input', {
                className: thresholdInvalid ? 'ig-input ig-input--invalid' : 'ig-input',
                type: 'text',
                value: thresholdText,
                onChange: (event) => commitThresholds(event.target.value),
                'aria-invalid': thresholdInvalid,
                inputMode: 'numeric',
              }),
            ),

            // 空闲冻结
            h(
              'label',
              { className: 'ig-field' },
              h('span', { className: 'ig-field-label' }, t('settings.idle')),
              h('input', {
                className: 'ig-input',
                type: 'number',
                min: 1,
                max: 120,
                step: 1,
                value: String(Math.round(settings.idleTimeoutMs / 60000)),
                onChange: (event) => commitIdleMinutes(event.target.value),
              }),
            ),
          ),

          thresholdInvalid
            ? h('p', { className: 'ig-note ig-note--warn' }, t('settings.thresholds.invalid'))
            : h('p', { className: 'ig-note' }, t('settings.thresholds.hint')),

          switchRow(t('settings.cornerMeter'), settings.showCornerMeter, (checked) =>
            actions.updateSettings({ showCornerMeter: checked }),
          ),
        )
      : null,

    // 收藏与汇总入口。
    //
    // 以前画廊只能从记录卡里的按钮进 —— 卡片一关就再也找不到收藏了。
    // 设置行是常驻的，把它放这里才是「收藏完之后去哪里看」的答案。
    h(
      'div',
      { className: 'ig-actions' },
      h(
        'button',
        {
          type: 'button',
          className: 'ig-btn',
          onClick: onOpenGallery,
          disabled: collectionCount === 0,
        },
        collectionCount > 0
          ? t('gallery.openFromSettings', { n: collectionCount })
          : t('gallery.emptyFromSettings'),
      ),
      h('button', { type: 'button', className: 'ig-btn', onClick: onOpenSummary }, t('settings.openSummary')),
    ),

    // 埋点展示 —— 解 PRD §0 变更 12 的「零网络却要验证点击率」矛盾
    h(
      'div',
      { className: 'ig-actions' },
      h(
        'span',
        { className: 'ig-note' },
        t('settings.telemetry', {
          impressions: telemetry.impressions,
          opens: telemetry.opens,
        }),
      ),
      h(
        'button',
        { type: 'button', className: 'ig-btn ig-btn--quiet', onClick: onCopyStats },
        t('settings.copy'),
      ),
      h(
        'button',
        { type: 'button', className: 'ig-btn ig-btn--quiet ig-btn--danger', onClick: clearData },
        confirmClear ? t('settings.clearData.confirm') : t('settings.clearData'),
      ),
    ),
  );
}
