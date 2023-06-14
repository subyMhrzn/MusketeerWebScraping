const { Cluster } = require('puppeteer-cluster');
const fs = require('fs');
const puppeteer= require('puppeteer');

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
    const outerCluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 3,
        retryLimit: 2,
        timeout: 42000000,
        
        // monitor: true,
       // tasktimeout: 60000,
        puppeteerOptions: {
            headless: false,
            defaultViewport: null,
            //userDataDir: "./tmp",
            timeout: 6000000,
            protocolTimeout: 6000000,
            // devtools:true,
            args: ['--start-maximized', '--cpu-profile-interval=500', '--memory-pressure-off', '--no-sandbox', '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process']
        }
    });



    outerCluster.on("taskerror", (err, data) => {
        console.log(`Error crawling ${data}: ${err.message}`);
    });

    await outerCluster.task(async ({ page, data: url }) => {
        await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'image') {
        req.abort();
      } else {
        req.continue();
      }
    });
        await page.goto(url, {
            waitUntil: "load",
            timeout: 600000

        });

        await page.waitForSelector('div#coles-targeting-main-container');
        const category = await page.$eval('div > h1[data-testid="product-cat-heading"]', el => el.textContent);
        const scrapedData = [];
        let isBtnDisabled = false;
        while (!isBtnDisabled) {
            await page.waitForSelector('section[data-testid="product-tile"]', {visible:true});
            let linksofpage= await page.$$eval('.product__header', links =>{
			//Extract links from the data
			links = links.map(el => el.querySelector('a.product__link').href);
			return links;
		});
        const innerCluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_PAGE,
            maxConcurrency: 10,
            retryLimit: 5,
            timeout: 6000000,
            puppeteerOptions:{
                headless: false,
                defaultViewport: null,
            // userDataDir: "./tmp",
                timeout: 6000000,
                protocolTimeout: 6000000,
            // devtools:true,
            args: ['--start-maximized',
            '--cpu-profile-interval=500',
            '--memory-pressure-off',
            '--no-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'] 
            }
        
        });
    
    innerCluster.on("taskerror", (err, data) => {
            console.log(`Error crawling ${data}: ${err.message}`);
        });
    await innerCluster.task(async ({ page, data: link }) => {
        
        
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'image') {
        req.abort();
      } else {
        req.continue();
      }
    });
        await page.goto(link, {
            waitUntil: "load",
            timeout: 600000
        });
        await page.waitForSelector('#coles-targeting-main-container', {visile: true});
        let title = 'null'; let itemingredients= 'null'; let itemdetails = 'null';
        try {
        title= await page.$eval('h1.product__title', text => text.textContent);
        } catch(error){}
        // try {
        // price = await page.$eval('span.price__value', text => text.textContent);
        // } catch(error) {}
        try {
        itemingredients = await page.$eval('li#ingredients-accordionGroup', div => div.textContent);
        } catch(error) {}
        try{
        itemdetails= await page.$eval('div.sc-27378584-3.dxpnGH.coles-targeting-SectionHeaderDescription > div', div => div.textContent);
        } catch(error) {}
        scrapedData.push({
            colesItemTitle: title,
            // colesItemPrice: price,
            // colesItemImage : image,
            colesItemDetails: itemdetails,
            colesItemIngredients : itemingredients
        });
        // console.log(scrapedData);
    });
	for(link of linksofpage){
        await innerCluster.queue(link);
	}
    await innerCluster.idle();
    await innerCluster.close();
            await page.waitForSelector("button#pagination-button-next", { visible: true });
            const is_disabled = await page.evaluate(() => document.querySelector('button#pagination-button-next[disabled]') !== null);

            isBtnDisabled = is_disabled;
            if (!is_disabled) {
                    await page.waitForSelector("button#pagination-button-next",{visible: true, timeout:35000});
                    await page.click("button#pagination-button-next", {delay: 8000});
                   
            }
             


        }
        // write file on category base
        fs.writeFileSync(`./colescategory/${category}.json`, JSON.stringify(scrapedData), "utf-8", (err) => {
            if (err) throw err;      
        });
        console.log(`Success!!, ${category} scrpaed data has been saved to JSON file`);
    });

    for (const url of urls) {
        await outerCluster.queue(url);
    }


    await outerCluster.idle();
    await outerCluster.close();


})();