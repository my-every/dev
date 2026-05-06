export type WorkspaceUserRecord = {
    badge: string;
    fullName: string;
    preferredName?: string | null;
    initials?: string | null;
    role: string;
    shift?: string | null;
    primaryLwc?: string | null;
    email?: string | null;
    phone?: string | null;
    bio?: string | null;
    department?: string | null;
    title?: string | null;
    location?: string | null;
    hireDate?: string | null;
    yearsExperience?: number | null;
    skills?: Record<string, number> | null;
    lastLoginAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type WorkspaceUserSettingsRecord = {
    shift?: string | null;
    permissions?: Record<string, unknown> | null;
    role?: string | null;
    preferences?: Record<string, unknown> | null;
    [key: string]: unknown;
};
