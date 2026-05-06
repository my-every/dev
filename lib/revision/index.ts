/**
 * Revision Management Module
 * 
 * Handles file revision discovery, comparison, and history tracking
 * for projects imported from Share/Legal Drawings.
 */

// Types (client-safe)
export * from './types'

// Server-only discovery (will error if imported in client)
// Use API routes instead of importing directly
// export * from './revision-discovery'
