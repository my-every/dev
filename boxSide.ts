export const BoxSideConfig = {
    leftDoor: {
        name: 'Left Door',
        description: 'The left door of the box.',
        externalLocations: {
            leftSide: true,
            rightBackSide: true,
            backSide: true,
            topBackSide: true,
            rightSide: true,
            rightDoor: true,
        },
    },  
    leftSide: {
        name: 'Left Side',
        description: 'The left side of the box.',
        externalLocations: {
            leftDoor: false,
            rightBackSide: true,
            backSide: true,
            topBackSide: true,
            rightSide: true,
            rightDoor: false,
        },
    },
    leftBackSide: {
        name: 'Left Back Side',
        description: 'The left back side of the box.',
        externalLocations: {
            leftDoor: false,
            leftSide: false,
            rightBackSide: true,
            backSide: true,
            topBackSide: false,
            rightSide: true,
            rightDoor: false,
        },
    },
    rightBackSide: {
        name: 'Right Back Side',
        description: 'The right back side of the box.',
        externalLocations: {
            leftDoor: false,
            leftSide: false,
            topBackSide: false,
            rightSide: true,
            rightDoor: false,
        },
    },
    rightSide: {
        name: 'Right Side',
        description: 'The right side of the box.',
        externalLocations: {
            leftDoor: false,
            leftSide: false,
            rightBackSide: false,
            backSide: false,
            topBackSide: false,
            rightDoor: false,
        },
    },
    topBackSide: {
        name: 'Top Back Side',
        description: 'The top back side of the box.',
        externalLocations: {
            leftDoor: false,
            leftSide: true,
            rightBackSide: true,
            leftBackSide: true,
            rightSide: true,
            rightDoor: false,
        },
    },
    rightDoor: {
        name: 'Right Door',
        description: 'The right door of the box.',
        externalLocations: {
            leftDoor: false,
            leftSide: false,
            rightBackSide: false,
            topBackSide: false,
            rightSide: true,
            leftBackSide: false,
        },
    },
    backSide: {
        name: 'Back Side',
        description: 'The back side of the box',
        externalLocations: {
            leftDoor: false,
            leftSide: false,
            rightBackSide: true,
            topBackSide: false,
            rightSide: true,
            leftBackSide: true,
        },
    }
} as const;

export type BoxSideName = keyof typeof BoxSideConfig;
