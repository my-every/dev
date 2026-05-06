import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { PERSISTENCE_ERROR_CODES, type PersistenceErrorCode } from './policy'

export interface WorkspaceFs {
    exists(relativePath: string): Promise<boolean>
    readText(relativePath: string): Promise<string | null>
    writeText(relativePath: string, content: string): Promise<boolean>
    rename(fromRelativePath: string, toRelativePath: string): Promise<boolean>
    delete(relativePath: string): Promise<boolean>
}

export interface TransactionFileWrite {
    relativePath: string
    content: string
}

export interface TransactionResult {
    success: boolean
    transactionId: string
    errorCode?: PersistenceErrorCode
    errorMessage?: string
}

interface PreviousFileState {
    relativePath: string
    existed: boolean
    previousContent: string | null
}

export class WorkspaceTransactionCoordinator {
    constructor(private readonly fs: WorkspaceFs) { }

    async applyWrites(writes: TransactionFileWrite[]): Promise<TransactionResult> {
        const transactionId = randomUUID()
        const previousStates: PreviousFileState[] = []
        const committedPaths: string[] = []

        try {
            const uniqueWrites = Array.from(new Map(writes.map(item => [item.relativePath, item])).values())

            for (const write of uniqueWrites) {
                const existed = await this.fs.exists(write.relativePath)
                const previousContent = existed ? await this.fs.readText(write.relativePath) : null
                previousStates.push({
                    relativePath: write.relativePath,
                    existed,
                    previousContent,
                })
            }

            for (const write of uniqueWrites) {
                const tempPath = `${write.relativePath}.tmp.${transactionId}`
                const tempOk = await this.fs.writeText(tempPath, write.content)
                if (!tempOk) {
                    throw new Error(`Failed to write temporary file: ${tempPath}`)
                }

                const renameOk = await this.fs.rename(tempPath, write.relativePath)
                if (!renameOk) {
                    await this.fs.delete(tempPath)
                    throw new Error(`Failed to commit temporary file: ${tempPath}`)
                }

                committedPaths.push(write.relativePath)
            }

            return {
                success: true,
                transactionId,
            }
        } catch (error) {
            const rollbackOk = await this.rollback(committedPaths, previousStates)

            return {
                success: false,
                transactionId,
                errorCode: rollbackOk ? PERSISTENCE_ERROR_CODES.TXN_WRITE_FAILED : PERSISTENCE_ERROR_CODES.TXN_ROLLBACK_FAILED,
                errorMessage: error instanceof Error ? error.message : 'Unknown transaction failure',
            }
        }
    }

    private async rollback(committedPaths: string[], previousStates: PreviousFileState[]): Promise<boolean> {
        try {
            for (const committedPath of committedPaths.reverse()) {
                const previous = previousStates.find(item => item.relativePath === committedPath)
                if (!previous) {
                    continue
                }

                if (!previous.existed) {
                    await this.fs.delete(committedPath)
                    continue
                }

                const restored = await this.fs.writeText(committedPath, previous.previousContent ?? '')
                if (!restored) {
                    return false
                }
            }

            return true
        } catch {
            return false
        }
    }
}

export function toPosixRelativePath(...segments: string[]): string {
    return path.posix.join(...segments)
}
