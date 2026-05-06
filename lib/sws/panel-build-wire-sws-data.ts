import type { SwsSection, WorkElement, SubStep } from '@/components/d380/sws/sws-work-execution-table'

// ============================================================================
// PANEL BUILD & WIRE SWS DATA (Verbatim from SWS-IPV_D380_ASY_PNL BUILD-WIRE_1.2)
// ============================================================================

export const PANEL_BUILD_WIRE_SWS: SwsSection[] = [
  // =========================================================================
  // SECTION 1: BUILD UP (Steps 1-9)
  // =========================================================================
  {
    id: 'build-up',
    title: 'Build Up',
    phase: 'build-up',
    elements: [
      {
        id: 'element-1',
        number: 1,
        title: 'Obtain the kitted parts from the rack. Verify the PD#. Review the Layout, check for discrepancies.',
        symbol: 'circle',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: '1-1',
            text: 'Verify the latest Revision (check the cover sheet for any special requirements). Fill in the Project information above on this form.',
            isBold: true
          },
          {
            id: '1-2',
            text: 'Stamp the layout drawing with the "Working Copy" stamp and fill in the information.',
            isBold: true
          },
          {
            id: '1-3',
            text: 'Verify the correct panel - attach the panel ID label and fill in the project information.(Do not install directly to the panel).'
          },
          {
            id: '1-4',
            text: 'Notify the Team Leader/Lead about discrepancies (Missing Parts,ect.). Follow the first unit on a multi-unit project.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'element-2',
        number: 2,
        title: 'Prepare to build the panel',
        symbol: 'diamond',
        references: ['QAS 500'],
        subSteps: [
          {
            id: '2-1',
            text: 'Measure, cut and pre-lay out rails, large components and panduct to verify fit for both pre and non-pre drilled (template) panels.'
          },
          {
            id: '2-2',
            text: '1. Verify no drill zones using the overall layout for non-pre-drilled panels. Unistruts are shown on overall layout for consoles.',
            isBold: true
          },
          {
            id: '2-3',
            text: '2. Mark any panduct that covers a mounting hole through the under side of the panel. For all Products (OnSkid), ensure the center mounting holes are open (vertical panduct).',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'element-3',
        number: 3,
        title: 'Drill and Bond the Panel according to the layout (overall layout if off-skid) for Frame Ground.',
        symbol: 'diamond',
        references: ['EDM F11.2 SFT'],
        specialVerification: '3/8" Nutcert Verification',
        subSteps: [
          {
            id: '3-1',
            text: 'Using a vice, drill the rails, install nutcerts and end caps and bond the panel.',
            isBold: true
          },
          {
            id: '3-2',
            text: '1. Remove the painted surfaces for the installation of the frame grounds (bonding). Clean the debris from the panel.'
          },
          {
            id: '3-3',
            text: '2. For the Panel Hanging Holes, or any 3/8" hole, ensure nutcerts are properly seated. Get visual stamp in Auditor column.',
            isKeyPoint: true,
            requiresVerification: 'nutcert'
          }
        ],
        notes: ['See Standard Work Book for details on part installation']
      },
      {
        id: 'element-4',
        number: 4,
        title: 'Install all panel mounted components (i.e. PLC Chassis, Power Supply, Fan, Filter, Bus Bar, BUOS, CGCM, Shunt Relay, Pnl Mount Diode, etc.)',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 850', 'EDM F11.02'],
        subSteps: [
          {
            id: '4-1',
            text: 'Install all panel mounted components (ensure there is enough clearance between the Bus Bar and rail).'
          },
          {
            id: '4-2',
            text: '1. Install short standoffs in the holes for the shock guard.'
          },
          {
            id: '4-3',
            text: '2. Ensure ground checks are conducted if required.'
          },
          {
            id: '4-4',
            text: '3. Secure the PLC keys to the chassis so they do not get lost.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'element-5',
        number: 5,
        title: 'Install the standoffs, din rails, and ground wires per layout drawing.',
        symbol: 'diamond',
        references: ['QAS 500', 'EDM F11.2'],
        subSteps: [
          {
            id: '5-1',
            text: 'Install the standoffs, rails, frame grounds and ground hardware.'
          }
        ]
      },
      {
        id: 'element-6',
        number: 6,
        title: 'Install all rail mounted components per the layout drawing.',
        symbol: 'star',
        references: ['QAS 500'],
        specialVerification: '1444 Verification',
        subSteps: [
          {
            id: '6-1',
            text: 'Install rail mounted components per the layout drawing. All components start at the top of rails unless dimensioned otherwise or clearly shown starting from the bottom.',
            isKeyPoint: true
          },
          {
            id: '6-2',
            text: '1. Ensure I/O module base dials are set prior to installing the modules.',
            isBold: true
          },
          {
            id: '6-3',
            text: 'For the 1444 Vibration models, ensure the base dials are set per layout drawing prior to installing the modules. Get visual stamp in Auditor column. Verify rail isolation then install component and verify component/rail isolation.',
            isKeyPoint: true,
            requiresVerification: '1444'
          },
          {
            id: '6-4',
            text: '2. Install the fuse, fuse amperage labels and terminal markers.'
          }
        ]
      },
      {
        id: 'element-7',
        number: 7,
        title: 'Install the blue component labels per layout.',
        symbol: 'circle',
        references: ['QAS 834'],
        subSteps: [
          {
            id: '7-1',
            text: 'Install blue component labels using the label installation tool. Follow Shop floor examples (wall/shop aids). Verify labels will be visible after the panduct is installed',
            isBold: true
          }
        ]
      },
      {
        id: 'element-8',
        number: 8,
        title: 'Install and secure the panduct',
        symbol: 'star',
        references: ['QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: '8-1',
            text: 'Using the panduct finger cutters, remove any fingers that will interfere with the wiring or wire routing.',
            isBold: true
          },
          {
            id: '8-2',
            text: '1. Install the panduct. Ensure Labels are visible and it is not touching or is interfering with the operation of the components.',
            isKeyPoint: true
          },
          {
            id: '8-3',
            text: 'Label all part shortages with a sticker and document in the comment section to the right'
          }
        ]
      },
      {
        id: 'element-9',
        number: 9,
        title: 'Clean the debris and complete the panel.',
        symbol: 'diamond',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: '9-1',
            text: '1. Look over panel and verify it is built to print. All discrepancies/deviations documented with an MRCA#.',
            isBold: true
          },
          {
            id: '9-2',
            text: '2. Stamp the Build Up portion of the Panel ID label'
          },
          {
            id: '9-3',
            text: '3. Notify Team Leader/Lead of any shortages, issues and the panel is ready for visual inspection. (Team Leader/Lead will assign)',
            isKeyPoint: true
          }
        ]
      }
    ]
  },
  
  // =========================================================================
  // SECTION 2: WIRING (Steps 10-17)
  // =========================================================================
  {
    id: 'wiring',
    title: 'Wiring',
    phase: 'wiring',
    elements: [
      {
        id: 'element-10',
        number: 10,
        title: 'Prepare to wire the panel. Verify if it is a multi-unit project.',
        symbol: 'arrow',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: '10-1',
            text: 'Fill in the Project information above on this form'
          },
          {
            id: '10-2',
            text: 'Ensure Auditor stamp is complete for Panel Build prior to starting the wiring. Notify Team Leader if not completed.',
            isKeyPoint: true
          },
          {
            id: '10-3',
            text: '1. Verify the latest revision. Note cover sheet for any special requirements'
          },
          {
            id: '10-4',
            text: '2. Stamp working copy of wire list and layout drawing. Highlight your badge number with the same color you will use on the wire list',
            isBold: true
          },
          {
            id: '10-5',
            text: '3. For multi unit project, verify routing on the first unit. Notify Team Leader if incorrect. Wires will route under the rail first for any component that does not have panduct next to it'
          }
        ]
      },
      {
        id: 'element-11',
        number: 11,
        title: 'Start wiring the panel',
        symbol: 'diamond',
        references: ['QAS 503', 'QAS 505', 'QAS 850', 'EDM F11.2'],
        notes: [
          'Highlight all wires or components (resistors, diodes, etc.) installed throughout the wiring process using the same color used to highlight your badge number. All wires leaving',
          'For OffSkid consoles, check overall layout to verify wire routing. Standard routing is Left to Right, Top to Bottom'
        ],
        subSteps: [
          {
            id: '11-1',
            text: 'Install all ground wires. Console - Bus Bar wires route to the bottom. Boxes - Bus Bar wires will route to the top. (Space permitting)'
          },
          {
            id: '11-2',
            text: 'Install all jumpers, both mechanical and wires including thermistors as required, resistors and diodes (verify polarity).'
          }
        ]
      },
      {
        id: 'element-12',
        number: 12,
        title: 'Wire the relays/timers',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: '12-1',
            text: 'All wires being installed require a pull test to ensure they are tight and a visual for stray strands (bird caging)',
            isKeyPoint: true
          },
          {
            id: '12-2',
            text: 'Start wiring relays and timers. This will include 14/16ga. Use the correct hardware (short vs long ferrules,etc). Do not wire the Sync Check Relay (Red or Blue AC wires). Ensure all circuit numbers are visible',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'element-13',
        number: 13,
        title: 'Wire the BUOS/Continue with the smaller gauge wires',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        specialVerification: 'AENTR ONLY Pull/Torque Test, 0v, 24v & gnd',
        subSteps: [
          {
            id: '13-1',
            text: 'All wires being installed require a pull test to ensure they are tight and a visual for stray strands (bird caging)',
            isKeyPoint: true
          },
          {
            id: '13-2',
            text: 'Wire and create harness for the Back Up Overspeed Module. Terminate as required.'
          },
          {
            id: '13-3',
            text: 'Install the remaining wires starting with smaller wires (20ga) first and continuing progressing up in size until all white wires have been installed'
          },
          {
            id: '13-4',
            text: '1. Maintain IS (blue panduct wiring) separation if required.',
            isBold: true
          }
        ]
      },
      {
        id: 'element-14',
        number: 14,
        title: 'Wire Flyback Diodes and Install AC wires',
        symbol: 'diamond',
        references: ['QAS 500', 'QAS 503', 'QAS 505'],
        notes: ['Any wire or cable that deforms the panduct must have the panduct finger removed to allow the wire(s) to lay flat.'],
        subSteps: [
          {
            id: '14-1',
            text: 'All wires being installed require a pull test to ensure they are tight and a visual for stray strands (bird caging)',
            isKeyPoint: true
          },
          {
            id: '14-2',
            text: 'Wire the Flyback Diodes per wire list. Ensure circuit numbers and polarity on the component is visible.'
          },
          {
            id: '14-3',
            text: 'Install the AC (red/blue) wires starting from the DECS. Use expando sleeving for sharp edge protection or isolation. Maintain separation from the white wires',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'element-15',
        number: 15,
        title: 'Install cables and internal communication cables',
        symbol: 'star',
        references: ['QAS 503', 'QAS 505', 'QAS 834'],
        subSteps: [
          {
            id: '15-1',
            text: 'Install all cables. Install smaller, then larger cables followed by all communication cables that will terminate within the panel. Apply labels per shop floor example.'
          },
          {
            id: '15-2',
            text: 'Ensure all shortages are documented.',
            isBold: true
          }
        ]
      },
      {
        id: 'element-16',
        number: 16,
        title: 'Clean the debris and complete the panel',
        symbol: 'star',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: '16-1',
            text: 'Look over panel and verify it is completely wired per wire list. All discrepancies/deviations documented with an MRCA#',
            isBold: true
          },
          {
            id: '16-2',
            text: '1. Stamp the wiring portion of the Panel ID label'
          },
          {
            id: '16-3',
            text: '2. Notify Team Leader/Lead of any shortages, issues and the panel is ready for visual inspection. (Team Leader/Lead will assign)',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'element-17',
        number: 17,
        title: 'Stamp as complete.',
        symbol: 'star',
        references: ['WI 5.7.2-01', 'WI 5.7.2-05'],
        subSteps: [
          {
            id: '17-1',
            text: 'Auditor: Stamp the IPV portion of the panel ID label. Ensure wires and a visual for bird caging and insulation crimping.',
            isKeyPoint: true
          }
        ]
      }
    ]
  }
]

// Discrepancy codes from the SWS form
export const DISCREPANCY_CODES = [
  'CD', 'CH', 'CW', 'CM', 'LA', 'LD', 'LI', 'LM', 'LV', 'PC',
  'PH', 'PP', 'PS', 'PT', 'PTW', 'WB', 'WC', 'WE', 'WF', 'WG', 'WI',
  'WJ', 'WL', 'WM', 'WP', 'WT', 'OTHER'
]

// Helper to create a fresh copy with no completions
export function createFreshSwsCopy(): SwsSection[] {
  return JSON.parse(JSON.stringify(PANEL_BUILD_WIRE_SWS))
}
