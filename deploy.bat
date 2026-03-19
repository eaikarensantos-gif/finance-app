@echo off
cd /d "C:\Users\DELL\Documents\finance-app"
git add .
git commit -m "update"
git pull --rebase origin main
git push
echo.
echo Deploy enviado! Aguarde 2-3 minutos e acesse o Vercel.
pause
