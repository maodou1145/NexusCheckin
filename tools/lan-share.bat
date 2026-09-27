@echo off
chcp 65001 >nul
title NexusCheckin - 局域网共享（窗口别关）
echo 把 Token 通过局域网提供给手表。窗口需要一直开着（关闭即停止）。
echo.
"C:/Program Files\PyManager\python.exe" "%~dp0lan-share.py" %*
echo.
echo 服务已停止。按任意键关闭...
pause >nul
