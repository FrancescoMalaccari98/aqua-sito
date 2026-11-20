@echo off
rem Aqua - smart mirror launcher for Windows (double click).
rem Runs avvia-specchio-windows.ps1 with PowerShell, without changing the system execution policy.
title Specchio Aqua
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0avvia-specchio-windows.ps1"
if errorlevel 1 pause
