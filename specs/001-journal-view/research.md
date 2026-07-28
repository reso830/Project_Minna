# Research & Architectural Decisions: Journal View

This document logs design choices and technical analysis for the **Journal View** web interface.

---

## 1. Next.js Hydration & Session State

Since Next.js pre-renders pages on the server (SSR), accessing `sessionStorage` or `window` directly inside React rendering paths causes hydration mismatches (the HTML produced by the server differs from the initial client render).

* **Decision**: 
  - Leverage React `useEffect` hooks or state initializers that run strictly on the client after hydration is complete to safely load `sessionStorage` settings.
  - Implement a loading skeleton or default state (e.g., loading mock data initially, then resolving user cache inputs) to ensure a smooth transition.

---

## 2. Layout Grid & Styling System

The design handoff requires a strict three-column desktop layout that works nicely at widths of 1280px and wider.
* **Proportions**:
  1. **Sidebar**: 280px fixed width, vertical scroll.
  2. **Journal (Center)**: Flex-grow fluid width, containing a scrollable feed and a bottom composer footer.
  3. **Detail (Right)**: 490px fixed width, dark background (#0c110f), vertical scroll for contents.

* **Aesthetic Decisions**:
  - CSS custom properties will be loaded globally in `/src/app/globals.css`.
  - To enforce offline compliance and prevent build-time network dependencies, we will load typography using self-hosted `@fontsource/*` npm packages (`@fontsource/jetbrains-mono`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`) rather than querying `next/font/google` at compile time.
  - Interactive styles (glassmorphism hover states, active selections with `#00F0FF` background, amber blocked tints) will be implemented using vanilla CSS transitions.

---

## 3. Monorepo vs. Unified App Structure

To avoid the overhead of complex yarn/pnpm workspaces for this project scope, we integrate Next.js into the root directory of the existing repository:
- All packages (CLI dependencies and Next.js/React dependencies) are managed in a single root [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json).
- The TypeScript configuration is adjusted to allow both CLI compilation (via `tsconfig.json`) and Next.js builds.
- Running `npm run dev` boots the Next.js dev server, while `npm run dev:cli` triggers CLI execution, keeping the project single-threaded and developer-friendly.
