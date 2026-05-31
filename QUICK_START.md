# Quick Start Guide - Budgetra Refactored

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Local web server (Python, Node.js, or PHP)
- Text editor (VS Code recommended)

### Step 1: Clone or Download

```bash
# If using Git
git clone <repository-url>
cd budgetra

# Or download and extract the ZIP file
```

### Step 2: Start Local Server

Choose one method:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

### Step 3: Open in Browser

Navigate to: `http://localhost:8000/index-refactored.html`

### Step 4: Explore the Code

Open the project in your editor:

```bash
code .  # VS Code
```

## 📁 File Structure Overview

```
budgetra/
├── index-refactored.html    # Start here
├── css/                      # All styles
│   ├── variables.css         # Colors, spacing
│   ├── base.css              # Global styles
│   └── components/           # Component styles
└── js/                       # All JavaScript
    ├── app.js                # Main app
    ├── services/             # Business logic
    └── components/           # UI components
```

## 🎯 Common Tasks

### Modify a Color

1. Open `css/variables.css`
2. Find the color variable:
```css
--primary: #1A56DB;
```
3. Change the value
4. Refresh browser

### Add a New Component

1. Create CSS file: `css/components/my-component.css`
2. Create JS file: `js/components/my-component.js`
3. Add to HTML:
```html
<link rel="stylesheet" href="css/components/my-component.css">
```
4. Import in `js/app.js`:
```javascript
import { MyComponent } from './components/my-component.js';
```

### Change Layout

1. Open `css/layout.css`
2. Modify grid or flexbox properties
3. Test responsive behavior

### Toggle Dark Mode

Click the sun/moon icon in the top right corner

## 🔧 Development Tips

### Browser DevTools

- **F12**: Open DevTools
- **Ctrl+Shift+C**: Inspect element
- **Ctrl+Shift+M**: Toggle device toolbar (responsive testing)

### VS Code Extensions

Recommended extensions:
- Live Server
- ESLint
- Prettier
- CSS Peek

### Hot Reload

Use Live Server extension in VS Code for automatic refresh on save.

## 📖 Documentation

- **ARCHITECTURE.md**: Complete architecture guide
- **MIGRATION_GUIDE.md**: Migration from old version
- **REFACTORING_SUMMARY.md**: Project summary

## 🐛 Troubleshooting

### Styles Not Loading

**Problem**: Page looks unstyled

**Fix**:
1. Check browser console for 404 errors
2. Verify file paths in HTML
3. Clear cache (Ctrl+Shift+R)

### JavaScript Errors

**Problem**: "Cannot use import statement"

**Fix**:
```html
<!-- Ensure script has type="module" -->
<script type="module" src="js/app.js"></script>
```

### CORS Errors

**Problem**: Module loading fails

**Fix**: Use a local server (see Step 2 above)

## 🎨 Customization

### Change Theme Colors

Edit `css/variables.css`:

```css
:root {
  --primary: #YOUR_COLOR;
  --accent: #YOUR_COLOR;
}
```

### Modify Breakpoints

Edit `css/responsive.css`:

```css
@media (max-width: 768px) {
  /* Your responsive styles */
}
```

### Add New Page

1. Create `new-page.html`
2. Copy structure from `index-refactored.html`
3. Link CSS and JS files
4. Customize content

## 📱 Testing

### Desktop Testing

Test in multiple browsers:
- Chrome
- Firefox
- Safari
- Edge

### Mobile Testing

1. Open DevTools (F12)
2. Click device toolbar icon
3. Select device preset
4. Test interactions

### Dark Mode Testing

1. Toggle dark mode
2. Check all pages
3. Verify colors and contrast

## 🚢 Deployment

### Static Hosting

Deploy to:
- Vercel
- Netlify
- GitHub Pages
- Firebase Hosting

### Build for Production

No build step required! Just upload files:

```bash
# Files to upload
index-refactored.html (rename to index.html)
css/
js/
assets/
```

## 💡 Next Steps

1. **Read Documentation**: Start with ARCHITECTURE.md
2. **Explore Code**: Open files and read comments
3. **Make Changes**: Try modifying styles or adding features
4. **Test**: Verify changes work across devices
5. **Deploy**: Push to production when ready

## 🆘 Getting Help

- **Documentation**: Check the docs/ folder
- **Issues**: Create a GitHub issue
- **Community**: Ask in team chat

## ✅ Checklist

- [ ] Local server running
- [ ] Page loads correctly
- [ ] Styles applied
- [ ] JavaScript working
- [ ] Dark mode toggles
- [ ] Responsive on mobile
- [ ] No console errors
- [ ] Ready to develop!

## 🎉 You're Ready!

You now have a fully functional, professional frontend architecture. Start building amazing features!

---

**Need More Help?**
- Read: ARCHITECTURE.md
- Migrate: MIGRATION_GUIDE.md
- Overview: REFACTORING_SUMMARY.md

**Happy Coding! 🚀**
