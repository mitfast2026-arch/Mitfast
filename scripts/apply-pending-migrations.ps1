# Apply pending Supabase migrations to MITFAST project qubphaacuuwlpdrsprjl only.
# Run in a terminal where `supabase login` succeeded (mitfast2026@gmail.com).
#
# Usage:  npm run db:push
#    or:  .\scripts\apply-pending-migrations.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$expectedRef = 'qubphaacuuwlpdrsprjl'
$linkedRef = (Get-Content 'supabase\.temp\project-ref' -Raw).Trim()

if ($linkedRef -ne $expectedRef) {
  throw "Wrong linked project: $linkedRef (expected $expectedRef). Run: supabase link --project-ref $expectedRef"
}

Write-Host "Linked project: $linkedRef" -ForegroundColor Cyan
Write-Host "`n--- Migration status (before) ---" -ForegroundColor Yellow
supabase migration list

Write-Host "`n--- Marking already-applied migrations in history ---" -ForegroundColor Yellow
supabase migration repair --status applied `
  20260822180000 `
  20260822190000 `
  20260822190100 `
  20260823090000 `
  20260823120000 `
  20260823130000 `
  20260823140000

Write-Host "`n--- Pushing pending migrations ---" -ForegroundColor Yellow
supabase db push --yes

Write-Host "`n--- Migration status (after) ---" -ForegroundColor Yellow
supabase migration list

Write-Host "`n--- Regenerating TypeScript types ---" -ForegroundColor Yellow
npm run types:gen

Write-Host "`nDone. Verify RPCs exist:" -ForegroundColor Green
Write-Host "  convert_rfq_to_order_atomic, convert_enquiry_to_order_atomic, admin_dashboard_metrics"
