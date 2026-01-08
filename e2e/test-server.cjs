/**
 * E2Eテスト用HTTPサーバー
 *
 * ファイルベースのルーティング:
 * URLパス → e2e/pages/ 内のHTMLファイル
 * 例: /page → e2e/pages/page.html
 *     /link-with-target-blank → e2e/pages/link-with-target-blank.html
 *
 * 対応するHTMLファイルがない場合は page.html をフォールバックとして返す。
 * これにより /parent, /child など任意のパスで異なるURLを持つページを作成可能。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const pagesDir = path.join(__dirname, 'pages');
const fallbackPath = path.join(pagesDir, 'page.html');

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  const filePath = path.join(pagesDir, `${pathname}.html`);

  fs.readFile(filePath, 'utf-8', (err, html) => {
    if (err) {
      fs.readFile(fallbackPath, 'utf-8', (fallbackErr, fallbackHtml) => {
        if (fallbackErr) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fallbackHtml);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  console.log(`Listening on port ${port}`);
});
