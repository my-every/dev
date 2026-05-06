import type { SwsSection } from '@/components/d380/sws/sws-work-execution-table'

// ============================================================================
// CONSOLE CROSS-WIRE SWS DATA
// Based on Console-Cross-Wire.pdf - Console Inter-Panel Wiring
// ============================================================================

export const CONSOLE_CROSS_WIRE_SWS: SwsSection[] = [
  {
    id: 'console-cross-wire',
    title: 'Console Cross-Wire',
    phase: 'wiring',
    elements: [
      {
        id: 'xwire-element-1',
        number: 1,
        title: 'Prepare for cross-wiring. Verify project information.',
        symbol: 'arrow',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: 'xw-1-1',
            text: 'Fill in the Project information above on this form.'
          },
          {
            id: 'xw-1-2',
            text: 'Ensure Console Build/Hang is complete. Notify Team Leader if not completed.',
            isKeyPoint: true
          },
          {
            id: 'xw-1-3',
            text: 'Verify the latest revision of cross-wire list.',
            isBold: true
          },
          {
            id: 'xw-1-4',
            text: 'Stamp working copy of cross-wire list. Highlight your badge number.'
          },
          {
            id: 'xw-1-5',
            text: 'Identify wire routing paths between panels. Standard: Left to Right, Top to Bottom.'
          }
        ]
      },
      {
        id: 'xwire-element-2',
        number: 2,
        title: 'Install cross-wire ground connections',
        symbol: 'diamond',
        references: ['QAS 503', 'QAS 505', 'EDM F11.2'],
        subSteps: [
          {
            id: 'xw-2-1',
            text: 'Install ground cross-wires first between panels.',
            isBold: true
          },
          {
            id: 'xw-2-2',
            text: 'Route ground wires through designated cable trays or wireways.'
          },
          {
            id: 'xw-2-3',
            text: 'Perform pull test on all ground terminations.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'xwire-element-3',
        number: 3,
        title: 'Install DC cross-wires (white)',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: 'xw-3-1',
            text: 'Install DC (white) cross-wires starting with smaller gauge (20ga) first.',
            isBold: true
          },
          {
            id: 'xw-3-2',
            text: 'Progress to larger gauge wires.'
          },
          {
            id: 'xw-3-3',
            text: 'All wires require a pull test to ensure they are tight.',
            isKeyPoint: true
          },
          {
            id: 'xw-3-4',
            text: 'Visual inspection for stray strands (bird caging).'
          },
          {
            id: 'xw-3-5',
            text: 'Maintain wire color coding. Do not use wrong color wire.'
          }
        ]
      },
      {
        id: 'xwire-element-4',
        number: 4,
        title: 'Install AC cross-wires (red/blue)',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: 'xw-4-1',
            text: 'Install AC (red/blue) cross-wires per wire list.',
            isBold: true
          },
          {
            id: 'xw-4-2',
            text: 'Maintain separation from DC (white) wires throughout routing.',
            isKeyPoint: true
          },
          {
            id: 'xw-4-3',
            text: 'Use expando sleeving for sharp edge protection where wires exit panels.'
          },
          {
            id: 'xw-4-4',
            text: 'Perform pull test on all AC terminations.'
          }
        ]
      },
      {
        id: 'xwire-element-5',
        number: 5,
        title: 'Install communication and signal cables',
        symbol: 'star',
        references: ['QAS 503', 'QAS 505', 'QAS 834'],
        subSteps: [
          {
            id: 'xw-5-1',
            text: 'Install communication cables between panels.',
            isBold: true
          },
          {
            id: 'xw-5-2',
            text: 'Route away from power wiring to minimize interference.'
          },
          {
            id: 'xw-5-3',
            text: 'Ground cable shields at one end only unless specified otherwise.',
            isKeyPoint: true
          },
          {
            id: 'xw-5-4',
            text: 'Apply cable labels per shop floor examples.'
          }
        ]
      },
      {
        id: 'xwire-element-6',
        number: 6,
        title: 'Install external cables leaving console',
        symbol: 'star',
        references: ['QAS 503', 'QAS 505', 'QAS 834'],
        subSteps: [
          {
            id: 'xw-6-1',
            text: 'Route external cables through designated exit points.',
            isBold: true
          },
          {
            id: 'xw-6-2',
            text: 'Apply cable tags with destination information.'
          },
          {
            id: 'xw-6-3',
            text: 'Bundle cables leaving to same destination together.',
            isKeyPoint: true
          },
          {
            id: 'xw-6-4',
            text: 'Secure cables with ty-wraps at regular intervals.'
          }
        ]
      },
      {
        id: 'xwire-element-7',
        number: 7,
        title: 'Dress and secure all wiring',
        symbol: 'diamond',
        references: ['QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: 'xw-7-1',
            text: 'Dress wires neatly in cable trays and wireways.'
          },
          {
            id: 'xw-7-2',
            text: 'Secure wires with ty-wraps. Do not over-tighten.',
            isBold: true
          },
          {
            id: 'xw-7-3',
            text: 'Verify no wires are pinched or damaged.'
          },
          {
            id: 'xw-7-4',
            text: 'Maintain minimum bend radius on all cables.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'xwire-element-8',
        number: 8,
        title: 'Clean and complete cross-wiring',
        symbol: 'star',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: 'xw-8-1',
            text: 'Ensure all shortages are documented.'
          },
          {
            id: 'xw-8-2',
            text: 'Verify console is completely cross-wired per wire list. Document discrepancies with MRCA#.',
            isBold: true
          },
          {
            id: 'xw-8-3',
            text: 'Stamp the Cross-Wire portion of the Console ID label.'
          },
          {
            id: 'xw-8-4',
            text: 'Notify Team Leader/Lead that the console is ready for visual inspection.',
            isKeyPoint: true
          }
        ]
      }
    ]
  }
]

export function createFreshConsoleCrossWireSwsCopy(): SwsSection[] {
  return JSON.parse(JSON.stringify(CONSOLE_CROSS_WIRE_SWS))
}
