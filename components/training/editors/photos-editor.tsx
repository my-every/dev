"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, X, Loader2, Images, GripVertical } from "lucide-react";
import type { PhotosContent } from "@/types/training";
import { cn } from "@/lib/utils";

interface PhotosEditorProps {
    content: PhotosContent;
    onChange: (content: PhotosContent) => void;
    disabled?: boolean;
}

export function PhotosEditor({ content, onChange, disabled }: PhotosEditorProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // Convert file to base64 data URL
    const fileToDataUrl = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });
    }, []);

    const handleUpload = useCallback(async (files: FileList) => {
        const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return;
        
        // Check file sizes (max 2MB per photo)
        const maxSize = 2 * 1024 * 1024;
        const validSizeFiles = imageFiles.filter(f => f.size <= maxSize);
        
        if (validSizeFiles.length === 0) {
            console.error("All files are too large. Maximum size is 2MB per photo.");
            return;
        }
        
        setIsUploading(true);
        try {
            const uploadedImages = await Promise.all(
                validSizeFiles.map(async (file, index) => {
                    try {
                        const dataUrl = await fileToDataUrl(file);
                        return {
                            id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            url: dataUrl,
                            caption: "",
                            order: content.images.length + index,
                        };
                    } catch {
                        return null;
                    }
                })
            );
            
            const validImages = uploadedImages.filter((img): img is NonNullable<typeof img> => img !== null);
            onChange({ ...content, images: [...content.images, ...validImages] });
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setIsUploading(false);
        }
    }, [content, onChange, fileToDataUrl]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        handleUpload(e.dataTransfer.files);
    }, [handleUpload]);

    const updateImage = (id: string, updates: Partial<PhotosContent["images"][0]>) => {
        onChange({
            ...content,
            images: content.images.map(img => 
                img.id === id ? { ...img, ...updates } : img
            ),
        });
    };

    const removeImage = (id: string) => {
        onChange({
            ...content,
            images: content.images.filter(img => img.id !== id),
        });
    };

    return (
        <div className="space-y-4">
            {/* Upload Zone */}
            {!disabled && (
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    className={cn(
                        "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                        dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                    )}
                >
                    {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <Images className="h-6 w-6 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Drag and drop images, or click to upload
                            </p>
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleUpload(e.target.files)}
                                />
                                <Button type="button" variant="outline" size="sm" asChild>
                                    <span>
                                        <Upload className="h-4 w-4 mr-1" />
                                        Choose Files
                                    </span>
                                </Button>
                            </label>
                        </div>
                    )}
                </div>
            )}

            {/* Image Grid */}
            {content.images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="col-span-full flex items-center gap-2">
                        <Images className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary" className="text-[10px]">
                            {content.images.length} {content.images.length === 1 ? "image" : "images"}
                        </Badge>
                    </div>
                    <AnimatePresence initial={false}>
                    {content.images
                        .sort((a, b) => a.order - b.order)
                        .map((image, index) => (
                            <motion.div
                                key={image.id}
                                layout
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.02 }}
                                className={cn(
                                    "relative group rounded-lg overflow-hidden border",
                                    disabled && "opacity-60"
                                )}
                            >
                                <img
                                    src={image.url}
                                    alt={image.caption || "Training photo"}
                                    className="w-full h-32 object-cover"
                                />
                                
                                {!disabled && (
                                    <>
                                        <div className="absolute top-2 left-2 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-background/80 rounded p-1">
                                                <GripVertical className="h-4 w-4" />
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => removeImage(image.id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </>
                                )}
                                
                                <div className="p-2 bg-muted/50">
                                    <Input
                                        value={image.caption || ""}
                                        onChange={(e) => updateImage(image.id, { caption: e.target.value })}
                                        placeholder="Add caption..."
                                        className="h-7 text-xs"
                                        disabled={disabled}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
            
            {content.images.length === 0 && disabled && (
                <div className="text-center py-8 border border-dashed rounded-lg">
                    <Images className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No photos added</p>
                </div>
            )}
        </div>
    );
}
