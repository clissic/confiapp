import readme from '@repo/README.md?raw';
import contributing from '@repo/CONTRIBUTING.md?raw';
import testing from '@repo/TESTING.md?raw';
import optimizationReport from '@repo/OPTIMIZATION_REPORT.md?raw';
import architecture from '@repo/docs/ARCHITECTURE.md?raw';
import operationFlows from '@repo/docs/OPERATION_FLOWS.md?raw';
import webApp from '@repo/docs/WEB_APP.md?raw';
import financeNotes from '@repo/docs/FINANCE_MVP_NOTES.md?raw';
import financialMvp from '@repo/docs/CONFIAPP_FINANCIAL_MVP.md?raw';
import idDigital from '@repo/docs/ID_DIGITAL_AGENTS.md?raw';
import systemArchitecture from '@repo/docs/SYSTEM_ARCHITECTURE.md?raw';
import backendBootstrap from '@repo/docs/BACKEND_BOOTSTRAP.md?raw';
import demoPublico from '@repo/docs/DEMO_PUBLICO.md?raw';
import designGuide from '@repo/docs/design-system/GUIDE.md?raw';
import databaseArchitecture from '@repo/packages/database/ARCHITECTURE.md?raw';
import cleanArchitecture from '@repo/apps/api/src/CLEAN_ARCHITECTURE.md?raw';

export type DocsCategory =
  | 'Producto'
  | 'Arquitectura'
  | 'Finanzas'
  | 'Frontend'
  | 'Backend'
  | 'Operación'
  | 'Histórico';

export type DocsEntry = {
  id: string;
  title: string;
  description: string;
  category: DocsCategory;
  path: string;
  content: string;
};

/** Índice de documentación del monorepo (contenido embebido en build). */
export const DOCS_CATALOG: DocsEntry[] = [
  {
    id: 'readme',
    title: 'README',
    description: 'Visión general del monorepo, stack y puntos de entrada.',
    category: 'Producto',
    path: 'README.md',
    content: readme,
  },
  {
    id: 'operation-flows',
    title: 'Flujos de operación',
    description: 'Cómo vive una operación comprador, vendedor y agente (pagos, plazos, disputas).',
    category: 'Producto',
    path: 'docs/OPERATION_FLOWS.md',
    content: operationFlows,
  },
  {
    id: 'web-app',
    title: 'Web App',
    description: 'Estado del producto UI: rutas, roles y copy vs estados de dominio.',
    category: 'Frontend',
    path: 'docs/WEB_APP.md',
    content: webApp,
  },
  {
    id: 'design-system',
    title: 'Design System',
    description: 'Guía de uso del sistema visual: tokens, componentes y posicionamiento.',
    category: 'Frontend',
    path: 'docs/design-system/GUIDE.md',
    content: designGuide,
  },
  {
    id: 'architecture',
    title: 'Arquitectura del repo',
    description: 'Clean Architecture en monorepo, stack y estructura de paquetes.',
    category: 'Arquitectura',
    path: 'docs/ARCHITECTURE.md',
    content: architecture,
  },
  {
    id: 'system-architecture',
    title: 'Arquitectura de sistema',
    description: 'Diseño a escala, decisiones de plataforma y visión SaaS.',
    category: 'Arquitectura',
    path: 'docs/SYSTEM_ARCHITECTURE.md',
    content: systemArchitecture,
  },
  {
    id: 'clean-architecture',
    title: 'Capas Clean Architecture (API)',
    description: 'Target de capas en apps/api: domain, application, infrastructure.',
    category: 'Backend',
    path: 'apps/api/src/CLEAN_ARCHITECTURE.md',
    content: cleanArchitecture,
  },
  {
    id: 'database-architecture',
    title: 'Arquitectura de datos',
    description: 'Decisiones MongoDB/Mongoose y mapa de relaciones.',
    category: 'Arquitectura',
    path: 'packages/database/ARCHITECTURE.md',
    content: databaseArchitecture,
  },
  {
    id: 'financial-mvp',
    title: 'Especificación financiera MVP',
    description: 'Spec de comisiones, escrow, wallet y Mercado Pago.',
    category: 'Finanzas',
    path: 'docs/CONFIAPP_FINANCIAL_MVP.md',
    content: financialMvp,
  },
  {
    id: 'finance-notes',
    title: 'Notas de finanzas',
    description: 'Implementación actual del cobro, fees y liquidaciones.',
    category: 'Finanzas',
    path: 'docs/FINANCE_MVP_NOTES.md',
    content: financeNotes,
  },
  {
    id: 'id-digital',
    title: 'Identidad Digital (agentes)',
    description: 'OAuth Abitab ID Digital para verificación de agentes.',
    category: 'Backend',
    path: 'docs/ID_DIGITAL_AGENTS.md',
    content: idDigital,
  },
  {
    id: 'backend-bootstrap',
    title: 'Bootstrap del backend',
    description: 'Snapshot histórico del scaffold Express inicial.',
    category: 'Histórico',
    path: 'docs/BACKEND_BOOTSTRAP.md',
    content: backendBootstrap,
  },
  {
    id: 'demo-publico',
    title: 'Demo público (túnel)',
    description: 'Cómo exponer desarrollo con URL HTTPS para demos.',
    category: 'Operación',
    path: 'docs/DEMO_PUBLICO.md',
    content: demoPublico,
  },
  {
    id: 'contributing',
    title: 'Contributing',
    description: 'Cómo contribuir al monorepo con calidad y trazabilidad.',
    category: 'Operación',
    path: 'CONTRIBUTING.md',
    content: contributing,
  },
  {
    id: 'testing',
    title: 'Testing',
    description: 'Vitest, Playwright y mongodb-memory-server.',
    category: 'Operación',
    path: 'TESTING.md',
    content: testing,
  },
  {
    id: 'optimization-report',
    title: 'Informe de optimización',
    description: 'Snapshot histórico de performance (2026-08).',
    category: 'Histórico',
    path: 'OPTIMIZATION_REPORT.md',
    content: optimizationReport,
  },
];

export const DOCS_CATEGORIES: DocsCategory[] = [
  'Producto',
  'Arquitectura',
  'Finanzas',
  'Frontend',
  'Backend',
  'Operación',
  'Histórico',
];

export function findDocById(id: string | undefined): DocsEntry | undefined {
  if (!id) return undefined;
  return DOCS_CATALOG.find((d) => d.id === id);
}
