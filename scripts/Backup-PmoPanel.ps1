$projectRoot = 'C:\Users\jonathan.viana\Downloads\PMO - Painel de Projetos'
$backupRoot = Join-Path $projectRoot 'backups\diarios'
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$archive = Join-Path $backupRoot "PMO-Painel-de-Projetos_$stamp.zip"

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$items = Get-ChildItem -LiteralPath $projectRoot -Force | Where-Object {
  $_.Name -notin @('node_modules', '.next', '.vinext', '.wrangler', 'dist', 'backups')
}
Compress-Archive -LiteralPath $items.FullName -DestinationPath $archive -CompressionLevel Optimal -ErrorAction Stop

if (-not (Test-Path -LiteralPath $archive) -or (Get-Item -LiteralPath $archive).Length -lt 1kb) {
  throw 'O arquivo de backup não foi criado corretamente.'
}

Write-Output "Backup criado: $archive"
