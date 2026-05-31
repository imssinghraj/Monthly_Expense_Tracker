export function createNavbar({ userName = "Guest", organizationName = "Personal Workspace" } = {}) {
  return `
    <nav class="saas-navbar">
      <div>
        <strong>Budgetra</strong>
        <span>${organizationName}</span>
      </div>
      <div class="saas-navbar-actions">
        <button class="icon-btn" type="button" aria-label="Notifications">!</button>
        <span>${userName}</span>
      </div>
    </nav>`;
}
