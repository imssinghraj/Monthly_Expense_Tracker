export function dashboardLayout({ navbar = "", sidebar = "", main = "" } = {}) {
  return `
    <div class="saas-shell">
      ${sidebar}
      <div class="saas-main">
        ${navbar}
        <main>${main}</main>
      </div>
    </div>`;
}
