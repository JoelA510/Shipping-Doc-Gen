Write-Host "Please close your IDE (VS Code) and any terminals usage this folder before running this script."
Write-Host "This script will rename the current directory to 'FormWaypoint'."

$currentPath = Get-Location
$parentPath = Split-Path -Parent $currentPath
$newName = "FormWaypoint"
$newPath = Join-Path $parentPath $newName

Write-Host "Current Path: $currentPath"
Write-Host "Target Path: $newPath"

$confirmation = Read-Host "Do you want to proceed? (y/n)"
if ($confirmation -eq 'y') {
    try {
        Rename-Item -Path $currentPath -NewName $newName -ErrorAction Stop
        Write-Host "Successfully renamed to $newName"
        Write-Host "You can now open the new folder in VS Code."
    } catch {
        Write-Error "Failed to rename folder. Ensure no files are open in it."
        Write-Error $_
    }
} else {
    Write-Host "Operation cancelled."
}
