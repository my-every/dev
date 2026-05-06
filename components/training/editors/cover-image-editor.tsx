"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import type { CoverImageContent } from "@/types/training";
import { cn } from "@/lib/utils";

interface CoverImageEditorProps {
    content: CoverImageContent;
    onChange: (content: CoverImageContent) => void;
    disabled?: boolean;
}

export function CoverImageEditor({ content, onChange, disabled }: CoverImageEditorProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // Convert file to base64 data URL and store directly in JSON
    const fileToDataUrl = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });
    }, []);

    const handleUpload = useCallback(async (file: File) => {
        if (!file.type.startsWith("image/")) return;
        
        // Check file size (max 4MB for cover images)
        const maxSize = 4 * 1024 * 1024;
        if (file.size > maxSize) {
            console.error("File too large. Maximum size is 4MB.");
            return;
        }
        
        setIsUploading(true);
        try {
            const dataUrl = await fileToDataUrl(file);
            onChange({ ...content, imageUrl: dataUrl });
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setIsUploading(false);
        }
    }, [content, onChange, fileToDataUrl]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    const handleRemove = () => {
        onChange({ ...content, imageUrl: "" });
    };

    return (
        <div className="space-y-4">
            {content.imageUrl ? (
                <div className="relative rounded-lg overflow-hidden">
                    <img
                        src={content.imageUrl}
                        alt={content.alt || "Cover image"}
                        className="w-full h-48 object-cover"
                    />
                    {!disabled && (
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={handleRemove}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            ) : (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={cn(
                        "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                        dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Drag and drop an image, or click to upload
                            </p>
                            {!disabled && (
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />
                                    <Button type="button" variant="outline" size="sm" asChild>
                                        <span>
                                            <Upload className="h-4 w-4 mr-1" />
                                            Choose File
                                        </span>
                                    </Button>
                                </label>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="alt">Alt Text</Label>
                    <Input
                        id="alt"
                        value={content.alt || ""}
                        onChange={(e) => onChange({ ...content, alt: e.target.value })}
                        placeholder="Describe the image..."
                        disabled={disabled}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="caption">Caption</Label>
                    <Input
                        id="caption"
                        value={content.caption || ""}
                        onChange={(e) => onChange({ ...content, caption: e.target.value })}
                        placeholder="Optional caption..."
                        disabled={disabled}
                    />
                </div>
            </div>
        </div>
    );
}
