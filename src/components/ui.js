export function createToast(message, type = "info") {
  return `<div class="toast toast-${type}" role="status">${message}</div>`;
}

export function createModal({ id, title, body, actions = "" }) {
  return `
    <div class="modal-overlay" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
      <div class="modal">
        <div class="modal-head">
          <h2 id="${id}-title">${title}</h2>
          <button class="icon-btn" type="button" data-close-modal="${id}" aria-label="Close modal">x</button>
        </div>
        <div class="modal-body">${body}</div>
        ${actions ? `<div class="modal-actions">${actions}</div>` : ""}
      </div>
    </div>`;
}

export function createDashboardCard({ label, value, meta = "", tone = "blue" }) {
  return `
    <article class="saas-card saas-card-${tone}">
      <span class="saas-card-label">${label}</span>
      <strong class="saas-card-value">${value}</strong>
      ${meta ? `<small class="saas-card-meta">${meta}</small>` : ""}
    </article>`;
}

export function createTextField({ id, label, type = "text", value = "", placeholder = "" }) {
  return `
    <label class="form-field" for="${id}">
      <span>${label}</span>
      <input id="${id}" type="${type}" value="${value}" placeholder="${placeholder}">
    </label>`;
}
