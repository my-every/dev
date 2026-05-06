import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type MatchKind = "UCP WL Compare spreadsheet" | "UCP wire list spreadsheet" | "UCP spreadsheet" | "LAY PDF";

interface CliOptions {
	sourceRoot: string;
	outputRoot: string;
	dryRun: boolean;
	fromYear: number;
	fromTimeMs: number;
}

interface CandidateFile {
	fullPath: string;
	fileName: string;
	mtimeMs: number;
	kind: MatchKind;
}

interface ProjectResult {
	projectFolderName: string;
	projectNumber: string;
	copiedFiles: CandidateFile[];
}

function printUsage(): void {
	console.log([
		"Usage:",
		"  node --experimental-strip-types scripts/copy-latest-legal-drawings.ts --source \"S:\\Legal Drawings\\Drawings\"",
		"",
		"Options:",
		"  --source <path>   Source Drawings folder. Defaults to S:\\Legal Drawings\\Drawings",
		"  --output <path>   Output folder. Defaults to <current-directory>\\Share\\Legals",
		"  --from-year <yr>  Only copy files last edited on/after Jan 1 of this year. Defaults to 2026",
		"  --dry-run         Print what would be copied without writing files",
		"  --help           Show this help text",
		"",
		"Expected source shape:",
		"  S:\\Legal Drawings\\Drawings\\<P#_ProjectName>\\Electrical\\*",
	].join("\n"));
}

function parseArgs(argv: string[]): CliOptions {
	let sourceRoot = "S:\\Legal Drawings\\Drawings";
	let outputRoot = path.join(process.cwd(), "Share", "Legal Drawings");
	let dryRun = false;
	let fromYear = 2026;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "--help" || arg === "-h") {
			printUsage();
			process.exit(0);
		}

		if (arg === "--source") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("Missing value for --source");
			}

			sourceRoot = value;
			index += 1;
			continue;
		}

		if (arg === "--output") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("Missing value for --output");
			}

			outputRoot = path.resolve(value);
			index += 1;
			continue;
		}

		if (arg === "--from-year") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("Missing value for --from-year");
			}

			fromYear = Number.parseInt(value, 10);
			if (!Number.isInteger(fromYear) || fromYear < 1900) {
				throw new Error(`Invalid --from-year value: ${value}`);
			}

			index += 1;
			continue;
		}

		if (arg === "--dry-run") {
			dryRun = true;
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	return {
		sourceRoot,
		outputRoot,
		dryRun,
		fromYear,
		fromTimeMs: new Date(fromYear, 0, 1).getTime(),
	};
}

function assertDirectory(directoryPath: string, label: string): void {
	if (!fs.existsSync(directoryPath)) {
		throw new Error(`${label} does not exist: ${directoryPath}`);
	}

	if (!fs.statSync(directoryPath).isDirectory()) {
		throw new Error(`${label} is not a directory: ${directoryPath}`);
	}
}

function getProjectNumber(projectFolderName: string): string {
	const [prefix] = projectFolderName.split("_");
	return prefix?.trim() || projectFolderName;
}

function getMatchKind(fileName: string): MatchKind | null {
	const extension = path.extname(fileName).toLowerCase();
	const baseName = path.basename(fileName, extension).toLowerCase();
	const normalizedBaseName = baseName.replace(/[^a-z0-9]+/g, "");
	const isSpreadsheet = [".xlsx", ".xlsm", ".xls", ".xlsb", ".xslx"].includes(extension);

	if (isSpreadsheet && normalizedBaseName.includes("ucpwlcompare")) {
		return "UCP WL Compare spreadsheet";
	}

	if (isSpreadsheet && (normalizedBaseName.includes("ucpwirelist") || normalizedBaseName.includes("ucpwiringlist"))) {
		return "UCP wire list spreadsheet";
	}

	if (baseName.includes("ucp") && isSpreadsheet) {
		return "UCP spreadsheet";
	}

	if (baseName.includes("lay") && extension === ".pdf") {
		return "LAY PDF";
	}

	return null;
}

function walkFiles(directoryPath: string): string[] {
	const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = path.join(directoryPath, entry.name);

		if (entry.isDirectory()) {
			files.push(...walkFiles(fullPath));
			continue;
		}

		if (entry.isFile()) {
			files.push(fullPath);
		}
	}

	return files;
}

function findLatestMatches(electricalPath: string, fromTimeMs: number): CandidateFile[] {
	const latestByKind = new Map<MatchKind, CandidateFile>();

	for (const filePath of walkFiles(electricalPath)) {
		const fileName = path.basename(filePath);
		const kind = getMatchKind(fileName);

		if (!kind) {
			continue;
		}

		const stats = fs.statSync(filePath);
		if (stats.mtimeMs < fromTimeMs) {
			continue;
		}

		const candidate: CandidateFile = {
			fullPath: filePath,
			fileName,
			mtimeMs: stats.mtimeMs,
			kind,
		};
		const existing = latestByKind.get(kind);

		if (!existing || candidate.mtimeMs > existing.mtimeMs) {
			latestByKind.set(kind, candidate);
		}
	}

	return [...latestByKind.values()].sort((left, right) => left.kind.localeCompare(right.kind));
}

function copyProjectFiles(options: CliOptions): ProjectResult[] {
	assertDirectory(options.sourceRoot, "Source root");

	const projectDirectories = fs
		.readdirSync(options.sourceRoot, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => ({
			name: entry.name,
			fullPath: path.join(options.sourceRoot, entry.name),
		}))
		.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }));

	const results: ProjectResult[] = [];

	for (const projectDirectory of projectDirectories) {
		const electricalPath = path.join(projectDirectory.fullPath, "Electrical");

		if (!fs.existsSync(electricalPath) || !fs.statSync(electricalPath).isDirectory()) {
			continue;
		}

		const copiedFiles = findLatestMatches(electricalPath, options.fromTimeMs);
		const projectNumber = getProjectNumber(projectDirectory.name);
		const destinationDirectory = path.join(options.outputRoot, projectNumber);

		if (copiedFiles.length > 0 && !options.dryRun) {
			fs.mkdirSync(destinationDirectory, { recursive: true });
		}

		for (const file of copiedFiles) {
			const destinationPath = path.join(destinationDirectory, file.fileName);

			if (!options.dryRun) {
				fs.copyFileSync(file.fullPath, destinationPath);
			}
		}

		results.push({
			projectFolderName: projectDirectory.name,
			projectNumber,
			copiedFiles,
		});
	}

	return results;
}

function printResults(results: ProjectResult[], options: CliOptions): void {
	console.log(`Source: ${options.sourceRoot}`);
	console.log(`Output: ${options.outputRoot}`);
	console.log(`Modified on/after: ${new Date(options.fromTimeMs).toLocaleDateString()}`);
	console.log(options.dryRun ? "Mode: dry run\n" : "Mode: copy\n");

	if (results.length === 0) {
		console.log("No project folders with an Electrical directory were found.");
		return;
	}

	for (const result of results) {
		console.log(`${result.projectFolderName} -> ${path.join(options.outputRoot, result.projectNumber)}`);

		if (result.copiedFiles.length === 0) {
			console.log("  No matching UCP spreadsheet, UCP WL Compare spreadsheet, UCP wire list spreadsheet, or LAY PDF found.");
			continue;
		}

		for (const file of result.copiedFiles) {
			const editedAt = new Date(file.mtimeMs).toLocaleString();
			console.log(`  ${file.kind}: ${file.fileName}`);
			console.log(`    Last edited: ${editedAt}`);
			console.log(`    From: ${file.fullPath}`);
		}
	}
}

function main(): void {
	try {
		const options = parseArgs(process.argv.slice(2));
		const results = copyProjectFiles(options);
		printResults(results, options);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		console.error("");
		printUsage();
		process.exit(1);
	}
}

main();