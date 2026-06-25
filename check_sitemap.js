const https = require('https');

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
    console.log('Fetching sitemap from https://www.meowtarot.com/sitemap.xml ...');
    const {data: sitemapXml} = await fetchUrl('https://www.meowtarot.com/sitemap.xml');
    
    // Quick regex to extract all <loc>
    const matches = sitemapXml.match(/<loc>(.*?)<\/loc>/g);
    if (!matches) {
        console.log('No URLs found in sitemap');
        return;
    }
    
    const urls = matches.map(m => m.replace(/<\/?loc>/g, ''));
    console.log(`Found ${urls.length} URLs. Checking status codes...`);
    
    let errors = [];
    
    // Batch requests to not overwhelm the server
    const batchSize = 20;
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const promises = batch.map(async url => {
            try {
                // Do a HEAD request instead of GET for speed
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
