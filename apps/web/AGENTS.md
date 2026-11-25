# Web Guide

Apply alongside the root [AGENTS.md](../../AGENTS.md).

## Structure and state

- Put Next routes in `app/`, composing public exports from `src/pages/<slice>`. Keep `pages/README.md`: it prevents FSD `src/pages` from being interpreted as the Pages Router.
- Dependencies flow `app → pages → widgets → features → entities → shared`. Use `index.ts` across slices, relative imports within a slice, and no imports between different slices of the same layer.
- Preserve FSD restrictions in `eslint.config.mjs`. Review changed imports too: alias-based rules do not catch every relative-path bypass.
- Reuse TanStack Query for server state and the Axios instance in `shared/api`. Zustand is not installed; avoid unnecessary stores or API instances.
- Compute derived values directly. Keep Effects with cleanup for external events, timers, and WebGL synchronization; do not remove necessary synchronization just to reduce Effects.
- Use Tailwind and `shared/lib`'s `cn()`. Pretendard and custom variants are defined in `src/app/styles/globals.css`.

## Visual consistency

- Use the nearest existing screen as the visual reference before editing UI. Match its layout shell, page title, spacing, surfaces, form controls, focus states, and color palette. For daily records, start from the shared health-commit detail page and compare with the caffeine and sleep screens.
- Inherit the parent theme and Pretendard. Do not add a separate page background, theme override, accent palette, or decorative styles without a request for a redesign. Keep later features out of the current navigation and screen.
- Compare the edited screen with the reference on desktop and mobile in a browser when available. Report any visual check that could not be run.

## Authentication and 3D

- Reuse `entities/session` APIs and query keys. Only 401 means unauthenticated; distinguish network/5xx failures. Keep CSRF in memory and sessions in HttpOnly cookies.
- Protected routes use `RequireSession` in `(member)/layout.tsx`. Client protection does not enforce data ownership.
- Preserve logout request cancellation/cache clearing and `SessionActivity` renewal on actual activity, not automatic polling. See [auth.md](../../docs/auth.md) for policy.
- Render the `dorm-viewer` Canvas only on the client. Keep the furniture, materials, and centering logic of `public/models/dorm.glb`.
- Distinguish unsupported WebGL, model errors, and context loss. Preserve loading/error UI, camera limits, disabled zoom, reduced-motion/hidden-page handling, and event cleanup.
- Avoid per-frame React state updates. Check 3D/HUD changes in a real browser on desktop and narrow screens, including UI hiding during rotation and returning afterward. Report unavailable browser checks as unverified.

## Verification

- `pnpm agent:verify --scope web --build` runs existing lint/typecheck/test/build commands in a temporary copy.
- Web tests use Node's built-in runner with an explicit file list in `package.json`. Add new tests to that list.
- Synthetic events and GLB calculations in Node tests do not replace browser E2E checks.
