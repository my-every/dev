/**
 * D380 Dashboard Tour Configuration
 * 
 * Defines the step-by-step tour for the /380 dashboard,
 * with content in both English and Spanish.
 */

import type { TourConfig, TourStep } from "../tour-context";

// ============================================================================
// Dashboard Tour Steps
// ============================================================================

const dashboardTourSteps: TourStep[] = [
  {
    id: "welcome-d380",
    position: "center",
    content: {
      en: {
        title: "Welcome to D380 Dashboard",
        description: "This tour will guide you through the D380 department dashboard. Learn how to navigate projects, assignments, and tools efficiently.",
      },
      es: {
        title: "Bienvenido al Panel D380",
        description: "Este tour te guiara por el panel del departamento D380. Aprende a navegar proyectos, asignaciones y herramientas de manera eficiente.",
      },
    },
  },
  {
    id: "navigation-tabs",
    target: "[data-tour='nav-tabs']",
    position: "bottom",
    content: {
      en: {
        title: "Navigation Tabs",
        description: "Use these tabs to quickly switch between different sections: Dashboard, Projects, Assignments, and Tools.",
      },
      es: {
        title: "Pestanas de Navegacion",
        description: "Usa estas pestanas para cambiar rapidamente entre secciones: Panel, Proyectos, Asignaciones y Herramientas.",
      },
    },
  },
  {
    id: "projects-section",
    target: "[data-tour='projects-section']",
    position: "top",
    content: {
      en: {
        title: "Projects Overview",
        description: "View all your active projects at a glance. Cards show project status, risk levels, and quick access to wire lists.",
      },
      es: {
        title: "Vista General de Proyectos",
        description: "Ve todos tus proyectos activos de un vistazo. Las tarjetas muestran estado del proyecto, niveles de riesgo y acceso rapido a listas de cables.",
      },
    },
  },
  {
    id: "tools-section",
    target: "[data-tour='tools-section']",
    position: "top",
    content: {
      en: {
        title: "Tools & Utilities",
        description: "Access specialized tools for wire list viewing, analysis, and project management from this section.",
      },
      es: {
        title: "Herramientas y Utilidades",
        description: "Accede a herramientas especializadas para visualizacion de listas de cables, analisis y gestion de proyectos desde esta seccion.",
      },
    },
  },
];

// ============================================================================
// Wire List Viewer Tour Steps
// ============================================================================

const wireListViewerSteps: TourStep[] = [
  {
    id: "wire-list-intro",
    position: "center",
    content: {
      en: {
        title: "Wire List Viewer",
        description: "This powerful viewer lets you analyze wire lists with filtering, sorting, and identification features. Let's explore the key features.",
      },
      es: {
        title: "Visor de Listas de Cables",
        description: "Este potente visor te permite analizar listas de cables con filtrado, ordenamiento y funciones de identificacion. Exploremos las funciones clave.",
      },
    },
  },
  {
    id: "filter-toolbar",
    target: "[data-tour='filter-toolbar']",
    position: "bottom",
    content: {
      en: {
        title: "Filter & Search",
        description: "Use the toolbar to filter wires by identification type, search for specific devices, or narrow down by wire characteristics.",
      },
      es: {
        title: "Filtrar y Buscar",
        description: "Usa la barra de herramientas para filtrar cables por tipo de identificacion, buscar dispositivos especificos o reducir por caracteristicas de cables.",
      },
    },
  },
  {
    id: "wire-table",
    target: "[data-tour='wire-table']",
    position: "top",
    content: {
      en: {
        title: "Wire List Table",
        description: "The main table shows all wire entries. Click column headers to sort, or click a row for detailed information.",
      },
      es: {
        title: "Tabla de Lista de Cables",
        description: "La tabla principal muestra todas las entradas de cables. Haz clic en los encabezados de columna para ordenar, o haz clic en una fila para informacion detallada.",
      },
    },
  },
  {
    id: "identification-badges",
    target: "[data-tour='identification-badges']",
    position: "left",
    content: {
      en: {
        title: "Identification Status",
        description: "Color-coded badges show the identification status of each wire: white labels, blue labels, part numbers, and more.",
      },
      es: {
        title: "Estado de Identificacion",
        description: "Las insignias codificadas por colores muestran el estado de identificacion de cada cable: etiquetas blancas, etiquetas azules, numeros de parte y mas.",
      },
    },
  },
];

// ============================================================================
// Tour Configurations
// ============================================================================

export const d380DashboardTour: TourConfig = {
  id: "d380-dashboard-tour",
  steps: [dashboardTourSteps[0], ...dashboardTourSteps.slice(1)] as [TourStep, ...TourStep[]],
  showProgress: true,
  allowClose: true,
  allowSkip: true,
};

export const wireListViewerTour: TourConfig = {
  id: "wire-list-viewer-tour",
  steps: [wireListViewerSteps[0], ...wireListViewerSteps.slice(1)] as [TourStep, ...TourStep[]],
  showProgress: true,
  allowClose: true,
  allowSkip: true,
};
