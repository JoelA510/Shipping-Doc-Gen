$jdeDir = "c:\Users\joel.abraham\Shipping Doc Gen\Shipping-Doc-Gen\training_docs\JDE Output"
$neuDir = "c:\Users\joel.abraham\Shipping Doc Gen\Shipping-Doc-Gen\training_docs\Nippon Express"
$cevaDir = "c:\Users\joel.abraham\Shipping Doc Gen\Shipping-Doc-Gen\training_docs\Ceva"

Write-Host "Reading Carrier files into memory..."

# Cache NEU files
$neuCache = @{}
$neuFiles = Get-ChildItem -Path $neuDir -Recurse -Filter "*.pdf"
foreach ($file in $neuFiles) {
    try {
        # Read as string (latin1 to preserve bytes as chars roughly)
        # Actually -Raw is UTF8 by default or auto-detect. For binary PDF, we just want a string representation.
        # We'll use [System.IO.File]::ReadAllText with Latin1 to avoid decoding errors and keep 1-to-1 byte mapping
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::GetEncoding(28591))
        $neuCache[$file.Name] = $content
    } catch {
        Write-Host "Error reading $($file.Name)"
    }
}
Write-Host "Cached $($neuCache.Count) NEU files."

# Cache Ceva files
$cevaCache = @{}
$cevaFiles = Get-ChildItem -Path $cevaDir -Recurse -Filter "*.pdf"
foreach ($file in $cevaFiles) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::GetEncoding(28591))
        $cevaCache[$file.Name] = $content
    } catch {
        Write-Host "Error reading $($file.Name)"
    }
}
Write-Host "Cached $($cevaCache.Count) Ceva files."

# Get JDE files and IDs
$jdeFiles = Get-ChildItem -Path $jdeDir -Filter "*_PDF.pdf"
$results = @()

foreach ($jdeFile in $jdeFiles) {
    if ($jdeFile.Name -match ".*_(\d+)_PDF.*") {
        $id = $matches[1]
        # Write-Host "Searching for ID: $id"
        
        # Check NEU Cache
        foreach ($name in $neuCache.Keys) {
            if ($neuCache[$name] -match $id) {
                Write-Host "  MATCH FOUND: $id in NEU $name"
                $results += [PSCustomObject]@{
                    JDE_ID = $id
                    JDE_File = $jdeFile.Name
                    Carrier = "Nippon Express"
                    Carrier_File = $name
                }
            }
        }

        # Check Ceva Cache
        foreach ($name in $cevaCache.Keys) {
            if ($cevaCache[$name] -match $id) {
                Write-Host "  MATCH FOUND: $id in CEVA $name"
                $results += [PSCustomObject]@{
                    JDE_ID = $id
                    JDE_File = $jdeFile.Name
                    Carrier = "Ceva"
                    Carrier_File = $name
                }
            }
        }
    }
}

Write-Host "`n--- SUMMARY ---"
$results | Format-Table -AutoSize
