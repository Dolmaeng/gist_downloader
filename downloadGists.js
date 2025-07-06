// downloadGists.js
const puppeteer = require('puppeteer');
const fs        = require('fs');
const axios     = require('axios');
const path      = require('path');

async function fetchZipHref(page, gistUrl) {
  await page.goto(gistUrl, { waitUntil: 'networkidle2' });
  return page.$eval('a[href$=".zip"]', el => el.href);
}

async function downloadGistZip(gistUrl) {
  // Gist ID 기반으로 출력 파일명 결정
  const gistId = path.basename(new URL(gistUrl).pathname);
  const outputPath = `${gistId}.zip`;

  // ZIP 링크 추출
  const browser = await puppeteer.launch({ headless: true });
  const page    = await browser.newPage();
  const zipHref = await fetchZipHref(page, gistUrl);
  await browser.close();

  // 스트림 다운로드 + 진행률 표시
  const writer   = fs.createWriteStream(outputPath);
  const response = await axios.get(zipHref, { responseType: 'stream' });
  const total    = response.headers['content-length']
                   ? parseInt(response.headers['content-length'], 10)
                   : null;
  let downloaded = 0;

  process.stdout.write(`다운로드 시작: ${outputPath}\n`);
  response.data.on('data', chunk => {
    downloaded += chunk.length;
    if (total) {
      const pct = ((downloaded / total) * 100).toFixed(2);
      process.stdout.write(`\r  → ${pct}%`);
    } else {
      process.stdout.write(`\r  → ${downloaded} bytes`);
    }
  });

  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log(`\n✅ 완료: ${outputPath}`);
      resolve();
    });
    writer.on('error', reject);
  });
}

(async () => {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error('Usage: node downloadGists.js <gistUrl1> <gistUrl2> ...');
    process.exit(1);
  }

  // 모든 다운로드를 병렬로 실행
  await Promise.all(
    urls.map(url => 
      downloadGistZip(url)
        .catch(err => console.error(`❌ 실패 [${url}]: ${err.message}`))
    )
  );
})();

