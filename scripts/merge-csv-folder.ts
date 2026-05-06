import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";

type CsvCell = string | number | boolean | Date | null | undefined;
type CsvRow = CsvCell[];

interface CliOptions {
	inputDirectory: string;
	outputPath: string;
	keyColumn: string;
}

function printUsage(): void {
	console.log([
		"Usage:",
		"  node --experimental-strip-types scripts/merge-csv-folder.ts <directory> [--key-column column-name]",
		"",
		"Examples:",
		"  node --experimental-strip-types scripts/merge-csv-folder.ts ./cables-wires",
		"  node --experimental-strip-types scripts/merge-csv-folder.ts ./relays --key-column \"Product Number\"",
	].join("\n"));
}

function parseArgs(argv: string[]): CliOptions {
	const positional: string[] = [];
	let keyColumn = "Product Number";

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "--help" || arg === "-h") {
			printUsage();
			process.exit(0);
		}

		if (arg === "--key-column") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("Missing value for --key-column");
			}

			keyColumn = value.trim();
			index += 1;
			continue;
		}

		positional.push(arg);
	}

	if (positional.length === 0) {
		throw new Error("Missing input directory path");
	}

	const inputDirectory = path.resolve(positional[0]);
	const outputFileName = `${path.basename(inputDirectory)}.csv`;
	const outputPath = path.join(inputDirectory, outputFileName);

	return {
		inputDirectory,
		outputPath,
		keyColumn,
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

function normalizeHeaderName(value: CsvCell): string {
	return normalizeCell(value).toLowerCase();
}

function readCsvRows(inputPath: string): CsvRow[] {
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
		blankrows: false,
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

function resolveHeaderIndex(headerRow: CsvRow, column: string): number {
	const normalizedHeaders = headerRow.map(normalizeHeaderName);
	const normalizedColumn = normalizeHeaderName(column);
	const index = normalizedHeaders.findIndex(header => header === normalizedColumn);

	if (index === -1) {
		throw new Error(`Column not found: ${column}`);
	}

	return index;
}

function getCsvFiles(inputDirectory: string, outputPath: string): string[] {
	if (!fs.existsSync(inputDirectory)) {
		throw new Error(`Directory not found: ${inputDirectory}`);
	}

	if (!fs.statSync(inputDirectory).isDirectory()) {
		throw new Error(`Path is not a directory: ${inputDirectory}`);
	}

	const outputFileName = path.basename(outputPath).toLowerCase();

	return fs
		.readdirSync(inputDirectory, { withFileTypes: true })
		.filter(entry => entry.isFile())
		.map(entry => entry.name)
		.filter(name => path.extname(name).toLowerCase() === ".csv")
		.filter(name => name.toLowerCase() !== outputFileName)
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }))
		.map(name => path.join(inputDirectory, name));
}

function mergeHeaderRows(existingHeader: CsvRow, incomingHeader: CsvRow): CsvRow {
	const mergedHeader = [...existingHeader];
	const seenHeaders = new Set(existingHeader.map(normalizeHeaderName));

	for (const cell of incomingHeader) {
		const normalizedHeader = normalizeHeaderName(cell);
		if (!normalizedHeader || seenHeaders.has(normalizedHeader)) {
			continue;
		}

		seenHeaders.add(normalizedHeader);
		mergedHeader.push(normalizeCell(cell));
	}

	return mergedHeader;
}

function createRowRecord(row: CsvRow, headerRow: CsvRow): Map<string, CsvCell> {
	const record = new Map<string, CsvCell>();

	for (let index = 0; index < headerRow.length; index += 1) {
		const normalizedHeader = normalizeHeaderName(headerRow[index]);
		if (!normalizedHeader) {
			continue;
		}

		record.set(normalizedHeader, row[index] ?? "");
	}

	return record;
}

function mergeRowRecords(existingRecord: Map<string, CsvCell>, incomingRecord: Map<string, CsvCell>): void {
	for (const [headerName, value] of incomingRecord.entries()) {
		const existingValue = existingRecord.get(headerName);
		if (normalizeCell(existingValue) !== "") {
			continue;
		}

		if (normalizeCell(value) === "") {
			continue;
		}

		existingRecord.set(headerName, value);
	}
}

function createOutputRow(record: Map<string, CsvCell>, headerRow: CsvRow): CsvRow {
	return headerRow.map(cell => record.get(normalizeHeaderName(cell)) ?? "");
}

function mergeRows(filePaths: string[], keyColumn: string): {
	header: CsvRow;
	uniqueRows: CsvRow[];
	duplicateCount: number;
	inputRowCount: number;
} {
	if (filePaths.length === 0) {
		throw new Error("No CSV files found in the provided directory");
	}

	let header: CsvRow | null = null;
	const uniqueRecords = new Map<string, Map<string, CsvCell>>();
	let duplicateCount = 0;
	let inputRowCount = 0;

	for (const filePath of filePaths) {
		const rows = readCsvRows(filePath);
		if (rows.length === 0) {
			continue;
		}

		const [currentHeader, ...dataRows] = rows;
		if (!header) {
			header = currentHeader.map(cell => normalizeCell(cell));
		} else {
			header = mergeHeaderRows(header, currentHeader);
		}

		const keyColumnIndex = resolveHeaderIndex(currentHeader, keyColumn);

		for (const row of dataRows) {
			if (row.every(cell => normalizeCell(cell) === "")) {
				continue;
			}

			inputRowCount += 1;
			const key = normalizeCell(row[keyColumnIndex]);
			if (!key) {
				duplicateCount += 1;
				continue;
			}

			const incomingRecord = createRowRecord(row, currentHeader);
			const existingRecord = uniqueRecords.get(key);
			if (existingRecord) {
				mergeRowRecords(existingRecord, incomingRecord);
				duplicateCount += 1;
				continue;
			}

			uniqueRecords.set(key, incomingRecord);
		}
	}

	if (!header) {
		throw new Error("No CSV data found in the provided directory");
	}

	const uniqueRows = Array.from(uniqueRecords.values(), record => createOutputRow(record, header));

	return {
		header,
		uniqueRows,
		duplicateCount,
		inputRowCount,
	};
}

function main(): void {
	const options = parseArgs(process.argv.slice(2));
	const csvFiles = getCsvFiles(options.inputDirectory, options.outputPath);
	const { header, uniqueRows, duplicateCount, inputRowCount } = mergeRows(csvFiles, options.keyColumn);

	writeCsvRows(options.outputPath, [header, ...uniqueRows]);

	console.log(`Merged ${csvFiles.length} CSV file${csvFiles.length === 1 ? "" : "s"}`);
	console.log(`Read ${inputRowCount} data row${inputRowCount === 1 ? "" : "s"}`);
	console.log(`Removed ${duplicateCount} duplicate or empty-key row${duplicateCount === 1 ? "" : "s"}`);
	console.log(`Wrote ${uniqueRows.length} unique row${uniqueRows.length === 1 ? "" : "s"} to ${options.outputPath}`);
	console.log(`Deduped by column: ${options.keyColumn}`);
}

main();