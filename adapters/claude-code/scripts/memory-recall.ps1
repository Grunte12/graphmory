param(
  [Parameter(Mandatory = $true)]
  [string]$Query,
  [string]$Scope = $env:MEMORY_PATCH_HARNESS_SCOPE
)

$vault = if ($env:OBSIDIAN_VAULT) { $env:OBSIDIAN_VAULT } else { Join-Path $HOME "ObsidianVault" }
$cli = "$HOME\.claude\bin\memory-patch-harness.mjs"
if (-not $Scope) { $Scope = "02 Projects\Claude Code Memory" }

node $cli recall --vault $vault --query $Query --scope $Scope --json
