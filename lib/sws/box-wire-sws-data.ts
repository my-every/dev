import type { SwsSection } from '@/components/d380/sws/sws-work-execution-table'

// ============================================================================
// BOX WIRE SWS DATA
// Based on Box-Wire.pdf - Junction Box Wiring
// ============================================================================

export const BOX_WIRE_SWS: SwsSection[] = [
  {
    id: 'box-wiring',
    title: 'Box Wiring',
    phase: 'wiring',
    elements: [
      {
        id: 'box-wire-1',
        number: 1,
        title: 'Prepare to wire the box. Verify project information.',
        symbol: 'arrow',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: 'bw-1-1',
            text: 'Fill in the Project information above on this form.'
          },
          {
            id: 'bw-1-2',
            text: 'Ensure Build Up stamp is complete prior to starting wiring. Notify Team Leader if not completed.',
            isKeyPoint: true
          },
          {
            id: 'bw-1-3',
            text: 'Verify the latest revision. Note cover sheet for any special requirements.',
            isBold: true
          },
          {
            id: 'bw-1-4',
            text: 'Stamp working copy of wire list. Highlight your badge number with the same color you will use on the wire list.'
          }
        ]
      },
      {
        id: 'box-wire-2',
        number: 2,
        title: 'Install ground wires',
        symbol: 'diamond',
        references: ['QAS 503', 'QAS 505', 'EDM F11.2'],
        subSteps: [
          {
            id: 'bw-2-1',
            text: 'Install all ground wires first. Bus Bar wires route to the top (space permitting).',
            isBold: true
          },
          {
            id: 'bw-2-2',
            text: 'Verify ground wire terminations are secure. Perform pull test.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'box-wire-3',
        number: 3,
        title: 'Install jumpers and internal wiring',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: 'bw-3-1',
            text: 'Install all internal jumpers per wire list.'
          },
          {
            id: 'bw-3-2',
            text: 'Install resistors and diodes. Verify polarity is correct.',
            isBold: true
          },
          {
            id: 'bw-3-3',
            text: 'All wires require a pull test to ensure they are tight.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'box-wire-4',
        number: 4,
        title: 'Wire terminal blocks',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: 'bw-4-1',
            text: 'Wire terminal blocks starting with smaller gauge wires (20ga) first.',
            isBold: true
          },
          {
            id: 'bw-4-2',
            text: 'Continue with larger gauge wires progressively.'
          },
          {
            id: 'bw-4-3',
            text: 'Ensure all circuit numbers are visible on terminal markers.',
            isKeyPoint: true
          },
          {
            id: 'bw-4-4',
            text: 'Perform pull test on all terminations.'
          }
        ]
      },
      {
        id: 'box-wire-5',
        number: 5,
        title: 'Wire relays and components',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: 'bw-5-1',
            text: 'Wire relays and timers per wire list.',
            isBold: true
          },
          {
            id: 'bw-5-2',
            text: 'Use correct hardware (short vs long ferrules, etc.).'
          },
          {
            id: 'bw-5-3',
            text: 'Visual inspection for stray strands (bird caging).',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'box-wire-6',
        number: 6,
        title: 'Install AC wires (if applicable)',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: 'bw-6-1',
            text: 'Install AC (red/blue) wires if required by wire list.'
          },
          {
            id: 'bw-6-2',
            text: 'Maintain separation from DC (white) wires.',
            isKeyPoint: true
          },
          {
            id: 'bw-6-3',
            text: 'Use expando sleeving for sharp edge protection where needed.',
            isBold: true
          }
        ]
      },
      {
        id: 'box-wire-7',
        number: 7,
        title: 'Install external cables',
        symbol: 'star',
        references: ['QAS 503', 'QAS 505', 'QAS 834'],
        subSteps: [
          {
            id: 'bw-7-1',
            text: 'Route cables through glands. Do not over-tighten glands.'
          },
          {
            id: 'bw-7-2',
            text: 'Terminate cables at terminal blocks per wire list.',
            isBold: true
          },
          {
            id: 'bw-7-3',
            text: 'Apply cable labels per shop floor examples.'
          },
          {
            id: 'bw-7-4',
            text: 'Ensure cable shields are properly grounded if required.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'box-wire-8',
        number: 8,
        title: 'Clean and complete box wiring',
        symbol: 'star',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: 'bw-8-1',
            text: 'Ensure all shortages are documented.'
          },
          {
            id: 'bw-8-2',
            text: 'Look over box and verify it is completely wired per wire list. Document discrepancies with MRCA#.',
            isBold: true
          },
          {
            id: 'bw-8-3',
            text: 'Stamp the Wiring portion of the Box ID label.'
          },
          {
            id: 'bw-8-4',
            text: 'Notify Team Leader/Lead that the box is ready for visual inspection.',
            isKeyPoint: true
          }
        ]
      }
    ]
  }
]

export function createFreshBoxWireSwsCopy(): SwsSection[] {
  return JSON.parse(JSON.stringify(BOX_WIRE_SWS))
}
