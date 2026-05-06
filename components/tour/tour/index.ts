/**
 * Tour Components - Main exports
 * 
 * Provides a comprehensive tour system with:
 * - Global state management via TourProvider
 * - Visual overlay with spotlight effects
 * - Bilingual support (English/Spanish)
 * - Configurable tour steps
 */

// Context and hooks
export { TourProvider, useTour, useTourSafe } from "./tour-context";
export type { TourConfig, TourStep, TourStepContent, TourLanguage } from "./tour-context";

// UI Components
export { TourOverlay } from "./tour-overlay";
export { TourTrigger, FloatingTourButton } from "./tour-trigger";

// Pre-configured tours
export { projectsListTour, projectDetailTour, projectsFullTour } from "./tours/projects-tour";
export { d380DashboardTour, wireListViewerTour } from "./tours/d380-tour";
