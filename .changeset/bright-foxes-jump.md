---
'@requence/socketql': patch
---

Fix dist being built with the development JSX transform (`jsxDEV` from `react/jsx-dev-runtime`), which broke consumers in both `vite dev` and `vite build`. The build now explicitly uses `jsx: { development: false }` to emit the production transform (`jsx` from `react/jsx-runtime`).
