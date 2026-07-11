$ErrorActionPreference = "Stop"

try {
  $inputJson = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($inputJson)) { exit 0 }
  $event = $inputJson | ConvertFrom-Json
  $prompt = [string]$event.prompt
  if ([string]::IsNullOrWhiteSpace($prompt) -or $prompt.Length -lt 12) { exit 0 }
  if ($prompt -notmatch '(?i)\b(memory|handoff|cache|compact|session|claude|obsidian|token|context|model|agent|haiku|sonnet|opus)\b') { exit 0 }

  # Fail closed: never guess a vault path. If the vault or scope is not
  # explicitly configured, inject nothing and do not create anything.
  if ([string]::IsNullOrWhiteSpace($env:OBSIDIAN_VAULT) -or [string]::IsNullOrWhiteSpace($env:MEMORY_PATCH_HARNESS_SCOPE)) { exit 0 }
  $vault = $env:OBSIDIAN_VAULT
  $scope = $env:MEMORY_PATCH_HARNESS_SCOPE
  $cli = "$HOME\.claude\bin\memory-patch-harness.mjs"
  if (!(Test-Path -LiteralPath $cli) -or !(Test-Path -LiteralPath $vault)) { exit 0 }

  # Metadata-only intake check: raw evidence never enters the Brain Brief.
  $intakeRaw = & node $cli intake-sweep --vault $vault --scope $scope --limit 1 --json 2>$null
  $intake = if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($intakeRaw)) { $intakeRaw | ConvertFrom-Json } else { $null }
  $recallRaw = & node $cli recall --vault $vault --query $prompt --scope $scope --json 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($recallRaw)) { exit 0 }
  $recall = $recallRaw | ConvertFrom-Json
  if (-not $recall.results -or $recall.results.Count -eq 0 -or $recall.confidence -eq "none") { exit 0 }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("Brain Brief from Obsidian memory. Use this as prior context only; verify before acting.")
  $lines.Add("Vault: $vault")
  $lines.Add("Scope: $scope")
  $lines.Add("Confidence: $($recall.confidence)")
  if ($intake) {
    $lines.Add("Intake queue: pending $($intake.summary.pending), secret-like $($intake.summary.secretLikeFiles). Raw evidence remains excluded from this brief.")
  }
  $lines.Add("")
  $i = 1
  foreach ($result in @($recall.results | Select-Object -First 3)) {
    $path = if ($result.path) { $result.path } elseif ($result.file) { $result.file } else { "" }
    $title = if ($result.title) { $result.title } elseif ($result.heading) { $result.heading } else { $path }
    $snippet = if ($result.snippet) { ([string]$result.snippet).Trim() } elseif ($result.text) { ([string]$result.text).Trim() } else { "" }
    if ($snippet.Length -gt 500) { $snippet = $snippet.Substring(0, 500) + "..." }
    $lines.Add("$i. $title")
    if ($path) { $lines.Add("   Path: $path") }
    if ($snippet) { $lines.Add("   Note: $snippet") }
    $i++
  }

  @{
    hookSpecificOutput = @{
      hookEventName = "UserPromptSubmit"
      additionalContext = ($lines -join "`n")
    }
  } | ConvertTo-Json -Depth 6 -Compress
} catch {
  exit 0
}
