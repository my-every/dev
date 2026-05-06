"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GenericPartDetailsEditorProps {
    value: Record<string, unknown>;
    onChange: (value: Record<string, unknown>) => void;
    disabled?: boolean;
}

export function GenericPartDetailsEditor({
    value,
    onChange,
    disabled = false,
}: GenericPartDetailsEditorProps) {
    const entries = Object.entries(value ?? {});

    const updateEntry = (originalKey: string, nextKey: string, nextValue: string) => {
        const next = { ...value };
        delete next[originalKey];
        next[nextKey] = nextValue;
        onChange(next);
    };

    const removeEntry = (key: string) => {
        const next = { ...value };
        delete next[key];
        onChange(next);
    };

    const addEntry = () => {
        let key = "newField";
        let suffix = 1;
        while (key in value) {
            key = `newField${suffix++}`;
        }
        onChange({ ...value, [key]: "" });
    };

    return (
        <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h4 className="text-sm font-semibold">Details</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                        This type does not have a custom schema yet, so these details are being edited as flexible key/value fields.
                    </p>
                </div>
                {!disabled ? (
                    <Button type="button" size="sm" variant="outline" onClick={addEntry}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Field
                    </Button>
                ) : null}
            </div>

            {entries.length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                    No details yet. Add fields for this part until a dedicated schema is created.
                </div>
            ) : (
                <div className="space-y-3">
                    {entries.map(([key, rawValue]) => (
                        <div key={key} className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_40px]">
                            <div className="space-y-1">
                                <Label className="text-xs">Field</Label>
                                <Input
                                    value={key}
                                    disabled={disabled}
                                    onChange={(event) => updateEntry(key, event.target.value, String(rawValue ?? ""))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Value</Label>
                                <Input
                                    value={String(rawValue ?? "")}
                                    disabled={disabled}
                                    onChange={(event) => updateEntry(key, key, event.target.value)}
                                />
                            </div>
                            <div className="flex items-end">
                                {!disabled ? (
                                    <Button type="button" size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => removeEntry(key)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
