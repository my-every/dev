"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { CatalogImportResult } from "@/lib/persistence/catalog-storage";

interface CatalogImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (file: File) => Promise<CatalogImportResult>;
    onComplete: () => void;
}

export function CatalogImportDialog({
    open,
    onOpenChange,
    onImport,
    onComplete,
}: CatalogImportDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<CatalogImportResult | null>(null);

    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setResult(null);
        },
        [],
    );

    const handleImport = useCallback(async () => {
        if (!file) return;
        setImporting(true);
        try {
            const res = await onImport(file);
            setResult(res);
        } catch {
            setResult({ importedCount: 0, skippedCount: 0, errors: ["Import failed"] });
        } finally {
            setImporting(false);
        }
    }, [file, onImport]);

    const handleDone = useCallback(() => {
        setFile(null);
        setResult(null);
        onComplete();
    }, [onComplete]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Import Catalog CSV
                    </DialogTitle>
                    <DialogDescription>
                        Upload a CSV file with columns: partNumber, description, category,
                        manufacturer (optional).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {!result ? (
                        <>
                            <label className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border/60 p-8 cursor-pointer hover:border-primary/50 transition-colors">
                                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {file ? file.name : "Click to select a CSV file"}
                                </span>
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                {result.errors.length === 0 ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                ) : (
                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                )}
                                <span className="font-semibold text-sm">Import Complete</span>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                    {result.importedCount} imported
                                </Badge>
                                {result.skippedCount > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                        {result.skippedCount} skipped
                                    </Badge>
                                )}
                                {result.errors.length > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                        {result.errors.length} errors
                                    </Badge>
                                )}
                            </div>
                            {result.errors.length > 0 && (
                                <div className="max-h-32 overflow-y-auto text-xs text-destructive space-y-0.5">
                                    {result.errors.map((err, i) => (
                                        <p key={i}>• {err}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {result ? (
                        <Button onClick={handleDone}>Done</Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={!file || importing}
                            >
                                {importing ? "Importing…" : "Import"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
