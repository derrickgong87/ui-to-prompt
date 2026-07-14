[CmdletBinding()]
param(
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $repoRoot 'dist\ui-to-prompt-review.zip'
}
$output = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $output
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$stage = [IO.Path]::GetFullPath((Join-Path $tempRoot ("ui-to-prompt-package-{0}" -f [guid]::NewGuid())))

if (-not $stage.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to create a staging directory outside the system temp directory: $stage"
}

$excludedSegments = @('.git', 'node_modules', 'coverage', 'tmp', 'captures', '__pycache__', '.pytest_cache')
$sensitiveNames = @('.npmrc', '.netrc', 'id_rsa', 'id_ed25519', 'credentials.json', 'secrets.json')
$sensitiveExtensions = @('.pem', '.key', '.pfx', '.p12')

function Get-RelativePath {
    param(
        [string]$BasePath,
        [string]$FullPath
    )

    $baseUri = [Uri]([IO.Path]::GetFullPath($BasePath).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar)
    $fullUri = [Uri][IO.Path]::GetFullPath($FullPath)
    return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fullUri).ToString()).Replace('/', [IO.Path]::DirectorySeparatorChar)
}

function Test-IncludedFile {
    param([string]$RelativePath)

    $segments = $RelativePath -split '[\\/]'
    foreach ($segment in $segments) {
        if ($excludedSegments -contains $segment) { return $false }
    }
    $name = [IO.Path]::GetFileName($RelativePath)
    if ($name -eq '.env' -or $name.StartsWith('.env.', [StringComparison]::OrdinalIgnoreCase)) { return $false }
    if ($name.EndsWith('.log', [StringComparison]::OrdinalIgnoreCase)) { return $false }
    if ($name.EndsWith('.zip', [StringComparison]::OrdinalIgnoreCase)) { return $false }
    if ($sensitiveNames -contains $name) { return $false }
    if ($sensitiveExtensions -contains [IO.Path]::GetExtension($name)) { return $false }
    return $true
}

try {
    New-Item -ItemType Directory -Force -Path $stage, $outputDirectory | Out-Null

    $trackedPaths = @(& git -C $repoRoot -c core.quotepath=false ls-files --cached)
    if ($LASTEXITCODE -ne 0) {
        throw 'Packaging failed: unable to enumerate Git-tracked files.'
    }

    $files = foreach ($relative in $trackedPaths) {
        if (-not (Test-IncludedFile -RelativePath $relative)) { continue }
        $fullPath = [IO.Path]::GetFullPath((Join-Path $repoRoot $relative))
        if (-not $fullPath.StartsWith(($repoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
            throw "Packaging failed: tracked path escapes repository root: $relative"
        }
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            throw "Packaging failed: tracked file is missing from the worktree: $relative"
        }
        Get-Item -LiteralPath $fullPath
    }

    foreach ($file in $files) {
        $relative = Get-RelativePath -BasePath $repoRoot -FullPath $file.FullName
        $destination = Join-Path $stage $relative
        $destinationDirectory = Split-Path -Parent $destination
        New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination
    }

    if (-not (Test-Path -LiteralPath (Join-Path $stage 'README.md'))) {
        throw 'Packaging failed: staged README.md is missing.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $stage 'skills\ui-to-prompt\SKILL.md'))) {
        throw 'Packaging failed: staged UItoPrompt Skill is missing.'
    }
    if ((Get-ChildItem -LiteralPath $stage -Recurse -File).Count -lt 10) {
        throw 'Packaging failed: staged repository is unexpectedly small.'
    }

    if (Test-Path -LiteralPath $output) {
        Remove-Item -LiteralPath $output -Force
    }
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $output -CompressionLevel Optimal
    if (-not (Test-Path -LiteralPath $output) -or (Get-Item -LiteralPath $output).Length -le 0) {
        throw 'Packaging failed: archive is missing or empty.'
    }

    [pscustomobject]@{
        OutputPath = $output
        Bytes = (Get-Item -LiteralPath $output).Length
        Files = (Get-ChildItem -LiteralPath $stage -Recurse -File).Count
    }
}
finally {
    if (Test-Path -LiteralPath $stage) {
        $resolvedStage = [IO.Path]::GetFullPath($stage)
        if (-not $resolvedStage.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove a staging directory outside system temp: $resolvedStage"
        }
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
}
