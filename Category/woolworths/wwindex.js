const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const { Cluster } = require('puppeteer-cluster');
// Add stealth plugin and use defaults 
const pluginStealth = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
// Use stealth 
puppeteer.use(pluginStealth());
const urls = [
    "https://www.woolworths.com.au/shop/browse/fruit-veg?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/meat-seafood-deli?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/bakery?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/dairy-eggs-fridge?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/health-wellness?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/lunch-box?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/drinks?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/liquor?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/baby?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/pet?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/pantry?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/snacks-confectionery?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/beauty-personal-care?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/household?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
    "https://www.woolworths.com.au/shop/browse/freezer?sortBy=TraderRelevance&pageNumber=1&filter=SoldBy(Woolworths)",
];
//Launch pupputeer-stealth 
Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 5,
    retryLimit: 2,
    timeout: 4200000,
    // monitor:true,
    puppeteerOptions: {
        headless: false,
        defaultViewport: null,
        executablePath: executablePath(),
        // devtools: true,
        userDataDir: "./tmp",
        timeout: 6000000,
        protocolTimeout: 6000000,
        args: ['--start-maximized',
            '--cpu-profile-interval=500',
            '--memory-pressure-off',
            '--no-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process']
    }
}).then(async cluster => {
    cluster.on("taskerror", (err, data) => {
        console.log(`Error Crawling ${data}: ${err.message}`)
    });
    await cluster.task(async ({ page, data: url }) => {
        await page.goto(url, {
            waitUntil: 'load',
            timeout: 600000
        });
        await page.waitForSelector('#search-content');
        const category = await page.$eval('div > h1.browseContainer-title.ng-star-inserted', el => el.textContent.trim());
        let isBtn = true;
        const scrapedData = [];
        while (isBtn) {
            await page.waitForSelector('shared-grid');
            const productHandles = await page.$$('.product-tile-v2', { timeout: 35000, visible: true });
            for (const productHandle of productHandles) {
                let price = "Null"; let title = 'Null'; let image = "Null";
                try {
                    title = await page.evaluate(
                        el => el.querySelector('.product-title-link').textContent, productHandle);
                } catch (error) { }
                try {
                    price = await page.evaluate(
                        el => { const priceString = el.querySelector('div.primary').textContent.replace('$', '').trim(); return parseFloat(priceString) }, productHandle);
                } catch (error) { }
                try {
                    image = await page.evaluate(
                        el => el.querySelector('.product-tile-v2--image > a > img').getAttribute('src'), productHandle);
                } catch (error) { }
                scrapedData.push({
                    itemTitle: title,
                    itemPrice: price,
                    itemImage: image,
                });
            }
            await page.waitForSelector("div.paging-section", { visible: true });
            const is_button = await page.evaluate(() => document.querySelector('a.paging-next') !== null);
            isBtn = is_button;
            if (is_button) {
                await page.waitForSelector("a.paging-next.ng-star-inserted", { visible: true, timeout: 35000 });
                await page.click("span.next-marker", { delay: 6000 });
            }
            else {
                await new Promise(resolve => setTimeout(resolve, 6000));
            }
        }
        //write to file on category based
        fs.writeFileSync(`./wwcategory/${category}.json`, JSON.stringify(scrapedData), "utf-8", (err) => {
            if (err) throw err;
        });
        console.log(`Success!!, ${category} scrpaed data has been saved to JSON file`);
    });
    for (const url of urls) {
        await cluster.queue(url);
    }
    await cluster.idle();
    await cluster.close();

});