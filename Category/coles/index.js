const { Cluster } = require('puppeteer-cluster');
const fs = require('fs');
//const puppeteer= require('puppeteer');



const urls = [
    "https://www.coles.com.au/browse/meat-seafood",
    "https://www.coles.com.au/browse/fruit-vegetables",
    "https://www.coles.com.au/browse/dairy-eggs-fridge",
    "https://www.coles.com.au/browse/bakery",
    "https://www.coles.com.au/browse/deli",
    "https://www.coles.com.au/browse/household",
    "https://www.coles.com.au/browse/health-beauty",
    "https://www.coles.com.au/browse/baby",
    "https://www.coles.com.au/browse/pet",
    "https://www.coles.com.au/browse/liquor",
    "https://www.coles.com.au/browse/bonus-cookware-credits",
    "https://www.coles.com.au/browse/pantry",
    "https://www.coles.com.au/browse/drinks",
    "https://www.coles.com.au/browse/frozen",
];

(async () => {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 5,
        retryLimit: 5,
        timeout: 4200000,
        // monitor: true,
        puppeteerOptions: {
            headless: false,
            // defaultViewport: false,
            // userDataDir: "./tmp",
            timeout: 6000000,
            protocolTimeout: 6000000,
            // args: ['--start-maximized']
            // devtools:true,
           
            args: [
            //     // '--start-maximized',
                 '--cpu-profile-interval=500', '--memory-pressure-off', '--no-sandbox', '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process']
        }
    });



    cluster.on("taskerror", (err, data) => {
        console.log(`Error crawling ${data}: ${err.message}`);
    });

    await cluster.task(async ({ page, data: url }) => {

        await page.goto(url, {
            waitUntil: "load",
            // timeout: 600000
        });
        
        await page.waitForSelector("button#pagination-button-next",{visible: true, timeout:35000});
        await page.waitForSelector('div#coles-targeting-main-container');
        const category = await page.$eval('div > h1', el => el.textContent);
        let isBtnDisabled = false;
        const scrapedData = [];
        const delay= 500;
        const scrollAmount= 900; 
        while (!isBtnDisabled) {
            await page.waitForSelector('section[data-testid="product-tile"]');
            const productHandles = await page.$$('.product__header');
            let currentPosition = 0;
            const scrollHeight = await page.evaluate(()=> document.documentElement.scrollHeight);
       
         while(currentPosition < scrollHeight){
            await page.evaluate((scrollAmount)=>{
                window.scrollBy(0,scrollAmount,{behavior: 'smooth'});
            },scrollAmount);
            await new Promise(resolve => setTimeout(resolve, delay));
            currentPosition +=scrollAmount;
            
             }    
            for (const productHandle of productHandles) {
                let title = "Null";
                let price = "Null";
                let image = "Null";
                
                try {
                    
                    title = await page.evaluate(
                        el => el.querySelector('.product__title').textContent, productHandle);
                } catch (error) { }

                try {
                    
                    price = await page.evaluate(
                        el => {const priceString= el.querySelector('.price__value').textContent.replace('$', '').trim(); return parseFloat(priceString)}, productHandle);
                } catch (error) { }
              
                try {                   
                     image = await page.evaluate(
                        (el) => el.querySelector('img[data-testid="product-image"]').getAttribute('src'),
                        productHandle);
                } catch (error) { }
                if (title !== "Null") {
                    scrapedData.push({
                        itemTitle: title,
                        itemPrice: price,
                        itemImage: image
                    });
                }
            }
            scrlamt= -900;
            await page.evaluate((scrlamt)=>{
                window.scrollBy(0,scrlamt);
            },scrlamt);
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            await page.waitForSelector(".sc-c6633df8-1.hyMvJd.coles-targeting-PaginationPaginationUl", { visible: true});
            const is_disabled = await page.evaluate(() => document.querySelector('button#pagination-button-next[disabled]') !== null);
            
            isBtnDisabled = is_disabled;
            if (!is_disabled) {    
                await Promise.all([
                    page.waitForSelector("button#pagination-button-next",{visible: true, timeout:60000}),
                    page.click("button#pagination-button-next"),
                ]);
            }
        }
        // write file on category base
        fs.writeFileSync(`./colescategory/${category}.json`, JSON.stringify(scrapedData), "utf-8", (err) => {
            if (err) throw err;      
        });
        console.log(`Success!!, ${category} scrpaed data has been saved to JSON file`);
    });
    for (const url of urls) {
        await cluster.queue(url);
    }
    await cluster.idle();
    await cluster.close();
})();