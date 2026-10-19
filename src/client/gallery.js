/**
 * 收藏画廊（PRD §2.2 F7 + 报告的必做补充项）。
 *
 * MVP 必需的两条删除能力（报告 §3.4 明确指出缺失）：
 *   1. 删除单条收藏；
 *   2. 清空全部（两次点击确认，避免误触）。
 *
 * @module src/client/gallery
 */

/**
 * 渲染收藏画廊。
 *
 * @returns React 元素或 null。
 */
function Gallery(props) {
  const { React, t, useImmersionGlow, actions, handlers } = props;
  const h = React.createElement;

  const open = useImmersionGlow((state) => state.ui.galleryOpen);
  const collections = useImmersionGlow((state) => state.collections);
  // 达成评价存在 verdicts 表里（按记录 id 索引），**不在**记录对象上。
  //
  // ⚠ 早先这里读的是 `item.verdict`，而那个字段从来不存在于任何记录上 ——
  // 于是下面那段「达到了 / 没达到」标记永远是死代码，连带 panel-css 里三档
  // 配色也一起是死的。与 cancelledMs 同属「消费者无生产者」。
  const verdicts = useImmersionGlow((state) => state.verdicts ?? {});
  const [confirmClear, setConfirmClear] = React.useState(false);

  // 关闭时清掉确认态，避免下次打开还停在「再点一次」。
  React.useEffect(() => {
    if (!open) setConfirmClear(false);
  }, [open]);

  if (!open) return null;

  const remove = (id) => actions.removeRecord(id);

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    actions.clearGallery();
    setConfirmClear(false);
  };

  const row = (item) => {
    const tags = Array.isArray(item.tags) ? item.tags : tagsOf(item.createdAt, item.activeMs);
    const name = typeof item.taskName === 'string' && item.taskName.length > 0 ? item.taskName : null;
    const verdict = verdicts[item.id] ?? null;

    return h(
      'li',
      { className: 'ig-row', key: item.id },

      // 左侧任务名：这是画廊里最该被看见的东西，比时长重要。
      h(
        'div',
        { className: 'ig-row-main' },
        h(
          'span',
          { className: 'ig-row-title' },
          name === null ? t('card.untitled') : name,
        ),
        h(
          'span',
          { className: 'ig-row-sub' },
          [
            formatDuration(item.activeMs, t),
            Array.isArray(item.models) && item.models.length > 0
              ? item.models.map((entry) => modelLabel(entry)).join(' · ')
              : null,
            t('card.turns') + ' ' + (Number.isFinite(item.turns) ? item.turns : 0),
            tags.map((id) => t(`tag.${id}`)).join(' · '),
          ]
            .filter((piece) => piece !== null && String(piece).length > 0)
            .join(' · '),
        ),
        verdict !== null && verdict !== undefined && verdict.verdict
          ? h(
              'span',
              { className: `ig-verdict-dot ig-verdict-dot--${verdict.verdict}` },
              t(`card.verdict.${verdict.verdict}`),
            )
          : null,
      ),

      // 回看：把这条记录带进记录卡，可以补评价和备注 —— 收藏不该是静态墓碑。
      h(
        'button',
        {
          type: 'button',
          className: 'ig-row-review',
          onClick: () => handlers.reviewRecord(item.id),
          title: t('gallery.review'),
          'aria-label': `${t('gallery.review')}: ${name === null ? t('card.untitled') : name}`,
        },
        t('gallery.review'),
      ),

      h(
        'button',
        {
          type: 'button',
          className: 'ig-row-remove',
          onClick: () => remove(item.id),
          'aria-label': t('gallery.remove.aria'),
          title: t('gallery.remove'),
        },
        '×',
      ),
    );
  };

  return h(
    React.Fragment,
    null,
    h('div', { className: 'ig-scrim', onClick: handlers.closeGallery, 'aria-hidden': 'true' }),
    h(
      'div',
      { className: 'ig-panel', role: 'dialog', 'aria-modal': 'false', 'aria-label': t('gallery.title') },
      h(
        'div',
        { className: 'ig-panel-head' },
        h('h2', { className: 'ig-panel-title' }, t('gallery.title')),
        h(
          'button',
          { type: 'button', className: 'ig-panel-back', onClick: handlers.backToMeter },
          h('span', { class: 'ig-back-icon', 'aria-hidden': 'true' }, '‹'),
          t('common.back'),
        ),
      ),
      h('p', { className: 'ig-note' }, t('gallery.count', { n: collections.length })),
      collections.length === 0
        ? h('p', { className: 'ig-note' }, t('gallery.empty'))
        : h('ul', { className: 'ig-list' }, collections.map(row)),
      collections.length > 0
        ? h(
            'div',
            { className: 'ig-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ig-btn ig-btn--danger',
                onClick: clearAll,
              },
              confirmClear ? t('gallery.clear.confirm') : t('gallery.clear'),
            ),
          )
        : null,
    ),
  );
}
