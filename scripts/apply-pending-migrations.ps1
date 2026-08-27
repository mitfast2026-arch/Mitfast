# Apply pending Supabase migrations to MITFAST project qubphaacuuwlpdrsprjl only.
# Run in a terminal where `supabase login` succeeded (mitfast2026@gmail.com).
#
# Usage:  npm run db:push
#    or:  .\scripts\apply-pending-migrations.ps1

Set-Location (Split-Path $PSScriptRoot -Parent)

$expectedRef = 'qubphaacuuwlpdrsprjl'
$linkedRef = (Get-Content 'supabase\.temp\project-ref' -Raw).Trim()

if ($linkedRef -ne $expectedRef) {
  throw "Wrong linked project: $linkedRef (expected $expectedRef). Run: supabase link --project-ref $expectedRef"
}

# Supabase CLI prints progress on stderr; with Stop, PowerShell treats that as fatal.
$ErrorActionPreference = 'Continue'

function Invoke-Supabase {
  param([Parameter(Mandatory)][string[]]$Args)
  $out = & supabase @Args 2>&1 | ForEach-Object { $_.ToString() }
  $code = $LASTEXITCODE
  [pscustomobject]@{
    ExitCode = $code
    Output   = ($out -join "`n")
  }
}

Write-Host "Linked project: $linkedRef" -ForegroundColor Cyan
Write-Host "`n--- Migration status (before) ---" -ForegroundColor Yellow
$before = Invoke-Supabase -Args @('migration', 'list')
Write-Host $before.Output
if ($before.Output -match 'does not have the necessary privileges|LegacyDbConfigLoginRoleStatusError|LegacyInvalidAccessTokenError|Invalid access token|403') {
  throw "Supabase CLI auth/DB access failed for $expectedRef. Clear `$env:SUPABASE_ACCESS_TOKEN if set, then: supabase logout; supabase login (mitfast2026@...); supabase link --project-ref $expectedRef"
}
if ($before.ExitCode -ne 0) {
  throw "supabase migration list failed (exit $($before.ExitCode))"
}

Write-Host "`n--- Pushing pending migrations ---" -ForegroundColor Yellow
$push = Invoke-Supabase -Args @('db', 'push', '--yes')
Write-Host $push.Output
if ($push.Output -match 'does not have the necessary privileges|LegacyDbConfigLoginRoleStatusError|LegacyInvalidAccessTokenError|Invalid access token|403') {
  throw "supabase db push failed (auth). Re-login as MITFAST owner and retry."
}
if ($push.ExitCode -ne 0) {
  throw "supabase db push failed (exit $($push.ExitCode))"
}

Write-Host "`n--- Migration status (after) ---" -ForegroundColor Yellow
$after = Invoke-Supabase -Args @('migration', 'list')
Write-Host $after.Output

Write-Host "`n--- Regenerating TypeScript types ---" -ForegroundColor Yellow
npm run types:gen
if ($LASTEXITCODE -ne 0) {
  throw "types:gen failed (exit $LASTEXITCODE)"
}

Write-Host "`nDone. Verify RPCs exist:" -ForegroundColor Green
Write-Host "  convert_rfq_to_order_atomic, convert_enquiry_to_order_atomic, admin_dashboard_metrics"
