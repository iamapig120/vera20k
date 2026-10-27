param(
    [Parameter(Mandatory=$true)][string]$Python,
    [string]$Bash = 'C:\Program Files\Git\bin\bash.exe',
    [ValidateSet('prepare','build','bundle')][string]$Action = 'build'
)
$ErrorActionPreference = 'Stop'
$WebRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$BuildRoot = [IO.Path]::GetFullPath((Join-Path $WebRoot '.build'))
if (-not $BuildRoot.StartsWith($WebRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Build output escaped the project root' }
$PythonPath = (Resolve-Path -LiteralPath $Python).Path
$BashPath = (Resolve-Path -LiteralPath $Bash).Path
New-Item -ItemType Directory -Path (Join-Path $BuildRoot 'tmp') -Force | Out-Null
$env:VERA_WEB_PYTHON = $PythonPath
$env:VERA_WEB_GIT = (Get-Command git -CommandType Application | Select-Object -First 1).Source
$env:TMPDIR = Join-Path $BuildRoot 'tmp'
$env:TEMP = $env:TMPDIR
$env:TMP = $env:TMPDIR
$env:CARGO_BUILD_JOBS = '2'
$env:CARGO_INCREMENTAL = '0'
if (-not $env:CARGO_HOME) { $env:CARGO_HOME = Join-Path $BuildRoot 'cargo' }
if (-not $env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR = Join-Path $BuildRoot 'target' }
[Diagnostics.Process]::GetCurrentProcess().PriorityClass = 'BelowNormal'
Push-Location -LiteralPath $WebRoot
try {
    & $BashPath --noprofile --norc -c 'export PYTHON_EXE="$(cygpath -u "$VERA_WEB_PYTHON")"; export GIT_EXE="$(cygpath -u "$VERA_WEB_GIT")"; export PATH="$(dirname "$GIT_EXE"):$PATH"; python3() { "$PYTHON_EXE" "$@"; }; git() { "$GIT_EXE" "$@"; }; export -f python3 git; exec bash ./web.sh "$1"' 'vera-web-build' $Action
    if ($LASTEXITCODE -ne 0) { throw "Web workflow failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
