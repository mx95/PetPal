# Export mobile-android/ and mobile-ios/ as standalone GitLab-ready repos (sibling folders).
# Usage: .\scripts\export-mobile-repos.ps1 [git-commit]
param([string]$Commit = "")

$PetPalRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Commit) {
  if (Test-Path "$PetPalRoot\mobile-android") { $Commit = "HEAD" }
  else {
    $Commit = (git -C $PetPalRoot log -1 --format=%H -- mobile-android 2>$null)
    if (-not $Commit) { throw 'No mobile-android history - pass a commit hash (e.g. 3031e22)' }
  }
}

$AndroidOut = if ($env:ANDROID_OUT) { $env:ANDROID_OUT } else { Join-Path (Split-Path $PetPalRoot -Parent) "petpal-android" }
$IosOut = if ($env:IOS_OUT) { $env:IOS_OUT } else { Join-Path (Split-Path $PetPalRoot -Parent) "petpal-ios" }

function Export-Subpath($subpath, $outDir) {
  $zip = Join-Path $env:TEMP ("petpal-export-" + [guid]::NewGuid().ToString() + ".zip")
  $tmp = Join-Path $env:TEMP ("petpal-export-" + [guid]::NewGuid().ToString())
  try {
    git -C $PetPalRoot archive --format=zip -o $zip $Commit $subpath
    if (-not (Test-Path $zip)) { throw "git archive failed for $subpath" }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    $src = Join-Path $tmp $subpath
    Get-ChildItem -Path $src -Force | ForEach-Object {
      Copy-Item -Path $_.FullName -Destination $outDir -Recurse -Force
    }
    Write-Host "[export-mobile] $subpath at $Commit -> $outDir"
  } finally {
    Remove-Item -Force $zip -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
}

Export-Subpath "mobile-android" $AndroidOut
Export-Subpath "mobile-ios" $IosOut

$syncSh = Join-Path $PetPalRoot "scripts\sync-petpal-web.sh"
foreach ($repo in @($AndroidOut, $IosOut)) {
  $scriptsDir = Join-Path $repo "scripts"
  New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null
  if (Test-Path $syncSh) {
    Copy-Item $syncSh (Join-Path $scriptsDir "sync-petpal-web.sh") -Force
  }
}

@'
{
  "appId": "io.petpal.app",
  "appName": "PetPal",
  "webDir": "web-app",
  "server": { "androidScheme": "https" }
}
'@ | Set-Content -Encoding UTF8 (Join-Path $AndroidOut "capacitor.config.json")

@'
{
  "appId": "io.petpal.app",
  "appName": "PetPal",
  "webDir": "web-app",
  "server": { "androidScheme": "https" }
}
'@ | Set-Content -Encoding UTF8 (Join-Path $IosOut "capacitor.config.json")

Write-Host '[export-mobile] Done. Push to GitLab - see docs/MOBILE_GITLAB.md'
