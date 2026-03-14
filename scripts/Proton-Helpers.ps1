# Proton-Helpers.ps1
# Shared helper functions for the Proton toolkit

function Write-Proton {
    <#
        .SYNOPSIS
            Write a coloured message to the console.

        .PARAMETER Message
            Text to display.

        .PARAMETER Color
            Foreground colour (defaults to White).
    #>
    param(
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet("Cyan","Yellow","Green","Red","White","Magenta","Blue")][string]$Color = "White"
    )

    Write-Host $Message -ForegroundColor $Color
}

# Convenience wrappers for common message types
function Write-Info    { param([string]$Message) Write-Proton $Message "Cyan" }
function Write-WarningX{ param([string]$Message) Write-Proton $Message "Yellow" }
function Write-Success { param([string]$Message) Write-Proton $Message "Green" }
function Write-ErrorX  { param([string]$Message) Write-Proton $Message "Red" } 
