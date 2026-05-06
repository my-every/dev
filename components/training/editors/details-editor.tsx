"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { useState } from "react";
import type { DetailsContent } from "@/types/training";

interface DetailsEditorProps {
    content: DetailsContent;
    onChange: (content: DetailsContent) => void;
    disabled?: boolean;
}

export function DetailsEditor({ content, onChange, disabled }: DetailsEditorProps) {
    const [tagInput, setTagInput] = useState("");

    const handleAddTag = () => {
        if (tagInput.trim() && !content.tags.includes(tagInput.trim())) {
            onChange({
                ...content,
                tags: [...content.tags, tagInput.trim()],
            });
            setTagInput("");
        }
    };

    const handleRemoveTag = (tag: string) => {
        onChange({
            ...content,
            tags: content.tags.filter(t => t !== tag),
        });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                    id="title"
                    value={content.title}
                    onChange={(e) => onChange({ ...content, title: e.target.value })}
                    placeholder="Enter training title..."
                    disabled={disabled}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    value={content.description}
                    onChange={(e) => onChange({ ...content, description: e.target.value })}
                    placeholder="Describe what this training covers..."
                    rows={4}
                    disabled={disabled}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select
                        value={content.difficulty}
                        onValueChange={(value: "beginner" | "intermediate" | "advanced") =>
                            onChange({ ...content, difficulty: value })
                        }
                        disabled={disabled}
                    >
                        <SelectTrigger id="difficulty">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="time">Estimated Time (minutes)</Label>
                    <Input
                        id="time"
                        type="number"
                        min={1}
                        value={content.estimatedMinutes}
                        onChange={(e) =>
                            onChange({ ...content, estimatedMinutes: parseInt(e.target.value) || 0 })
                        }
                        disabled={disabled}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {content.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                            {tag}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="ml-1 hover:text-destructive"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </Badge>
                    ))}
                </div>
                {!disabled && (
                    <div className="flex gap-2">
                        <Input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            placeholder="Add a tag..."
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddTag();
                                }
                            }}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
