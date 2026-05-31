window.tailwind = window.tailwind || {};
window.tailwind.config = {
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#1A56DB",
          purple: "#5B4FCF",
          ink: "#0D1526"
        }
      },
      boxShadow: {
        fintech: "0 18px 60px rgba(13,21,38,.12)"
      }
    }
  }
};
