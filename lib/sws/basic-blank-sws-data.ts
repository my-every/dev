import type { SwsSection } from '@/components/d380/sws/sws-work-execution-table'

// ============================================================================
// BASIC / BLANK SWS DATA
// Based on Basic-Blank.pdf - Generic/Custom Work Sheet Template
// Used for non-standard work or custom procedures
// ============================================================================

export const BASIC_BLANK_SWS: SwsSection[] = [
  {
    id: 'basic-work',
    title: 'Custom Work Procedure',
    phase: 'build-up',
    elements: [
      {
        id: 'basic-element-1',
        number: 1,
        title: 'Preparation',
        symbol: 'circle',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: 'basic-1-1',
            text: 'Verify project information and latest revision.',
            isBold: true
          },
          {
            id: 'basic-1-2',
            text: 'Fill in the Project information on this form.'
          },
          {
            id: 'basic-1-3',
            text: 'Obtain all required parts and materials.',
            isKeyPoint: true
          },
          {
            id: 'basic-1-4',
            text: 'Notify Team Leader/Lead about any discrepancies.'
          }
        ]
      },
      {
        id: 'basic-element-2',
        number: 2,
        title: 'Work Step 1',
        symbol: 'diamond',
        references: [],
        subSteps: [
          {
            id: 'basic-2-1',
            text: 'Perform work step 1 per work instructions.',
            isBold: true
          },
          {
            id: 'basic-2-2',
            text: 'Verify step completion before proceeding.'
          }
        ]
      },
      {
        id: 'basic-element-3',
        number: 3,
        title: 'Work Step 2',
        symbol: 'diamond',
        references: [],
        subSteps: [
          {
            id: 'basic-3-1',
            text: 'Perform work step 2 per work instructions.',
            isBold: true
          },
          {
            id: 'basic-3-2',
            text: 'Verify step completion before proceeding.'
          }
        ]
      },
      {
        id: 'basic-element-4',
        number: 4,
        title: 'Work Step 3',
        symbol: 'diamond',
        references: [],
        subSteps: [
          {
            id: 'basic-4-1',
            text: 'Perform work step 3 per work instructions.',
            isBold: true
          },
          {
            id: 'basic-4-2',
            text: 'Verify step completion before proceeding.'
          }
        ]
      },
      {
        id: 'basic-element-5',
        number: 5,
        title: 'Quality Check',
        symbol: 'star',
        references: ['QAS 500'],
        subSteps: [
          {
            id: 'basic-5-1',
            text: 'Perform quality inspection per requirements.',
            isBold: true
          },
          {
            id: 'basic-5-2',
            text: 'Document any discrepancies with MRCA#.',
            isKeyPoint: true
          },
          {
            id: 'basic-5-3',
            text: 'Verify work meets specifications.'
          }
        ]
      },
      {
        id: 'basic-element-6',
        number: 6,
        title: 'Completion',
        symbol: 'circle',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: 'basic-6-1',
            text: 'Verify all work is complete.',
            isBold: true
          },
          {
            id: 'basic-6-2',
            text: 'Clean work area.'
          },
          {
            id: 'basic-6-3',
            text: 'Document any shortages or issues.'
          },
          {
            id: 'basic-6-4',
            text: 'Stamp completion and notify Team Leader/Lead.',
            isKeyPoint: true
          }
        ]
      }
    ]
  }
]

export function createFreshBasicBlankSwsCopy(): SwsSection[] {
  return JSON.parse(JSON.stringify(BASIC_BLANK_SWS))
}
