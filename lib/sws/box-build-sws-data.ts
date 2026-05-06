import type { SwsSection } from '@/components/d380/sws/sws-work-execution-table'

// ============================================================================
// BOX BUILD SWS DATA
// Based on Box-Build.pdf - Enclosure/Junction Box Assembly
// ============================================================================

export const BOX_BUILD_SWS: SwsSection[] = [
  {
    id: 'box-build-up',
    title: 'Box Build Up',
    phase: 'build-up',
    elements: [
      {
        id: 'box-element-1',
        number: 1,
        title: 'Obtain the kitted parts from the rack. Verify the PD#. Review the Layout, check for discrepancies.',
        symbol: 'circle',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: 'box-1-1',
            text: 'Verify the latest Revision (check the cover sheet for any special requirements). Fill in the Project information above on this form.',
            isBold: true
          },
          {
            id: 'box-1-2',
            text: 'Stamp the layout drawing with the "Working Copy" stamp and fill in the information.',
            isBold: true
          },
          {
            id: 'box-1-3',
            text: 'Verify the correct box - attach the box ID label and fill in the project information.'
          },
          {
            id: 'box-1-4',
            text: 'Notify the Team Leader/Lead about discrepancies (Missing Parts, etc.).',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'box-element-2',
        number: 2,
        title: 'Prepare the enclosure for assembly',
        symbol: 'diamond',
        references: ['QAS 500'],
        subSteps: [
          {
            id: 'box-2-1',
            text: 'Inspect the enclosure for damage, dents, or defects. Report any issues to Team Leader.'
          },
          {
            id: 'box-2-2',
            text: 'Remove packaging materials and protective covers. Clean any debris from inside the enclosure.'
          },
          {
            id: 'box-2-3',
            text: 'Verify all mounting holes are clear and threaded correctly.',
            isBold: true
          }
        ]
      },
      {
        id: 'box-element-3',
        number: 3,
        title: 'Install the back panel mounting hardware',
        symbol: 'diamond',
        references: ['EDM F11.2', 'QAS 500'],
        subSteps: [
          {
            id: 'box-3-1',
            text: 'Install standoffs at the correct locations per the layout drawing.',
            isBold: true
          },
          {
            id: 'box-3-2',
            text: 'Verify standoff heights match the component requirements.'
          },
          {
            id: 'box-3-3',
            text: 'Install grounding hardware and ensure proper bonding to enclosure.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'box-element-4',
        number: 4,
        title: 'Install DIN rails per the layout drawing',
        symbol: 'diamond',
        references: ['QAS 500'],
        subSteps: [
          {
            id: 'box-4-1',
            text: 'Cut DIN rails to the required length per layout.'
          },
          {
            id: 'box-4-2',
            text: 'Install rail end caps before mounting.'
          },
          {
            id: 'box-4-3',
            text: 'Mount rails at correct positions. Verify alignment and secure fastening.',
            isBold: true
          }
        ]
      },
      {
        id: 'box-element-5',
        number: 5,
        title: 'Install all box mounted components',
        symbol: 'star',
        references: ['QAS 500', 'QAS 850'],
        subSteps: [
          {
            id: 'box-5-1',
            text: 'Install terminal blocks per the layout drawing. Verify marker strips are installed.'
          },
          {
            id: 'box-5-2',
            text: 'Install relays, fuses, and other rail-mounted components.',
            isBold: true
          },
          {
            id: 'box-5-3',
            text: 'Install any panel-mounted components (disconnect switches, breakers, etc.).'
          },
          {
            id: 'box-5-4',
            text: 'Verify component placement matches layout. Components should be accessible.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'box-element-6',
        number: 6,
        title: 'Install cable glands and conduit fittings',
        symbol: 'diamond',
        references: ['QAS 500', 'EDM F11.2'],
        subSteps: [
          {
            id: 'box-6-1',
            text: 'Install cable glands at designated entry points per layout.'
          },
          {
            id: 'box-6-2',
            text: 'Verify gland sizes match cable diameters specified.'
          },
          {
            id: 'box-6-3',
            text: 'Install any conduit adapters or fittings as required.',
            isBold: true
          }
        ]
      },
      {
        id: 'box-element-7',
        number: 7,
        title: 'Install component labels',
        symbol: 'circle',
        references: ['QAS 834'],
        subSteps: [
          {
            id: 'box-7-1',
            text: 'Install blue component labels using the label installation tool.',
            isBold: true
          },
          {
            id: 'box-7-2',
            text: 'Verify labels are visible and properly positioned.'
          }
        ]
      },
      {
        id: 'box-element-8',
        number: 8,
        title: 'Clean and complete the box build',
        symbol: 'diamond',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: 'box-8-1',
            text: 'Clean all debris from the enclosure.'
          },
          {
            id: 'box-8-2',
            text: 'Look over box and verify it is built to print. Document any discrepancies with an MRCA#.',
            isBold: true
          },
          {
            id: 'box-8-3',
            text: 'Stamp the Build Up portion of the Box ID label.'
          },
          {
            id: 'box-8-4',
            text: 'Notify Team Leader/Lead of any shortages and that the box is ready for wiring.',
            isKeyPoint: true
          }
        ]
      }
    ]
  }
]

export function createFreshBoxBuildSwsCopy(): SwsSection[] {
  return JSON.parse(JSON.stringify(BOX_BUILD_SWS))
}
