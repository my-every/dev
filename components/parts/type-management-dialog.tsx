"use client";

import { useState } from "react";
import {
    Plus,
    Edit,
    Trash2,
    Loader2,
    FolderCog,
    FileJson,
    AlertTriangle,
} from "lucide-react";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { PartCategory, DetailSchema } from "@/types/parts-library";
import { PART_CATEGORY_INFO } from "@/types/parts-library";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface TypeInfo {
    type: string;
    label: string;
    partCount: number;
    hasSchema: boolean;
}

interface TypeManagementDialogProps {
    category: PartCategory;
    trigger?: React.ReactNode;
    onTypeChange?: () => void;
}

export function TypeManagementDialog({
    category,
    trigger,
    onTypeChange,
}: TypeManagementDialogProps) {
    const [open, setOpen] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedType, setSelectedType] = useState<TypeInfo | null>(null);
    const [newTypeName, setNewTypeName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const { data, mutate: mutateTypes } = useSWR<{ types: TypeInfo[] }>(
        open ? `/api/parts/${category}?types=true` : null,
        fetcher
    );
    
    const types = data?.types ?? [];
    const categoryInfo = PART_CATEGORY_INFO[category];
    
    const handleCreate = async () => {
        if (!newTypeName.trim()) return;
        
        const slug = newTypeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        setIsLoading(true);
        setError(null);
        
        try {
            const res = await fetch(`/api/parts/${category}/${slug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: newTypeName }),
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create type');
            }
            
            await mutateTypes();
            onTypeChange?.();
            setShowCreateDialog(false);
            setNewTypeName("");
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create type');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRename = async () => {
        if (!selectedType || !newTypeName.trim()) return;
        
        const slug = newTypeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        setIsLoading(true);
        setError(null);
        
        try {
            const res = await fetch(`/api/parts/${category}/${selectedType.type}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newName: slug }),
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to rename type');
            }
            
            await mutateTypes();
            onTypeChange?.();
            setShowRenameDialog(false);
            setSelectedType(null);
            setNewTypeName("");
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to rename type');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDelete = async () => {
        if (!selectedType) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const res = await fetch(`/api/parts/${category}/${selectedType.type}`, {
                method: 'DELETE',
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete type');
            }
            
            await mutateTypes();
            onTypeChange?.();
            setShowDeleteDialog(false);
            setSelectedType(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete type');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    {trigger ?? (
                        <Button variant="outline" size="sm">
                            <FolderCog className="h-4 w-4 mr-2" />
                            Manage Types
                        </Button>
                    )}
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderCog className="h-5 w-5" />
                            Manage {categoryInfo?.label} Types
                        </DialogTitle>
                        <DialogDescription>
                            Create, rename, or delete part types within this category. 
                            Each type can have its own detail schema.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-sm font-medium">
                                Types ({types.length})
                            </Label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setNewTypeName("");
                                    setShowCreateDialog(true);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                New Type
                            </Button>
                        </div>
                        
                        <ScrollArea className="h-[300px] border rounded-lg">
                            {types.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                    <FolderCog className="h-10 w-10 mb-3 opacity-50" />
                                    <p className="text-sm">No types defined yet.</p>
                                    <p className="text-xs mt-1">Create your first type to organize parts.</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {types.map((type) => (
                                        <div
                                            key={type.type}
                                            className="flex items-center justify-between p-3 hover:bg-muted/50"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm truncate">
                                                        {type.label}
                                                    </span>
                                                    {type.hasSchema && (
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            <FileJson className="h-3 w-3 mr-1" />
                                                            Schema
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {type.partCount} part{type.partCount !== 1 ? 's' : ''} 
                                                    <span className="mx-1">&bull;</span>
                                                    <span className="font-mono">{type.type}</span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => {
                                                        setSelectedType(type);
                                                        setNewTypeName(type.label);
                                                        setShowRenameDialog(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => {
                                                        setSelectedType(type);
                                                        setShowDeleteDialog(true);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Create Type Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Type</DialogTitle>
                        <DialogDescription>
                            Enter a name for the new type. A URL-friendly slug will be generated automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="typeName">Type Name</Label>
                            <Input
                                id="typeName"
                                value={newTypeName}
                                onChange={(e) => setNewTypeName(e.target.value)}
                                placeholder="e.g., Timer Relays"
                            />
                            {newTypeName && (
                                <p className="text-xs text-muted-foreground">
                                    Slug: <span className="font-mono">{newTypeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}</span>
                                </p>
                            )}
                        </div>
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={isLoading || !newTypeName.trim()}>
                            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Create Type
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Rename Type Dialog */}
            <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Type</DialogTitle>
                        <DialogDescription>
                            Enter a new name for "{selectedType?.label}". 
                            The folder will be renamed and all parts will be updated.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="newTypeName">New Type Name</Label>
                            <Input
                                id="newTypeName"
                                value={newTypeName}
                                onChange={(e) => setNewTypeName(e.target.value)}
                                placeholder="e.g., Timer Relays"
                            />
                            {newTypeName && (
                                <p className="text-xs text-muted-foreground">
                                    New slug: <span className="font-mono">{newTypeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}</span>
                                </p>
                            )}
                        </div>
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRename} disabled={isLoading || !newTypeName.trim()}>
                            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Rename Type
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Delete Type Confirmation */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Delete Type
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{selectedType?.label}"? 
                            {selectedType && selectedType.partCount > 0 && (
                                <strong className="text-destructive block mt-2">
                                    This will permanently delete {selectedType.partCount} part{selectedType.partCount !== 1 ? 's' : ''}!
                                </strong>
                            )}
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete Type
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
