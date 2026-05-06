export interface SkillDefinitionLevel {
    level: number;
    name: string;
    description?: string;
}

export interface SkillDefinition {
    id: string;
    name: string;
    category: string;
    description?: string;
    levels: SkillDefinitionLevel[];
    createdAt?: string;
    updatedAt?: string;
}
