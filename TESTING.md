# Testing ConfiApp

## Stack
- **Vitest** — unit + integration (API/Web)
- **Playwright** — E2E
- **mongodb-memory-server** — DB efímera (integration API)
- **Mocks / fixtures** — `apps/api/test/{fixtures,mocks,helpers}`, `apps/web/{src/test,e2e/fixtures}`

## Cobertura mínima
Gate en módulos críticos (`coverage.include`):
- Statements / Lines / Functions: **≥ 90%**
- Branches: **≥ 80%**

Última corrida local:
- API: stmts **98.8%**, lines **99.1%**, funcs **100%**, branches **84.3%**
- Web: stmts **94.7%**, lines **94.4%**, funcs **100%**, branches **90.9%**

## Comandos

```bash
pnpm test                 # unit (turbo)
pnpm test:coverage        # unit + thresholds
pnpm --filter @confiapp/api test:integration   # HTTP + Mongo memory
pnpm test:e2e             # Playwright (Vite :3001)
```

Primera vez E2E:
```bash
pnpm --filter @confiapp/web exec playwright install chromium
```

## Estructura

```
apps/api/
  vitest.config.ts
  vitest.integration.config.ts
  src/**/*.test.ts
  test/fixtures|helpers|mocks|integration|global-setup.ts

apps/web/
  vitest.config.ts
  playwright.config.ts
  src/**/*.test.ts(x)
  e2e/*.spec.ts + fixtures/
```
