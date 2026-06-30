#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path 'signing/keystore.properties')) {
  throw 'Missing signing/keystore.properties — copy from signing/keystore.properties.example or use signing/UPLOAD_KEY_CREDENTIALS.md'
}

if (-not (Test-Path 'local.properties')) {
  if ($env:ANDROID_HOME) {
    "sdk.dir=$($env:ANDROID_HOME -replace '\\','\\')" | Set-Content -Encoding ascii local.properties
  } else {
    throw 'Create local.properties (see local.properties.example) or set ANDROID_HOME'
  }
}

Write-Host '[build] Sync web assets from petpal/'
Push-Location (Join-Path $Root '..\petpal')
npm run build:mobile
Pop-Location

Write-Host '[build] Gradle bundleRelease'
& .\gradlew.bat bundleRelease

$versionLine = Select-String -Path 'app/build.gradle' -Pattern 'versionName' | Select-Object -First 1
$versionName = if ($versionLine -match '"([^"]+)"') { $Matches[1] } else { '1.0' }
$outDir = Join-Path $Root 'releases'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$dest = Join-Path $outDir "petpal-$versionName-release.aab"
Copy-Item -Force (Join-Path $Root 'app/build/outputs/bundle/release/app-release.aab') $dest
Write-Host "[build] Done: $dest"
