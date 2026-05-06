"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DynamicDetailField } from "./dynamic-detail-field";
import type { DetailSchema, DetailFieldSchema, DetailFieldGroup } from "@/types/parts-library";

interface DynamicDetailsFormProps {
    schema: DetailSchema;
    values: Record<string, unknown>;
    onChange: (values: Record<string, unknown>) => void;
    disabled?: boolean;
}

export function DynamicDetailsForm({
    schema,
    values,
    onChange,
    disabled = false,
}: DynamicDetailsFormProps) {
    // Group fields by their group key
    const groupedFields = useMemo(() => {
        const groups = new Map<string, DetailFieldSchema[]>();
        
        // Initialize groups from schema
        for (const group of schema.groups) {
            groups.set(group.key, []);
        }
        groups.set('_ungrouped', []); // For fields without a group
        
        // Sort fields into groups
        for (const field of schema.fields) {
            const groupKey = field.group ?? '_ungrouped';
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(field);
        }
        
        // Sort fields within each group by order
        for (const [key, fields] of groups) {
            groups.set(
                key,
                fields.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
            );
        }
        
        return groups;
    }, [schema]);
    
    // Sort groups by order
    const sortedGroups = useMemo(() => {
        return [...schema.groups].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }, [schema.groups]);
    
    const handleFieldChange = (key: string, value: unknown) => {
        onChange({ ...values, [key]: value });
    };
    
    // Check if a field should be shown based on showWhen condition
    const shouldShowField = (field: DetailFieldSchema): boolean => {
        if (!field.showWhen) return true;
        return values[field.showWhen.field] === field.showWhen.equals;
    };
    
    return (
        <div className="space-y-6">
            {/* Render ungrouped fields first */}
            {groupedFields.get('_ungrouped')?.length ? (
                <div className="space-y-4">
                    {groupedFields.get('_ungrouped')!.filter(shouldShowField).map((field) => (
                        <DynamicDetailField
                            key={field.key}
                            field={field}
                            value={values[field.key]}
                            onChange={(val) => handleFieldChange(field.key, val)}
                            disabled={disabled}
                        />
                    ))}
                </div>
            ) : null}
            
            {/* Render grouped fields */}
            {sortedGroups.map((group) => {
                const fields = groupedFields.get(group.key) ?? [];
                const visibleFields = fields.filter(shouldShowField);
                
                if (visibleFields.length === 0) return null;
                
                return (
                    <FieldGroup
                        key={group.key}
                        group={group}
                        fields={visibleFields}
                        values={values}
                        onChange={handleFieldChange}
                        disabled={disabled}
                    />
                );
            })}
        </div>
    );
}

// ============================================================================
// FIELD GROUP
// ============================================================================

interface FieldGroupProps {
    group: DetailFieldGroup;
    fields: DetailFieldSchema[];
    values: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
    disabled: boolean;
}

function FieldGroup({
    group,
    fields,
    values,
    onChange,
    disabled,
}: FieldGroupProps) {
    if (group.collapsible) {
        return (
            <Collapsible defaultOpen={!group.defaultCollapsed}>
                <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                        <div>
                            <h4 className="text-sm font-semibold">{group.label}</h4>
                            {group.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {group.description}
                                </p>
                            )}
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2 space-y-4 border-t">
                            {fields.map((field) => (
                                <DynamicDetailField
                                    key={field.key}
                                    field={field}
                                    value={values[field.key]}
                                    onChange={(val) => onChange(field.key, val)}
                                    disabled={disabled}
                                />
                            ))}
                        </div>
                    </CollapsibleContent>
                </div>
            </Collapsible>
        );
    }
    
    return (
        <div className="space-y-4">
            <div className="border-b pb-2">
                <h4 className="text-sm font-semibold">{group.label}</h4>
                {group.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {group.description}
                    </p>
                )}
            </div>
            <div className="space-y-4">
                {fields.map((field) => (
                    <DynamicDetailField
                        key={field.key}
                        field={field}
                        value={values[field.key]}
                        onChange={(val) => onChange(field.key, val)}
                        disabled={disabled}
                    />
                ))}
            </div>
        </div>
    );
}
