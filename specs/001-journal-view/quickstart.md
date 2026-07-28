# Developer Quickstart: Journal View

This document guides developers on how to run, inspect, and test the **Journal View** web interface.

---

## 1. Setup & Dependencies

Ensure you have Node.js (>=22.13.0) installed.

To install dependencies:
```bash
npm install
```

---

## 2. Launching the Interface

To run the Next.js application in development mode:
```bash
npm run dev
```
Once started, the UI will be accessible locally at `http://localhost:3000`.

To build the production UI bundle:
```bash
npm run build
```

To run the production UI server:
```bash
npm run start
```

### CLI Script Commands
The existing CLI scripts are separated to prevent collisions with the Next.js lifecycle commands:
- **CLI Development**: `npm run dev:cli status`
- **CLI Build**: `npm run build:cli` (compiles typescript CLI modules using `tsconfig.cli.json` to `dist/`)
- **CLI Run**: `npm run start:cli -- status` (runs compiled CLI using `node dist/cli.js`)

---

## 3. Running Tests

- **UI component & state interaction tests** (powered by Jest & React Testing Library):
  ```bash
  npm run test:ui
  ```
- **CLI backend unit tests** (powered by Node.js built-in runner):
  ```bash
  npm run test:unit
  ```

---

## 4. Modifying Mock Data

If you need to adjust or add mock projects, features, or timeline events to test different UI layouts:
1. Open the file `src/core/mockData.ts` (once implemented).
2. Modify the `mockFeatures` or `mockEvents` exports. Ensure all additions comply with the [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) and [WorkItemEvent](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L121) interfaces defined in [types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts).
