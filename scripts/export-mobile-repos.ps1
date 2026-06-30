# Export mobile-android/ and mobile-ios/ as standalone GitLab-ready repos (sibling folders).
# Usage: .\scripts\export-mobile-repos.ps1 [git-commit]
param([string]$Commit = "")

$PetPalRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Commit) {
  if (Test-Path "$PetPalRoot\mobile-android") { $Commit = "HEAD" }
  else {
    $Commit = (git -C $PetPalRoot log -1 --format=%H -- mobile-android 2>$null)
    if (-not $Commit) { throw 'No mobile-android history - pass a commit hash' }
  }
}

$AndroidOut = if ($env:ANDROID_OUT) { $env:ANDROID_OUT } else { Join-Path (Split-Path $PetPalRoot -Parent) "petpal-android" }
$IosOut = if ($env:IOS_OUT) { $env:IOS_OUT } else { Join-Path (Split-Path $PetPalRoot -Parent) "petpal-ios" }

function Export-Subpath($subpath, $outDir) {
  $tmp = Join-Path $env:TEMP ("petpal-export-" + [guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  git -C $PetPalRoot archive $Commit $subpath | tar -x -C $tmp
  if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  Copy-Item -Recurse -Force (Join-Path $tmp $subpath "\*") $outDir
  Remove-Item -Recurse -Force $tmp
  Write-Host "[export-mobile] $subpath at $Commit -> $outDir"
}

Export-Subpath "mobile-android" $AndroidOut
Export-Subpath "mobile-ios" $IosOut

$syncSh = Join-Path $PetPalRoot "scripts\sync-petpal-web.sh"
if (Test-Path $syncSh) {
  foreach ($repo in @($AndroidOut, $IosOut)) {
    Copy-Item $syncSh (Join-Path $repo "scripts\sync-petpal-web.sh") -Force
  }
}

@'
{
  "appId": "io.petpal.app",
  "appName": "PetPal",
  "webDir": "web-app",
  "server": { "androidScheme": "https" }
}
'@ | Set-Content -Encoding utf8 (Join-Path $AndroidOut "capacitor.config.json")

@'
{
  "appId": "io.petpal.app",
  "appName": "PetPal",
  "webDir": "web-app",
  "server": { "androidScheme": "https" }
}
'@ | Set-Content -Encoding utf8 (Join-Path $IosOut "capacitor.config.json")

Write-Host '[export-mobile] Done. Push to GitLab - see docs/MOBILE_GITLAB.md'
