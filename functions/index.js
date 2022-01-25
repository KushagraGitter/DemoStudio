//const functions = require("firebase-functions");

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
// const {Configuration, OpenAIApi} = require("openai");
// const config = new Configuration({
//   organization: "org-OHKIgmWRanc7raqtDMYAq84g",
//   apiKey: "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",
// });

// const openai = new OpenAIApi(config);

// const Alpaca = require('@alpacahq/alpaca-trade-api');
// const alpaca = new Alpaca({
//   keyId: 'PK1O1VPUPNSQX1DAAQ0M', // REPLACE with your API credentials
//   secretKey: 'kUou0h9nh61WR7maANoQeZN3ZRGV3uZZgelnwHE1', // REPLACE with your API credentials
//   paper: true,
// });

const functions = require('firebase-functions');

//// SDK Config ////

const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
  organization: 'org-OHKIgmWRanc7raqtDMYAq84g', // REPLACE with your API credentials
  apiKey: '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', // REPLACE with your API credentials
});
const openai = new OpenAIApi(configuration);

const Alpaca = require('@alpacahq/alpaca-trade-api');
const alpaca = new Alpaca({
  keyId: 'PK1O1VPUPNSQX1DAAQ0M', // REPLACE with your API credentials
  secretKey: 'kUou0h9nh61WR7maANoQeZN3ZRGV3uZZgelnwHE1', // REPLACE with your API credentials
  paper: true,
});

//// PUPPETEER Scrape Data from Twitter for better AI context ////

const puppeteer = require('puppeteer');

async function scrape() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://twitter.com/jimcramer', {
    waitUntil: 'networkidle2',
  });

  await page.waitForTimeout(3000);

  // await page.screenshot({ path: 'example.png' });

  const tweets = await page.evaluate(async () => {
    return document.body.innerText;
  });

  await browser.close();

  return tweets;
}

exports.helloWorld = functions.https.onRequest(async (request, response) => {
    const tweets = await scrape();

    const gptCompletion = await openai.createCompletion('text-davinci-001', {
      prompt: `${tweets} Jim Cramer recommends selling the following stock tickers: `,
      temperature: 0.7,
      max_tokens: 32,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const stocksToBuy = gptCompletion.data.choices[0].text.match(/\b[A-Z]+\b/g);
    console.log(`Thanks for the tips Jim! ${stocksToBuy}`);

    if (!stocksToBuy) {
      console.log('sitting this one out');
      return null;
    }

    //// ALPACA Make Trades ////

    // close all positions
    const cancel = await alpaca.cancelAllOrders();
    const liquidate = await alpaca.closeAllPositions();

    // get account
    const account = await alpaca.getAccount();
    console.log(`dry powder: ${account.buying_power}`);

    // place order
    const order = await alpaca.createOrder({
      symbol: stocksToBuy[0],
      // qty: 1,
      notional: account.buying_power * 0.9, // will buy fractional shares
      side: 'buy',
      type: 'market',
      //time_in_force: 'day',
    });
});

exports.getRichQuickDemo = functions
  .runWith({ memory: '4GB' })
  .pubsub.schedule('0 10 * * 1-5')
  .timeZone('America/New_York')
  .onRun(async (ctx) => {
    console.log('This will run M-F at 10:00 AM Eastern!');

    const tweets = await scrape();

    const gptCompletion = await openai.createCompletion('text-davinci-001', {
      prompt: `${tweets} Jim Cramer recommends selling the following stock tickers: `,
      temperature: 0.7,
      max_tokens: 32,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const stocksToBuy = gptCompletion.data.choices[0].text.match(/\b[A-Z]+\b/g);
    console.log(`Thanks for the tips Jim! ${stocksToBuy}`);

    if (!stocksToBuy) {
      console.log('sitting this one out');
      return null;
    }

    //// ALPACA Make Trades ////

    // close all positions
    const cancel = await alpaca.cancelAllOrders();
    const liquidate = await alpaca.closeAllPositions();

    // get account
    const account = await alpaca.getAccount();
    console.log(`dry powder: ${account.buying_power}`);

    // place order
    const order = await alpaca.createOrder({
      symbol: stocksToBuy[0],
      // qty: 1,
      notional: account.buying_power * 0.9, // will buy fractional shares
      side: 'buy',
      type: 'market',
      time_in_force: 'day',
    });

    console.log(`look mom i bought stonks: ${order.id}`);

    return null;
  });