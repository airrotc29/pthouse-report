# 아티팩트 본문(app.html) → GitHub Pages용 완전한 HTML 문서(index.html)
import sys
body = open(sys.argv[1], encoding='utf8').read()
head = ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<title>사업소 보고 현황판</title>\n<style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style>\n'
        '<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#0f2340">\n'
        '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n<meta name="apple-mobile-web-app-title" content="파트너스 보고">\n'
        '<link rel="icon" type="image/svg+xml" href="logo.svg">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
        '<script>if("serviceWorker" in navigator && location.protocol==="https:")addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));</script>\n'
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js"></script>\n<script src="config.js"></script>\n</head>\n<body>\n')
open(sys.argv[2], 'w', encoding='utf8').write(head + body.rstrip() + '\n</body>\n</html>\n')
