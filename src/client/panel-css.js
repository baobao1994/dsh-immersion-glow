/**
 * 记录卡、画廊、设置行、提醒卡的样式。
 *
 * 光带（band-css.js）已随 ADR-123 退役，本文件是唯一的样式来源。
 *
 * @module src/client/panel-css
 */

const PANEL_CSS = `/* ── 记录卡 / 画廊的公共面板 ─────────────────────────────────────── */
.ig-scrim {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background: transparent;
}

.ig-panel {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  width: min(420px, calc(100vw - 32px));
  max-height: min(70vh, 560px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--dsw-radius-lg, 14px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.12));
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  backdrop-filter: blur(18px) saturate(1.4);
  color: var(--dsw-alias-label-primary, currentColor);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  animation: ig-panel-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.ig-panel--closing {
  animation: ig-panel-out 0.45s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes ig-panel-in {
  from { opacity: 0; transform: translateX(-50%) translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

@keyframes ig-panel-out {
  from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  to   { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.98); }
}

.ig-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ig-panel-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  margin: 0;
}

.ig-panel-close {
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: var(--dsw-radius-sm, 6px);
}

.ig-panel-close:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

/* ── 指标栅格 ───────────────────────────────────────────────────── */
.ig-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.ig-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
  min-width: 0;
}

.ig-metric dt {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-metric dd {
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 标签 ───────────────────────────────────────────────────────── */
.ig-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ig-tag {
  font-size: 12px;
  line-height: 18px;
  padding: 2px 8px;
  border-radius: var(--dsw-radius-full, 999px);
  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.14));
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

/* ── 说明文字 ───────────────────────────────────────────────────── */
.ig-note {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  margin: 0;
}

.ig-note--warn {
  color: var(--dsw-alias-label-warning, #b7791f);
}

/* ── 按钮 ───────────────────────────────────────────────────────── */
.ig-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ig-btn {
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  padding: 6px 12px;
  border-radius: var(--dsw-radius-md, 10px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
  color: var(--dsw-alias-label-primary, currentColor);
  cursor: pointer;
}

.ig-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.16));
}

.ig-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.ig-btn--primary {
  background: var(--dsw-alias-text-brand, #539cfa);
  border-color: transparent;
  color: #fff;
}

.ig-btn--quiet {
  background: transparent;
}

.ig-btn--danger {
  color: var(--dsw-alias-label-error, #d64545);
}

/* ── 画廊列表 ───────────────────────────────────────────────────── */
.ig-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
}

.ig-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ig-row-duration {
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
}

.ig-row-sub {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-row-remove {
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: var(--dsw-radius-sm, 6px);
  flex: none;
}

.ig-row-remove:hover {
  color: var(--dsw-alias-label-error, #d64545);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

/* ── 右上角提醒卡（ADR-123）─────────────────────────────────────── */
/* 卡片与未读徽标共用 .ig-reminder 定位：挂在宿主 overlay 的右上角。 */
.ig-reminder {
  position: absolute;
  top: 16px;
  right: 16px;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: min(320px, calc(100vw - 48px));
  padding: 12px 14px;
  border-radius: var(--dsw-radius-lg, 14px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.12));
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  backdrop-filter: blur(18px) saturate(1.4);
  color: var(--dsw-alias-label-primary, currentColor);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.22);
  animation: ig-reminder-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes ig-reminder-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ig-reminder-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
}

.ig-reminder-title {
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
}

.ig-reminder-message {
  font-size: 12.5px;
  line-height: 19px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-reminder-countdown {
  font-size: 11.5px;
  line-height: 17px;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.8));
  font-variant-numeric: tabular-nums;
}

.ig-reminder-close {
  position: absolute;
  top: 6px;
  right: 6px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  line-height: 18px;
  padding: 2px 6px;
  border-radius: var(--dsw-radius-sm, 6px);
}

.ig-reminder-close:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

/* 未读徽标：倒计时结束后 sticky 提醒的常驻形态，点了才消失。 */
.ig-reminder-badge {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  padding: 4px 8px;
  max-width: none;
  box-shadow: none;
  cursor: pointer;
  border-radius: var(--dsw-radius-full, 999px);
  animation: none;
}

.ig-reminder-badge:hover {
  color: var(--dsw-alias-label-primary, currentColor);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

.ig-reminder-badge-dot {
  inline-size: 6px;
  block-size: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--dsw-alias-text-brand, #539cfa);
}

/* ── 设置行 ─────────────────────────────────────────────────────── */
.ig-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  color: var(--dsw-alias-label-primary, currentColor);
  font-size: 14px;
  line-height: 22px;
}

.ig-settings-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.ig-settings-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ig-settings-title {
  font-size: 14px;
  line-height: 20px;
}

.ig-settings-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-settings-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.ig-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ig-field-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-input {
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  padding: 5px 8px;
  border-radius: var(--dsw-radius-sm, 6px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
  color: var(--dsw-alias-label-primary, currentColor);
  width: 100%;
  box-sizing: border-box;
}

.ig-input--invalid {
  border-color: var(--dsw-alias-label-error, #d64545);
}

.ig-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  flex: none;
}

.ig-switch input {
  inline-size: 16px;
  block-size: 16px;
  accent-color: var(--dsw-alias-text-brand, #539cfa);
  cursor: pointer;
}

.ig-inline-timer {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  user-select: none;
  white-space: nowrap;
  padding: 0 4px;
}

/* ── 动效偏好 ───────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .ig-reminder,
  .ig-panel,
  .ig-panel--closing {
    animation: none;
  }
}
`;
