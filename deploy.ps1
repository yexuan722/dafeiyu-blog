# 一键构建 + 部署到 Cloudflare Pages
#
# 用法：
#   .\deploy.ps1                  # 构建并部署到 yexuan-blog 项目
#   .\deploy.ps1 -ProjectName xx  # 指定其他项目名
#
# 第一次运行会弹出浏览器让你登录 Cloudflare，之后会记住凭证。

param(
    [string]$ProjectName = "yexuan-blog"
)

$ErrorActionPreference = "Stop"

# 用 DSH 自带的 Node，避免 PATH 里没有 node
$nodeBin = "C:\Users\37931\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin"
$pnpm = "C:\Users\37931\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs"
if (Test-Path $nodeBin) { $env:PATH = "$nodeBin;$env:PATH" }

Set-Location $PSScriptRoot

Write-Host "[1/3] 构建..." -ForegroundColor Cyan
node $pnpm exec astro build
if ($LASTEXITCODE -ne 0) { throw "构建失败" }

Write-Host "[2/3] 检查产物..." -ForegroundColor Cyan
if (-not (Test-Path "dist/index.html")) { throw "dist/index.html 不存在，构建可能没成功" }
$size = [math]::Round((Get-ChildItem dist -Recurse -File | Measure-Object Length -Sum).Sum / 1KB)
Write-Host "      dist/ 共 $size KB"

Write-Host "[3/3] 部署到 Cloudflare Pages: $ProjectName" -ForegroundColor Cyan
node $pnpm dlx wrangler@latest pages deploy dist --project-name=$ProjectName

Write-Host ""
Write-Host "完成。首次部署 Cloudflare 会给你一个 *.pages.dev 的临时域名，" -ForegroundColor Green
Write-Host "去 Dashboard -> Pages -> $ProjectName -> Custom domains 绑定 yexuan.qzz.io 即可。" -ForegroundColor Green
