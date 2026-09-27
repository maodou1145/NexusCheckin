@echo off
chcp 65001 >nul
title NexusCheckin - 取 Token
echo 将在浏览器里打开 ws.fseatech.cn，请登录（过一下滑块）。
echo 登录成功后本窗口会自动保存 Token，可以关掉。
echo.
"C:/Program Files\PyManager\python.exe" "%~dp0get-token.py" %*
echo.
echo 按任意键关闭...
pause >nul
