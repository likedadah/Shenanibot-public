#! /usr/bin/bash

./node_modules/.bin/pkg -C Brotli .
./node_modules/.bin/pkg -C Brotli --out-path dist src/config/index.js

mv dist/shenanibot-win.exe dist/shenanibot.exe
mv dist/index-linux dist/shenanibot-config-linux
mv dist/index-macos dist/shenanibot-config-macos
mv dist/index-win.exe dist/shenanibot-config.exe
