#!/usr/bin/env pwsh

# PowerShell script for zyte CLI
# Usage: zyte <command>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Join-Path $ScriptDir ".."

Set-Location $ProjectRoot
bun run src/cli.ts $args 