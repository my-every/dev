import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";

type CsvCell = string | number | boolean | Date | null | undefined;
type CsvRow = CsvCell[];

interface CliOptions {
	inputPath: string;
	outputPath: string;
	columns: string[];
	dropEmpty: boolean;
	sortBy: string | null;
	splitColumn: string | null;
}

function printUsage(): void {
	console.log([
		"Usage:",
		"  node --experimental-strip-types scripts/remove-duplicate-rows.ts <input.csv> [output.csv] [--columns col1,col2] [--drop-empty] [--sort-by column] [--split-column column]",
		"",
		"Examples:",
		"  node --experimental-strip-types scripts/remove-duplicate-rows.ts ./data/input.csv",
		"  node --experimental-strip-types scripts/remove-duplicate-rows.ts ./data/input.csv ./data/output.csv --drop-empty",
		"  node --experimental-strip-types scripts/remove-duplicate-rows.ts ./data/input.csv --columns \"Part Number,Description\"",
		"  node --experimental-strip-types scripts/remove-duplicate-rows.ts ./data/input.csv --columns \"Part Number\" --sort-by \"Part Number\"",
		"  node --experimental-strip-types scripts/remove-duplicate-rows.ts ./data/input.csv --split-column \"Part Number\" --columns \"Part Number\" --sort-by \"Part Number\"",
	].join("\n"));
}

function parseArgs(argv: string[]): CliOptions {
	const positional: string[] = [];
	const columns: string[] = [];
	let dropEmpty = false;
	let sortBy: string | null = null;
	let splitColumn: string | null = null;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "--help" || arg === "-h") {
			printUsage();
			process.exit(0);
		}

		if (arg === "--drop-empty") {
			dropEmpty = true;
			continue;
		}

		if (arg === "--columns") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("Missing value for --columns");
			}

			columns.push(
				...value
					.split(",")
					.map(column => column.trim())
					.filter(Boolean)
			);
			index += 1;
			continue;
		}

		if (arg === "--sort-by") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("Missing value for --sort-by");
			}

			sortBy = value.trim();
			index += 1;
			continue;
		}

		if (arg === "--split-column") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("Missing value for --split-column");
			}

			splitColumn = value.trim();
			index += 1;
			continue;
		}

		positional.push(arg);
	}

	if (positional.length === 0) {
		throw new Error("Missing input CSV path");
	}

	const inputPath = path.resolve(positional[0]);
	const outputPath = positional[1]
		? path.resolve(positional[1])
		: path.resolve(path.dirname(inputPath), `${path.basename(inputPath, path.extname(inputPath))}.deduped.csv`);

	return {
		inputPath,
		outputPath,
		columns,
		dropEmpty,
		sortBy,
		splitColumn,
	};
}

function normalizeCell(value: CsvCell): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return String(value).trim();
}

function isEmptyRow(row: CsvRow): boolean {
	return row.every(cell => normalizeCell(cell) === "");
}

function buildRowKey(row: CsvRow, headerIndexes: number[] | null): string {
	const source = headerIndexes ? headerIndexes.map(index => row[index] ?? "") : row;
	return source.map(normalizeCell).join("\u001f");
}

function resolveHeaderIndexes(headerRow: CsvRow, columns: string[]): number[] | null {
	if (columns.length === 0) {
		return null;
	}

	const normalizedHeaders = headerRow.map(cell => normalizeCell(cell).toLowerCase());
	const indexes = columns.map(column => {
		const normalizedColumn = column.toLowerCase();
		const index = normalizedHeaders.findIndex(header => header === normalizedColumn);
		if (index === -1) {
			throw new Error(`Column not found: ${column}`);
		}
		return index;
	});

	return indexes;
}

function resolveHeaderIndex(headerRow: CsvRow, column: string): number {
	const normalizedHeaders = headerRow.map(cell => normalizeCell(cell).toLowerCase());
	const normalizedColumn = column.toLowerCase();
	const index = normalizedHeaders.findIndex(header => header === normalizedColumn);

	if (index === -1) {
		throw new Error(`Column not found: ${column}`);
	}

	return index;
}

function splitCombinedRows(rows: CsvRow[], headerRow: CsvRow, splitColumn: string | null): CsvRow[] {
	if (!splitColumn) {
		return rows;
	}

	const splitIndex = resolveHeaderIndex(headerRow, splitColumn);
	const expandedRows: CsvRow[] = [];

	for (const row of rows) {
		const cellValue = normalizeCell(row[splitIndex]);
		if (!cellValue.includes(",")) {
			expandedRows.push(row);
			continue;
		}

		const parts = cellValue
			.split(",")
			.map(part => part.trim())
			.filter(Boolean);

		if (parts.length <= 1) {
			expandedRows.push(row);
			continue;
		}

		for (const part of parts) {
			const nextRow = [...row];
			nextRow[splitIndex] = part;
			expandedRows.push(nextRow);
		}
	}

	return expandedRows;
}

function readCsvRows(inputPath: string): CsvRow[] {
	if (!fs.existsSync(inputPath)) {
		throw new Error(`Input file not found: ${inputPath}`);
	}

	const fileBuffer = fs.readFileSync(inputPath);

	const workbook = XLSX.read(fileBuffer, {
		type: "buffer",
		raw: false,
		dense: true,
	});

	const firstSheetName = workbook.SheetNames[0];
	if (!firstSheetName) {
		throw new Error(`No sheets found in file: ${inputPath}`);
	}

	const sheet = workbook.Sheets[firstSheetName];
	return XLSX.utils.sheet_to_json<CsvRow>(sheet, {
		header: 1,
		raw: false,
		defval: "",
		blankrows: true,
	});
}

function writeCsvRows(outputPath: string, rows: CsvRow[]): void {
	const sheet = XLSX.utils.aoa_to_sheet(rows);
	const csv = XLSX.utils.sheet_to_csv(sheet, {
		FS: ",",
		RS: "\n",
	});

	fs.writeFileSync(outputPath, csv, "utf8");
}

function dedupeRows(rows: CsvRow[], columns: string[], dropEmpty: boolean): { header: CsvRow; uniqueRows: CsvRow[]; removedCount: number } {
	if (rows.length === 0) {
		return { header: [], uniqueRows: [], removedCount: 0 };
	}

	const [headerRow, ...dataRows] = rows;
	const headerIndexes = resolveHeaderIndexes(headerRow, columns);
	const seen = new Set<string>();
	const uniqueRows: CsvRow[] = [];
	let removedCount = 0;

	for (const row of dataRows) {
		if (dropEmpty && isEmptyRow(row)) {
			removedCount += 1;
			continue;
		}

		const key = buildRowKey(row, headerIndexes);
		if (seen.has(key)) {
			removedCount += 1;
			continue;
		}

		seen.add(key);
		uniqueRows.push(row);
	}

	return {
		header: headerRow,
		uniqueRows,
		removedCount,
	};
}

function sortRows(rows: CsvRow[], headerRow: CsvRow, sortBy: string | null): CsvRow[] {
	if (!sortBy) {
		return rows;
	}

	const sortIndex = resolveHeaderIndex(headerRow, sortBy);

	return [...rows].sort((leftRow, rightRow) => {
		const leftValue = normalizeCell(leftRow[sortIndex]);
		const rightValue = normalizeCell(rightRow[sortIndex]);

		return leftValue.localeCompare(rightValue, undefined, {
			numeric: true,
			sensitivity: "base",
		});
	});
}

function main(): void {
	const options = parseArgs(process.argv.slice(2));
	const rows = readCsvRows(options.inputPath);
	const header = rows[0] ?? [];
	const dataRows = rows.slice(1);
	const splitRows = splitCombinedRows(dataRows, header, options.splitColumn);
	const { uniqueRows, removedCount } = dedupeRows([header, ...splitRows], options.columns, options.dropEmpty);
	const sortedRows = sortRows(uniqueRows, header, options.sortBy);

	writeCsvRows(options.outputPath, [header, ...sortedRows]);

	console.log(`Wrote ${sortedRows.length} data rows to ${options.outputPath}`);
	console.log(`Removed ${removedCount} duplicate${removedCount === 1 ? "" : "s"}`);
	if (options.columns.length > 0) {
		console.log(`Deduped by columns: ${options.columns.join(", ")}`);
	} else {
		console.log("Deduped by exact row contents");
	}
	if (options.dropEmpty) {
		console.log("Dropped empty rows");
	}
	if (options.sortBy) {
		console.log(`Sorted by column: ${options.sortBy}`);
	}
	if (options.splitColumn) {
		console.log(`Split combined values in column: ${options.splitColumn}`);
	}
}

main();
