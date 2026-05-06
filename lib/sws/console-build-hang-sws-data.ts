import type { SwsSection } from '@/components/d380/sws/sws-work-execution-table'

// ============================================================================
// CONSOLE BUILD & HANG SWS DATA
// Based on Console-Build-Hang.pdf - Console Panel Assembly and Hanging
// ============================================================================

export const CONSOLE_BUILD_HANG_SWS: SwsSection[] = [
  {
    id: 'console-build-up',
    title: 'Console Build Up',
    phase: 'build-up',
    elements: [
      {
        id: 'console-element-1',
        number: 1,
        title: 'Obtain the kitted parts from the rack. Verify the PD#. Review the Layout, check for discrepancies.',
        symbol: 'circle',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: 'con-1-1',
            text: 'Verify the latest Revision (check the cover sheet for any special requirements). Fill in the Project information above on this form.',
            isBold: true
          },
          {
            id: 'con-1-2',
            text: 'Stamp the layout drawing with the "Working Copy" stamp and fill in the information.'
          },
          {
            id: 'con-1-3',
            text: 'Verify the correct console panel - attach the panel ID label and fill in project information.'
          },
          {
            id: 'con-1-4',
            text: 'Notify the Team Leader/Lead about discrepancies (Missing Parts, etc.). Follow the first unit on a multi-unit project.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'console-element-2',
        number: 2,
        title: 'Prepare the console frame',
        symbol: 'diamond',
        references: ['QAS 500', 'EDM F11.2'],
        subSteps: [
          {
            id: 'con-2-1',
            text: 'Inspect console frame for damage or defects. Report any issues to Team Leader.'
          },
          {
            id: 'con-2-2',
            text: 'Verify frame dimensions match layout drawing.',
            isBold: true
          },
          {
            id: 'con-2-3',
            text: 'Install unistruts at correct positions per overall layout.',
            isKeyPoint: true
          },
          {
            id: 'con-2-4',
            text: 'Verify unistrut positions for mounting panels.'
          }
        ]
      },
      {
        id: 'console-element-3',
        number: 3,
        title: 'Prepare panels for mounting',
        symbol: 'diamond',
        references: ['QAS 500', 'EDM F11.2'],
        specialVerification: '3/8" Nutcert Verification',
        subSteps: [
          {
            id: 'con-3-1',
            text: 'Drill panel hanging holes if not pre-drilled.',
            isBold: true
          },
          {
            id: 'con-3-2',
            text: 'Install nutcerts in hanging holes. Verify 3/8" nutcerts are properly seated.',
            isKeyPoint: true,
            requiresVerification: 'nutcert'
          },
          {
            id: 'con-3-3',
            text: 'Install bonding hardware on panels for frame ground connections.'
          },
          {
            id: 'con-3-4',
            text: 'Clean debris from panels before mounting.'
          }
        ]
      },
      {
        id: 'console-element-4',
        number: 4,
        title: 'Hang panels in console frame',
        symbol: 'star',
        references: ['QAS 500', 'EDM F11.2'],
        subSteps: [
          {
            id: 'con-4-1',
            text: 'Install panel mounting hardware on unistruts.',
            isBold: true
          },
          {
            id: 'con-4-2',
            text: 'Hang panels in correct sequence per layout drawing. Start from the bottom.',
            isKeyPoint: true
          },
          {
            id: 'con-4-3',
            text: 'Verify panel alignment and spacing. Adjust as needed.'
          },
          {
            id: 'con-4-4',
            text: 'Secure all panel mounting hardware. Do not overtighten.'
          }
        ]
      },
      {
        id: 'console-element-5',
        number: 5,
        title: 'Install frame ground wiring',
        symbol: 'diamond',
        references: ['QAS 500', 'EDM F11.2'],
        subSteps: [
          {
            id: 'con-5-1',
            text: 'Install frame ground wires between panels and console frame.',
            isBold: true
          },
          {
            id: 'con-5-2',
            text: 'Verify bonding connections are secure. Remove paint from contact surfaces.',
            isKeyPoint: true
          },
          {
            id: 'con-5-3',
            text: 'Connect ground bus bar if applicable.'
          }
        ]
      },
      {
        id: 'console-element-6',
        number: 6,
        title: 'Install console accessories',
        symbol: 'diamond',
        references: ['QAS 500'],
        subSteps: [
          {
            id: 'con-6-1',
            text: 'Install cable trays or wireways per layout.'
          },
          {
            id: 'con-6-2',
            text: 'Install ventilation fans or filters if required.',
            isBold: true
          },
          {
            id: 'con-6-3',
            text: 'Install lighting fixtures if applicable.'
          },
          {
            id: 'con-6-4',
            text: 'Install any door switches or interlocks.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'console-element-7',
        number: 7,
        title: 'Install console labels and documentation',
        symbol: 'circle',
        references: ['QAS 834'],
        subSteps: [
          {
            id: 'con-7-1',
            text: 'Install console identification labels.',
            isBold: true
          },
          {
            id: 'con-7-2',
            text: 'Install panel position labels for each bay.'
          },
          {
            id: 'con-7-3',
            text: 'Install safety labels and warning signs as required.'
          }
        ]
      },
      {
        id: 'console-element-8',
        number: 8,
        title: 'Clean and complete console build',
        symbol: 'diamond',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: 'con-8-1',
            text: 'Clean all debris from console and panels.'
          },
          {
            id: 'con-8-2',
            text: 'Verify console is built to print. Document any discrepancies with MRCA#.',
            isBold: true
          },
          {
            id: 'con-8-3',
            text: 'Stamp the Build/Hang portion of the Console ID label.'
          },
          {
            id: 'con-8-4',
            text: 'Notify Team Leader/Lead of any shortages and that the console is ready for cross-wiring.',
            isKeyPoint: true
          }
        ]
      }
    ]
  }
]

export function createFreshConsoleBuildHangSwsCopy(): SwsSection[] {
  return JSON.parse(JSON.stringify(CONSOLE_BUILD_HANG_SWS))
}
