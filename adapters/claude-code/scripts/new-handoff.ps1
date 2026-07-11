param(
  [string]$Path = ".\HANDOFF.md"
)

$template = Join-Path $HOME ".claude\templates\HANDOFF.md"
if (Test-Path -LiteralPath $Path) {
  Write-Host "Handoff already exists: $Path"
  exit 0
}

Copy-Item -LiteralPath $template -Destination $Path
Write-Host "Created $Path"
