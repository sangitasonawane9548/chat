# Auto-Push script for MELT Platform
param(
  [string]$Message = "chore: sync latest MELT updates"
)

Write-Host "🔄 Staging all changes..." -ForegroundColor Cyan
git add -A

$status = git status --porcelain
if (-not $status) {
  Write-Host "✅ Working directory clean, no new changes to commit." -ForegroundColor Green
} else {
  Write-Host "📦 Creating commit: $Message..." -ForegroundColor Cyan
  git commit -m $Message
}

Write-Host "🚀 Pushing to https://github.com/sangitasonawane9548/chat.git (main)..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host "🎉 Successfully pushed to GitHub!" -ForegroundColor Green
} else {
  Write-Host "⚠️ Git push encountered an error." -ForegroundColor Red
}

