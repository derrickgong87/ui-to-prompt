$ErrorActionPreference = 'Stop'

Describe 'UItoPrompt release packaging' {
    It 'creates a non-empty review archive without dependencies or secrets' {
        $output = Join-Path $TestDrive 'ui-to-prompt-review.zip'
        $expanded = Join-Path $TestDrive 'expanded'

        & (Join-Path $PSScriptRoot '..\scripts\package-release.ps1') -OutputPath $output

        (Test-Path -LiteralPath $output) | Should Be $true
        ((Get-Item -LiteralPath $output).Length -gt 0) | Should Be $true
        Expand-Archive -LiteralPath $output -DestinationPath $expanded
        (Test-Path -LiteralPath (Join-Path $expanded 'README.md')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $expanded 'skills\ui-to-prompt\SKILL.md')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $expanded 'apps\web\public\index.html')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $expanded 'node_modules')) | Should Be $false
        (Test-Path -LiteralPath (Join-Path $expanded '.git')) | Should Be $false
        (Test-Path -LiteralPath (Join-Path $expanded '.env')) | Should Be $false
    }
}
