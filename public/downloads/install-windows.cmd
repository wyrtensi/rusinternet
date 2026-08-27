@echo off
setlocal EnableExtensions

set "DRY_RUN=0"
if /i "%~1"=="--dry-run" set "DRY_RUN=1"

if "%DRY_RUN%"=="0" (
  "%SystemRoot%\System32\net.exe" session >nul 2>&1
  if errorlevel 1 goto :elevate
)
goto :main

:elevate
if /i "%~1"=="--elevated" (
  echo Could not obtain administrator rights.
  pause
  exit /b 1
)
echo Administrator rights are required. Confirm the Windows prompt.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath '%SystemRoot%\System32\cmd.exe' -ArgumentList '/d','/c','""%~f0"" --elevated' -Verb RunAs -PassThru -Wait; exit $p.ExitCode"
set "ELEV_EXIT=%errorlevel%"
if not "%ELEV_EXIT%"=="0" echo Installation did not complete. See the message in the elevated window.
exit /b %ELEV_EXIT%

:main
set "WORK_DIR=%TEMP%\rusinternet-certificates-%RANDOM%%RANDOM%"
if "%DRY_RUN%"=="0" set "WORK_DIR=%SystemRoot%\Temp\rusinternet-certificates-%RANDOM%%RANDOM%"
mkdir "%WORK_DIR%" >nul 2>&1
if errorlevel 1 (
  echo Could not create a temporary directory.
  goto :failed
)

call :download_and_verify "russian_trusted_root_ca.cer" "936A43FEA6E8E525BCC0F81ACD9C3D21B4FC4B9B68ACEA7906D698005AFC6504"
if errorlevel 1 goto :failed
call :download_and_verify "russian_trusted_root_ca_gost_2025.cer" "5B51DB721B7C34958ED7432AE917A91297DD37508B2CAE4F858FFBAC6BC525EF"
if errorlevel 1 goto :failed
call :download_and_verify "russian_trusted_sub_ca.cer" "F0AE589F36774F29EF3648F7984B08D42FCCE6F1FFEEB6236D773DAEB2744EA6"
if errorlevel 1 goto :failed
call :download_and_verify "russian_trusted_sub_ca_2024.cer" "6F9D829C8E6712444FCE3624658D8788672849C5D5B7B53FD9CF7E83EAC4193E"
if errorlevel 1 goto :failed
call :download_and_verify "russian_trusted_sub_ca_gost_2025.cer" "B809281BF07B865BCDD7F5746BF1EBB7CCEE093D5C63B016DD91EE3B22CDA8D1"
if errorlevel 1 goto :failed

echo CERTIFICATES_VERIFIED=5
if "%DRY_RUN%"=="1" goto :success

echo Installing root certificates...
"%SystemRoot%\System32\certutil.exe" -addstore -f Root "%WORK_DIR%\russian_trusted_root_ca.cer" >nul || goto :failed
"%SystemRoot%\System32\certutil.exe" -addstore -f Root "%WORK_DIR%\russian_trusted_root_ca_gost_2025.cer" >nul || goto :failed

echo Installing intermediate certificates...
"%SystemRoot%\System32\certutil.exe" -addstore -f CA "%WORK_DIR%\russian_trusted_sub_ca.cer" >nul || goto :failed
"%SystemRoot%\System32\certutil.exe" -addstore -f CA "%WORK_DIR%\russian_trusted_sub_ca_2024.cer" >nul || goto :failed
"%SystemRoot%\System32\certutil.exe" -addstore -f CA "%WORK_DIR%\russian_trusted_sub_ca_gost_2025.cer" >nul || goto :failed

call :verify_store Root "8FF915CCAB7BC16F8C5C8099D53E0E115B3AEC2F" || goto :failed
call :verify_store Root "656F78A4649A650E54043043B1C5EEEC128704A9" || goto :failed
call :verify_store CA "335D43F53451B781535FF3882DF713D3C14F8A01" || goto :failed
call :verify_store CA "6741AB02CF6598C09652DC34D2DC095904E32B52" || goto :failed
call :verify_store CA "59064DECEBC5145CC1BE8465C292CBE2EF83B31D" || goto :failed

echo.
echo Done. All five certificates are installed and verified.
echo Restart your browser.

:success
rmdir /s /q "%WORK_DIR%" >nul 2>&1
if /i "%~1"=="--elevated" pause
exit /b 0

:failed
echo.
echo Installation stopped. A certificate check or a Windows command failed.
echo Nothing was changed on this computer.
rmdir /s /q "%WORK_DIR%" >nul 2>&1
if /i "%~1"=="--elevated" pause
exit /b 1

:download_and_verify
set "CERT_NAME=%~1"
set "EXPECTED_HASH=%~2"
set "CERT_PATH=%WORK_DIR%\%CERT_NAME%"
if defined RUSINTERNET_CERT_SOURCE (
  copy /y "%RUSINTERNET_CERT_SOURCE%\%CERT_NAME%" "%CERT_PATH%" >nul
) else (
  "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri 'https://rusinternet.com/downloads/certificates/%CERT_NAME%' -OutFile '%CERT_PATH%'"
)
if errorlevel 1 exit /b 1
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$stream=[IO.File]::OpenRead('%CERT_PATH%'); try { $hash=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($stream)).Replace('-','') } finally { $stream.Dispose() }; if ($hash -ne '%EXPECTED_HASH%') { exit 1 }"
exit /b %errorlevel%

:verify_store
"%SystemRoot%\System32\certutil.exe" -store "%~1" "%~2" >nul 2>&1
exit /b %errorlevel%
