$ErrorActionPreference = 'Stop'

Describe 'UItoPrompt release packaging' {
    It 'creates a non-empty review archive without dependencies or secrets' {
        $output = Join-Path $TestDrive 'ui-to-prompt-review.zip'
        $expanded = Join-Path $TestDrive 'expanded'
        $repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
        $untracked = Join-Path $repoRoot 'UNTRACKED-DO-NOT-PACK.txt'
        $untrackedSecret = Join-Path $repoRoot 'local-secret.pem'

        try {
            Set-Content -LiteralPath $untracked -Value 'not part of the release'
            Set-Content -LiteralPath $untrackedSecret -Value 'synthetic secret material'

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
            (Test-Path -LiteralPath (Join-Path $expanded 'UNTRACKED-DO-NOT-PACK.txt')) | Should Be $false
            (Test-Path -LiteralPath (Join-Path $expanded 'local-secret.pem')) | Should Be $false
        }
        finally {
            Remove-Item -LiteralPath $untracked, $untrackedSecret -Force -ErrorAction SilentlyContinue
        }
    }
}
