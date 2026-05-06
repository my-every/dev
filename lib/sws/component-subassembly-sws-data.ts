import type { SwsSection } from '@/components/d380/sws/sws-work-execution-table'

// ============================================================================
// COMPONENT / SUB-ASSEMBLY SWS DATA
// Based on Component-SubAssembly.pdf - Small Component Assemblies
// ============================================================================

export const COMPONENT_SUBASSEMBLY_SWS: SwsSection[] = [
  {
    id: 'component-assembly',
    title: 'Component / Sub-Assembly',
    phase: 'build-up',
    elements: [
      {
        id: 'comp-element-1',
        number: 1,
        title: 'Obtain the kitted parts. Verify the PD#.',
        symbol: 'circle',
        references: ['WI 5.3.0.5-02'],
        subSteps: [
          {
            id: 'comp-1-1',
            text: 'Verify the latest Revision.',
            isBold: true
          },
          {
            id: 'comp-1-2',
            text: 'Fill in the Project information on this form.'
          },
          {
            id: 'comp-1-3',
            text: 'Verify all parts in the kit match the BOM.',
            isKeyPoint: true
          },
          {
            id: 'comp-1-4',
            text: 'Notify Team Leader/Lead about any discrepancies or missing parts.'
          }
        ]
      },
      {
        id: 'comp-element-2',
        number: 2,
        title: 'Prepare components for assembly',
        symbol: 'diamond',
        references: ['QAS 500'],
        subSteps: [
          {
            id: 'comp-2-1',
            text: 'Inspect components for damage or defects.',
            isBold: true
          },
          {
            id: 'comp-2-2',
            text: 'Report any damaged components to Team Leader.'
          },
          {
            id: 'comp-2-3',
            text: 'Verify component ratings match specifications.'
          },
          {
            id: 'comp-2-4',
            text: 'Organize components for efficient assembly.',
            isKeyPoint: true
          }
        ]
      },
      {
        id: 'comp-element-3',
        number: 3,
        title: 'Assemble components per work instructions',
        symbol: 'star',
        references: ['QAS 500', 'QAS 850'],
        subSteps: [
          {
            id: 'comp-3-1',
            text: 'Follow the work instructions or layout drawing for assembly sequence.',
            isBold: true
          },
          {
            id: 'comp-3-2',
            text: 'Use proper tools and torque specifications where required.'
          },
          {
            id: 'comp-3-3',
            text: 'Verify polarity on polarized components (diodes, capacitors, etc.).',
            isKeyPoint: true
          },
          {
            id: 'comp-3-4',
            text: 'Ensure proper clearances between components.'
          }
        ]
      },
      {
        id: 'comp-element-4',
        number: 4,
        title: 'Install wiring/connections if required',
        symbol: 'diamond',
        references: ['QAS 503', 'QAS 505'],
        subSteps: [
          {
            id: 'comp-4-1',
            text: 'Install any internal wiring per wire list or drawing.',
            isBold: true
          },
          {
            id: 'comp-4-2',
            text: 'Perform pull test on all terminations.'
          },
          {
            id: 'comp-4-3',
            text: 'Visual inspection for stray strands.',
            isKeyPoint: true
          },
          {
            id: 'comp-4-4',
            text: 'Install wire markers or labels as required.'
          }
        ]
      },
      {
        id: 'comp-element-5',
        number: 5,
        title: 'Install labels and identification',
        symbol: 'circle',
        references: ['QAS 834'],
        subSteps: [
          {
            id: 'comp-5-1',
            text: 'Install component identification labels.',
            isBold: true
          },
          {
            id: 'comp-5-2',
            text: 'Install any safety or warning labels.'
          },
          {
            id: 'comp-5-3',
            text: 'Verify labels are visible and properly positioned.'
          }
        ]
      },
      {
        id: 'comp-element-6',
        number: 6,
        title: 'Perform functional test if required',
        symbol: 'star',
        references: ['QAS 850', 'WI 5.7.2-01'],
        subSteps: [
          {
            id: 'comp-6-1',
            text: 'Perform any required functional tests per work instructions.',
            isBold: true
          },
          {
            id: 'comp-6-2',
            text: 'Document test results if required.',
            isKeyPoint: true
          },
          {
            id: 'comp-6-3',
            text: 'Report any failures to Team Leader immediately.'
          }
        ]
      },
      {
        id: 'comp-element-7',
        number: 7,
        title: 'Complete sub-assembly',
        symbol: 'diamond',
        references: ['WI 5.7.2-01'],
        subSteps: [
          {
            id: 'comp-7-1',
            text: 'Verify sub-assembly is built to print.',
            isBold: true
          },
          {
            id: 'comp-7-2',
            text: 'Document any discrepancies with MRCA#.'
          },
          {
            id: 'comp-7-3',
            text: 'Clean any debris from the assembly.'
          },
          {
            id: 'comp-7-4',
            text: 'Stamp completion on the traveler or ID label.',
            isKeyPoint: true
          },
          {
            id: 'comp-7-5',
            text: 'Place completed assembly in designated staging area.'
          }
        ]
      }
    ]
  }
]

export function createFreshComponentSubAssemblySwsCopy(): SwsSection[] {
  return JSON.parse(JSON.stringify(COMPONENT_SUBASSEMBLY_SWS))
}
