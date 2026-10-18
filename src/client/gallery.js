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
    return h(
      'li',
      { className: 'ig-row', key: item.id },
      h(
        'div',
        { className: 'ig-row-main' },
        h('span', { className: 'ig-row-duration' }, formatDuration(item.activeMs, t)),
        h(
          'span',
          { className: 'ig-row-sub' },
          [
            t('card.turns') + ' ' + (Number.isFinite(item.turns) ? item.turns : 0),
            t('card.toolCalls') + ' ' + (Number.isFinite(item.toolCalls) ? item.toolCalls : 0),
            tags.map((id) => t(`tag.${id}`)).join(' · '),
          ]
            .filter((piece) => piece.length > 0)
            .join(' · '),
        ),
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
        h('button', { type: 'button', className: 'ig-panel-close', onClick: handlers.closeGallery }, t('gallery.back')),
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
