/**
 * Projects Page Tour Configuration
 * 
 * Defines the step-by-step tour for the /projects page,
 * with content in both English and Spanish.
 */

import type { TourConfig, TourStep } from "../tour-context";

// ============================================================================
// Tour Steps
// ============================================================================

const projectsTourSteps: TourStep[] = [
  {
    id: "welcome",
    position: "center",
    content: {
      en: {
        title: "Welcome to Wire List Projects",
        description: "This tour will guide you through the main features of the projects page. You'll learn how to upload workbooks, manage projects, and navigate wire lists.",
      },
      es: {
        title: "Bienvenido a Proyectos de Listas de Cables",
        description: "Este tour te guiara por las funciones principales de la pagina de proyectos. Aprenderas como cargar libros de trabajo, gestionar proyectos y navegar listas de cables.",
      },
    },
  },
  {
    id: "new-project",
    target: "[data-tour='new-project']",
    position: "bottom",
    content: {
      en: {
        title: "Create New Project",
        description: "Click here to upload a new Excel workbook. The system will automatically parse wire lists, reference sheets, and extract part numbers from your file.",
      },
      es: {
        title: "Crear Nuevo Proyecto",
        description: "Haz clic aqui para cargar un nuevo libro de Excel. El sistema analizara automaticamente listas de cables, hojas de referencia y extraera numeros de parte de tu archivo.",
      },
    },
  },
  {
    id: "project-cards",
    target: "[data-tour='project-cards']",
    position: "top",
    content: {
      en: {
        title: "Project Cards",
        description: "Each card represents an uploaded workbook. You can see the project name, number of sheets, wire lists, and reference data at a glance.",
      },
      es: {
        title: "Tarjetas de Proyecto",
        description: "Cada tarjeta representa un libro cargado. Puedes ver el nombre del proyecto, numero de hojas, listas de cables y datos de referencia de un vistazo.",
      },
    },
  },
  {
    id: "documentation",
    target: "[data-tour='documentation']",
    position: "bottom",
    content: {
      en: {
        title: "Documentation",
        description: "Need help? Access the full documentation to learn about supported file formats, data requirements, and advanced features.",
      },
      es: {
        title: "Documentacion",
        description: "Necesitas ayuda? Accede a la documentacion completa para aprender sobre formatos de archivo compatibles, requisitos de datos y funciones avanzadas.",
      },
    },
  },
];

const projectDetailSteps: TourStep[] = [
  {
    id: "project-header",
    target: "[data-tour='project-header']",
    position: "bottom",
    content: {
      en: {
        title: "Project Overview",
        description: "This header shows your project name, filename, and key statistics. Use the back button to return to the project list.",
      },
      es: {
        title: "Vista General del Proyecto",
        description: "Este encabezado muestra el nombre de tu proyecto, archivo y estadisticas clave. Usa el boton de retroceso para volver a la lista de proyectos.",
      },
    },
  },
  {
    id: "layout-upload",
    target: "[data-tour='layout-upload']",
    position: "bottom",
    content: {
      en: {
        title: "Layout PDF Upload",
        description: "Optionally upload a layout PDF to enable wire length estimation. The system will match sheets to layout pages automatically.",
      },
      es: {
        title: "Cargar PDF de Layout",
        description: "Opcionalmente carga un PDF de layout para habilitar la estimacion de longitud de cables. El sistema emparejara las hojas con las paginas de layout automaticamente.",
      },
    },
  },
  {
    id: "sheet-cards",
    target: "[data-tour='sheet-cards']",
    position: "top",
    content: {
      en: {
        title: "Sheet Navigation",
        description: "Click any sheet card to view its wire list. Cards show wire counts, identification status, and matching information.",
      },
      es: {
        title: "Navegacion de Hojas",
        description: "Haz clic en cualquier tarjeta de hoja para ver su lista de cables. Las tarjetas muestran conteos de cables, estado de identificacion e informacion de emparejamiento.",
      },
    },
  },
];

// ============================================================================
// Tour Configuration
// ============================================================================

export const projectsListTour: TourConfig = {
  id: "projects-list-tour",
  steps: [projectsTourSteps[0], ...projectsTourSteps.slice(1)] as [TourStep, ...TourStep[]],
  showProgress: true,
  allowClose: true,
  allowSkip: true,
};

export const projectDetailTour: TourConfig = {
  id: "project-detail-tour",
  steps: [projectDetailSteps[0], ...projectDetailSteps.slice(1)] as [TourStep, ...TourStep[]],
  showProgress: true,
  allowClose: true,
  allowSkip: true,
};

// Combined tour for first-time users
export const projectsFullTour: TourConfig = {
  id: "projects-full-tour",
  steps: [
    projectsTourSteps[0],
    ...projectsTourSteps.slice(1),
    ...projectDetailSteps,
  ] as [TourStep, ...TourStep[]],
  showProgress: true,
  allowClose: true,
  allowSkip: true,
};
