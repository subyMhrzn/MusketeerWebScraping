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
    maxConcurrency: 1,
    retryLimit: 5,
    timeout: 20000000,
    // monitor:true,
    
    puppeteerOptions: {
        headless: false,
        defaultViewport: null,
        executablePath: executablePath(),
        // devtools: true,
        userDataDir : "./tmp",
        timeout:6000000,
        protocolTimeout: 6000000,
        args: ['--start-maximized', '--cpu-profile-interval=500', '--memory-pressure-off', '--no-sandbox', '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process']
        
    }
}).then(async cluster => {
   
    cluster.on("taskerror", (err, data) => {
        console.log(`Error Crawling ${data}: ${err.message}`)
    });

    await cluster.task(async ({ page, data: url }) => {
        // await page.setRequestInterception(true);
        // page.on('request', (req) => {
        //   if (req.resourceType() === 'image') {
        //     req.abort();
        //   } else {
        //     req.continue();
        //   }
        // });
        await page.goto(url, {    
             waitUntil : 'load',
             timeout: 600000
        });
        await page.waitForSelector('#search-content');
        const category = await page.$eval('div > h1.browseContainer-title.ng-star-inserted', el => el.textContent);
        const scrapedData = [];
        let isBtn = true;
       
        while (isBtn) {
            
            await page.waitForSelector('shared-grid', {visible:true, timeout:40000});
            const linksofpage=await page.$$eval('.product-tile-v2', links => {
                // extract links form page data
            links = links.map(el => el.querySelector('a.product-title-link').href);
                return links;
        });    
        // console.log(linksofpage);

        const innerCluster= await Cluster.launch({
            concurrency : Cluster.CONCURRENCY_PAGE,
            maxConcurrency:10,
            retryLimit: 2,
            timeout: 6000000,
            puppeteerOptions:{
                headless: false,
                defaultViewport: null,
                timeout: 6000000,
                args: ['--start-maximized', '--cpu-profile-interval=500', '--memory-pressure-off', '--no-sandbox', '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process']
            }
        });

        innerCluster.on("takserror", (err, data) => {
            console.log(`Error crawling ${data}: ${err.message}`);
        });
        await innerCluster.task(async({ page, data:link}) =>{
            await page.goto(link, {waitUntil: "load", timeout: 6000000})
            await page.waitForSelector('.ar-product-detail-container');
            let title= 'null'; let itemdetails='null'; let itemingredients= 'null'; let price= "null"; let image = "null";
            try {
                title= await page.$eval('h1.shelfProductTile-title.heading3', text => text.textContent);
                } catch(error){}
            // try {
            //         price= await page.$eval('div.shelfProductTile-price > div', text => text.textContent.replace(/\n/g,'').replace("$",'').replace(/\s+/, ''));
            //         } catch(error){}
            // try {
            //     image = await page.$eval('div.main-image-container-v2.main-image-container-v2-desktop > img', text => text.src);
            //     } catch(error){}
            
            try{
                    itemdetails= await page.$eval('div > .ar-view-more > div.viewMore> div > div> div.viewMore-content', text => text.textContent.replace(/\n/g, '').trim());
                    } catch(error) {}
            try{
                itemingredients = await page.$eval('section.ingredients > .ar-view-more > div > div > div > div.viewMore-content', text => text.textContent.replace(/\n/g, '').trim());
                    } catch(error) {}

                 
                 scrapedData.push({
                        wwItemTitle: title,
                        // wwItemPrice: price,
                        // wwItemImage: image,
                        wwItemDetails: itemdetails,
                        wwItemIngredients : itemingredients
                        
                    });

        });
       
       for( link of linksofpage){
        await innerCluster.queue(link);
       }
        await innerCluster.idle();
        await innerCluster.close();
            await page.waitForSelector("div.paging-section", {visible: true});
            const is_button = await page.evaluate(() => document.querySelector('a.paging-next') !== null);
            isBtn = is_button;
            if (is_button) {
               await Promise.all([
                 page.waitForSelector("a.paging-next.ng-star-inserted", { visible: true, timeout: 35000 }),
                     page.click("span.next-marker",{delay:2000}),                     
                ]);
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