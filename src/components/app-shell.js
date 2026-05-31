(function () {
  function mount(selector, html) {
    const target = document.querySelector(selector);
    if (target) target.outerHTML = html;
  }

  window.BudgetraComponents = {
    mountApp() {
      const sidebarPlaceholder = document.querySelector('[data-component="sidebar"]');
      if (sidebarPlaceholder) sidebarPlaceholder.remove();

      mount(
        '[data-component="app-shell"]',
        `<div class="budgetra-app" id="budgetraApp"><div class="budgetra-root" id="budgetraRoot">${window.BudgetraSidebarTemplate}${window.BudgetraLayoutTemplate}</div></div>`
      );
    }
  };

  window.BudgetraComponents.mountApp();
})();
