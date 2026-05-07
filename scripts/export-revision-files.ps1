param(
  [string]$LegalRoot = "S:\Legal Drawings",
  [string]$BrandRoot = "S:\#Depts\380\6SIGMABRANDLIST\BRANDING\Projects Folder",
  [string]$ScanRoot = "",
  [ValidateSet("legal", "brand")]
  [string]$SourceKind = "legal",
  [datetime]$FromDate = (Get-Date "2020-01-01T00:00:00"),
  [datetime]$ToDate = (Get-Date),
  [string]$OutputPath = ".\revision-files-export.json",
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Resolve-LegalProjectsRoot {
  param([string]$SourceRoot)

  $drawingsPath = Join-Path $SourceRoot "Drawings"
  if (Test-Path -LiteralPath $drawingsPath -PathType Container) {
    return $drawingsPath
  }

  $drawingPath = Join-Path $SourceRoot "Drawing"
  if (Test-Path -LiteralPath $drawingPath -PathType Container) {
    return $drawingPath
  }

  return $SourceRoot
}

function Get-FileTypeIndicator {
  param([string]$FileName)

  $nameLower = $FileName.ToLowerInvariant()

  if ($nameLower -match "_lay_" -or $nameLower -match "_lay\.") {
    return "layout-pdf"
  }

  if ($nameLower -match "wiringlist" -or $nameLower -match "wirelist") {
    return "wire-list"
  }

  if ($nameLower -replace "[^a-z0-9]", "" -match "ucpwlcompare") {
    return "compare-wire-list"
  }

  if (($nameLower.EndsWith(".xlsx") -or $nameLower.EndsWith(".xlsm") -or $nameLower.EndsWith(".xls") -or $nameLower.EndsWith(".xlsb")) -and $nameLower -match "brand") {
    return "brand-list"
  }

  return "other"
}

function Get-MillisecondsUtc {
  param([datetime]$DateValue)

  $utc = $DateValue.ToUniversalTime()
  return [int64]([DateTimeOffset]$utc).ToUnixTimeMilliseconds()
}

function Get-FilesFromRoot {
  param(
    [string]$RootPath,
    [string]$SourceKind,
    [datetime]$RangeStart,
    [datetime]$RangeEnd
  )

  if (-not (Test-Path -LiteralPath $RootPath -PathType Container)) {
    return @()
  }

  $startUtc = $RangeStart.ToUniversalTime()
  $endUtc = $RangeEnd.ToUniversalTime()

  $files = Get-ChildItem -LiteralPath $RootPath -Recurse -File -Force -ErrorAction SilentlyContinue

  $results = foreach ($file in $files) {
    $lastWriteUtc = $file.LastWriteTimeUtc
    if ($lastWriteUtc -lt $startUtc -or $lastWriteUtc -gt $endUtc) {
      continue
    }

    [PSCustomObject]@{
      sourceKind = $SourceKind
      rootPath = $RootPath
      fullPath = $file.FullName
      fileName = $file.Name
      extension = $file.Extension.ToLowerInvariant()
      sizeBytes = [int64]$file.Length
      lastWriteTimeUtc = $lastWriteUtc.ToString("o")
      lastWriteTimeMs = (Get-MillisecondsUtc -DateValue $lastWriteUtc)
      fileTypeIndicator = Get-FileTypeIndicator -FileName $file.Name
    }
  }

  return @($results)
}


$resolvedLegalRoot = Resolve-LegalProjectsRoot -SourceRoot $LegalRoot
$resolvedBrandRoot = $BrandRoot

$allFiles = @()

if ($ScanRoot -and $ScanRoot.Trim().Length -gt 0) {
  $scanRootResolved = $ScanRoot.Trim()
  $allFiles = Get-FilesFromRoot -RootPath $scanRootResolved -SourceKind $SourceKind -RangeStart $FromDate -RangeEnd $ToDate
  if ($SourceKind -eq "legal") {
    $resolvedLegalRoot = $scanRootResolved
    $resolvedBrandRoot = $null
  } else {
    $resolvedLegalRoot = $null
    $resolvedBrandRoot = $scanRootResolved
  }
} else {
  $legalFiles = Get-FilesFromRoot -RootPath $resolvedLegalRoot -SourceKind "legal" -RangeStart $FromDate -RangeEnd $ToDate
  $brandFiles = Get-FilesFromRoot -RootPath $BrandRoot -SourceKind "brand" -RangeStart $FromDate -RangeEnd $ToDate
  $allFiles = @($legalFiles + $brandFiles)
}

$allFiles = @($allFiles) | Sort-Object -Property lastWriteTimeMs -Descending

$payload = [PSCustomObject]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  fromTimeUtc = $FromDate.ToUniversalTime().ToString("o")
  toTimeUtc = $ToDate.ToUniversalTime().ToString("o")
  legalSourceRoot = $resolvedLegalRoot
  brandSourceRoot = $resolvedBrandRoot
  totalFiles = $allFiles.Count
  totalsBySource = [PSCustomObject]@{
    legal = (@($allFiles | Where-Object { $_.sourceKind -eq "legal" })).Count
    brand = (@($allFiles | Where-Object { $_.sourceKind -eq "brand" })).Count
  }
  files = $allFiles
}

$outputDir = Split-Path -Path $OutputPath -Parent
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir -PathType Container)) {
  New-Item -Path $outputDir -ItemType Directory -Force | Out-Null
}

$payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
if (-not $Quiet) {
  Write-Host "Export complete: $OutputPath"
}
