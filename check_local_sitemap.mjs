import fs from 'fs';
import https from 'https';
import path from 'path';

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({status: res.statusCode, data}));
        }).on('error', err => reject(err));
    });
}

async function checkSitemap() {
    console.log('Reading local sitemap.xml ...');
    const sitemapXml = fs.readFileSync(path.join(process.cwd(), 'sitemap.xml'), 'utf8');
    
    const matches = sitemapXml.match(/<loc>(.*?)<\/loc>/g);
    if (!matches) {
        console.log('No URLs found in sitemap');
        return;
    }
    
    // In index sitemaps (if SEPARATE_LANG_SITEMAPS is true), the urls might be sitemap-en.xml etc
    let urls = matches.map(m => m.replace(/<\/?loc>/g, ''));
    if (urls.some(u => u.endsWith('.xml'))) {
        console.log('It is a sitemap index. Reading child sitemaps...');
        let allUrls = [];
        for (const idxUrl of urls) {
            const filename = idxUrl.split('/').pop();
            const childXml = fs.readFileSync(path.join(process.cwd(), filename), 'utf8');
            const childMatches = childXml.match(/<loc>(.*?)<\/loc>/g);
            if (childMatches) {
                allUrls.push(...childMatches.map(m => m.replace(/<\/?loc>/g, '')));
            }
        }
        urls = allUrls;
    }
    
    console.log(`Found ${urls.length} URLs. Checking status codes...`);
    
    let errors = [];
    
    const batchSize = 20;
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const promises = batch.map(async url => {
            try {
                return new Promise((resolve) => {
                    const req = https.request(url, {method: 'HEAD'}, (res) => {
                        resolve({url, status: res.statusCode});
                    });
                    req.on('error', () => resolve({url, status: 'ERROR'}));
                    req.end();
                });
            } catch (e) {
                return {url, status: 'ERROR'};
            }
        });
        
        const results = await Promise.all(promises);
        for (const res of results) {
            if (res.status !== 200) {
                console.log(`❌ ${res.status} - ${res.url}`);
                errors.push(res);
            }
        }
    }
    
    if (errors.length === 0) {
        console.log('✅ All URLs returned 200 OK.');
    } else {
        console.log(`\nFound ${errors.length} URLs that did not return 200 OK.`);
    }
}

checkSitemap();
