import type { SwsSection } from '@/components/d380/sws/sws-work-execution-table'

// ============================================================================
// RAIL BUILD & WIRE SWS DATA
// Based on Rail-Build-Wire.pdf - DIN Rail Assembly and Wiring
// ============================================================================

export const RAIL_BUILD_WIRE_SWS: SwsSection[] = [
  // =========================================================================
  // SECTION 1: RAIL BUILD UP
  // =========================================================================
  {
    id: 'rail-build-up',
    title: 'Rail Build Up',
    phase: 'build-up',
    elements: [
      {
        id: 'rail-element-1',
        number: 1,
        title: 'Obtain the kitted parts. Verify the PD#. Review the Layout.',
        symbol: 'circle',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: 'rail-1-1',
            text: 'Verify the latest Revision (check the cover sheet for any special requirements).',
            isBold: true
          },
          {
            id: 'rail-1-2',
            text: 'Fill in the Project information on this form.'
          },
          {
            id: 'rail-1-3',
            text: 'Stamp the layout drawing with the "Working Copy" stamp.'
          },
          {
            id: 'rail-1-4',
            text: 'Notify the Team Leader/Lead about discrepancies (Missing Parts, etc.).',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'rail-element-2',
        number: 2,
        title: 'Prepare the DIN rail assembly',
        symbol: 'diamond',
        references: ['QAS 500'],
        subSteps: [
          {
            id: 'rail-2-1',
            text: 'Cut DIN rail to the specified length per layout.',
            isBold: true
          },
          {
            id: 'rail-2-2',
            text: 'Deburr cut edges to prevent injury and component damage.'
          },
          {
            id: 'rail-2-3',
            text: 'Install rail end caps.'
          },
          {
            id: 'rail-2-4',
            text: 'Mark component positions on rail per layout if needed.'
          }
        ]
      },
      {
        id: 'rail-element-3',
        number: 3,
        title: 'Install terminal blocks',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 850'],
        subSteps: [
          {
            id: 'rail-3-1',
            text: 'Install terminal blocks per the layout drawing.',
            isBold: true
          },
          {
            id: 'rail-3-2',
            text: 'Verify terminal block types match the BOM.'
          },
          {
            id: 'rail-3-3',
            text: 'Install terminal marker strips. Verify all markers are correct.',
            isKeyPoint: true
          },
          {
            id: 'rail-3-4',
            text: 'Install end brackets to secure terminal block assembly.'
          }
        ]
      },
      {
        id: 'rail-element-4',
        number: 4,
        title: 'Install rail-mounted components',
        symbol: 'star',
        references: ['QAS 500', 'QAS 850'],
        subSteps: [
          {
            id: 'rail-4-1',
            text: 'Install relays, fuses, and other rail-mounted components per layout.',
            isBold: true
          },
          {
            id: 'rail-4-2',
            text: 'Components start at the marked position unless dimensioned otherwise.'
          },
          {
            id: 'rail-4-3',
            text: 'Install fuse amperage labels if applicable.',
            isKeyPoint: true
          },
          {
            id: 'rail-4-4',
            text: 'Verify component orientation is correct.'
          }
        ]
      },
      {
        id: 'rail-element-5',
        number: 5,
        title: 'Install component labels',
        symbol: 'circle',
        references: ['QAS 834'],
        subSteps: [
          {
            id: 'rail-5-1',
            text: 'Install blue component labels using the label installation tool.',
            isBold: true
          },
          {
            id: 'rail-5-2',
            text: 'Verify labels are visible and positioned correctly.'
          }
        ]
      },
      {
        id: 'rail-element-6',
        number: 6,
        title: 'Complete rail build',
        symbol: 'diamond',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: 'rail-6-1',
            text: 'Verify rail assembly is built to print.',
            isBold: true
          },
          {
            id: 'rail-6-2',
            text: 'Document any discrepancies with MRCA#.'
          },
          {
            id: 'rail-6-3',
            text: 'Stamp the Build Up portion of the Rail ID label.'
          },
          {
            id: 'rail-6-4',
            text: 'Notify Team Leader/Lead that the rail is ready for wiring.',
            isKeyPoint: true
          }
        ]
      }
    ]
  },
  
  // =========================================================================
  // SECTION 2: RAIL WIRING
  // =========================================================================
  {
    id: 'rail-wiring',
    title: 'Rail Wiring',
    phase: 'wiring',
    elements: [
      {
        id: 'rail-wire-1',
        number: 7,
        title: 'Prepare to wire the rail assembly',
        symbol: 'arrow',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: 'rw-1-1',
            text: 'Ensure Build Up is complete. Notify Team Leader if not completed.',
            isKeyPoint: true
          },
          {
            id: 'rw-1-2',
            text: 'Verify the latest revision of wire list.',
            isBold: true
          },
          {
            id: 'rw-1-3',
            text: 'Stamp working copy of wire list. Highlight your badge number.'
          }
        ]
      },
      {
        id: 'rail-wire-2',
        number: 8,
        title: 'Install jumpers and ground wires',
        symbol: 'diamond',
        references: ['QAS 503', 'QAS 505', 'EDM F11.2'],
        subSteps: [
          {
            id: 'rw-2-1',
            text: 'Install all ground jumpers first.',
            isBold: true
          },
          {
            id: 'rw-2-2',
            text: 'Install terminal block jumpers per wire list.'
          },
          {
            id: 'rw-2-3',
            text: 'Perform pull test on all terminations.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'rail-wire-3',
        number: 9,
        title: 'Wire terminal blocks and components',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: 'rw-3-1',
            text: 'Wire starting with smaller gauge (20ga) first, progress to larger.',
            isBold: true
          },
          {
            id: 'rw-3-2',
            text: 'Install resistors and diodes. Verify polarity is correct.'
          },
          {
            id: 'rw-3-3',
            text: 'All wires require a pull test. Visual for bird caging.',
            isKeyPoint: true
          },
          {
            id: 'rw-3-4',
            text: 'Ensure circuit numbers are visible on all terminals.'
          }
        ]
      },
      {
        id: 'rail-wire-4',
        number: 10,
        title: 'Install pigtails and external connections',
        symbol: 'star',
        references: ['QAS 503', 'QAS 505', 'QAS 834'],
        subSteps: [
          {
            id: 'rw-4-1',
            text: 'Install pigtail wires that will connect to external equipment.',
            isBold: true
          },
          {
            id: 'rw-4-2',
            text: 'Apply wire labels per shop floor examples.'
          },
          {
            id: 'rw-4-3',
            text: 'Bundle pigtails neatly for shipping.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'rail-wire-5',
        number: 11,
        title: 'Complete rail wiring',
        symbol: 'star',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: 'rw-5-1',
            text: 'Ensure all shortages are documented.'
          },
          {
            id: 'rw-5-2',
            text: 'Verify rail is completely wired per wire list. Document discrepancies with MRCA#.',
            isBold: true
          },
          {
            id: 'rw-5-3',
            text: 'Stamp the Wiring portion of the Rail ID label.'
          },
          {
            id: 'rw-5-4',
            text: 'Notify Team Leader/Lead that the rail is ready for inspection.',
            isKeyPoint: true
          }
        ]
      }
    ]
  }
]

export function createFreshRailBuildWireSwsCopy(): SwsSection[] {
  return JSON.parse(JSON.stringify(RAIL_BUILD_WIRE_SWS))
}
