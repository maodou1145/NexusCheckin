@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem ============================================================
rem  NexusCheckin 定制打包（A 方案）
rem  用法：
rem    pack-for-user.bat <token> [昵称]
rem    pack-for-user.bat --file 用户列表.txt
rem  也可以直接把 token 拖到这个 bat 文件上（昵称会自动用序号）
rem ============================================================

set "NODE_EXE="
where node >nul 2>&1 && set "NODE_EXE=node"
if not defined NODE_EXE if exist "E:\nodejs\node.exe" set "NODE_EXE=E:\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE_EXE (
  echo.
  echo [错误] 找不到 node.exe。
  echo        请安装 Node.js，或把 node 加进 PATH 后重试。
  echo        说明：这个脚本只用 Node 做「校验 token + 复制工程 + 改写一行」，不参与编译。
  echo.
  pause
  exit /b 1
)

"%NODE_EXE%" "%~dp0pack-for-user.js" %*

echo.
pause
endlocal
