Get-ChildItem -Recurse -File | ForEach-Object {
    $path = $_.FullName
    try {
        $text = Get-Content -LiteralPath $path -Raw -ErrorAction Stop
    } catch {
        return
    }
    if ($text -match '(?i)Proton') {
        $new = $text -replace '(?i)Proton', 'Proton'
        Set-Content -LiteralPath $path -Value $new
        Write-Host "Updated: $path"
    }
}
Write-Host "Done replacement."

