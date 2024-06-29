const Spider = require('node-spider');
const TurndownService = require('turndown');
const cheerio = require('cheerio');
const parse = require('url-parse');
const puppeteer = require('puppeteer');

const turndownService = new TurndownService();

class Crawler {
  constructor(urls, limit = 1000, textLengthMinimum = 200, usePuppeteer = false) {
    this.pages = [];
    this.limit = limit;
    this.urls = urls;
    this.spider = null;
    this.count = 0;
    this.textLengthMinimum = textLengthMinimum;
    this.usePuppeteer = usePuppeteer;
  }

  removeUnwantedElements($, selectors) {
    selectors.forEach((selector) => $(selector).remove());
  }

  async handleRequest(doc) {
    let $;
    if (this.usePuppeteer) {
      console.log(`Loading page with puppeteer ${doc.url}`);
      $ = await this.loadPageWithPuppeteer(doc.url);
    } else {
      console.log(`Loading page with cheerio ${doc.url}`);
      $ = cheerio.load(doc.res.body);
    }

    const unwantedSelectors = ['script', '#hub-sidebar', 'header', 'nav', 'img'];
    this.removeUnwantedElements($, unwantedSelectors);
    const title = $("title").text() || $(".article-title").text();
    const html = $("body").html();
    const text = turndownService.turndown(html);
    const page = {
      url: doc.url,
      text,
      title,
    };
    if (text.length > this.textLengthMinimum) {
      this.pages.push(page);
    }

    doc.$("a").each((i, elem) => {
      var href = doc.$(elem).attr("href")?.split("#")[0];
      var targetUrl = href && doc.resolve(href);
      if (
        targetUrl &&
        this.urls.some((u) => {
          const targetUrlParts = parse(targetUrl);
          const uParts = parse(u);
          return targetUrlParts.hostname === uParts.hostname;
        }) &&
        this.count < this.limit
      ) {
        this.spider.queue(targetUrl, this.handleRequest.bind(this));
        this.count = this.count + 1;
      }
    });
  }

  async loadPageWithPuppeteer(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    const content = await page.content();
    await browser.close();
   const contenido = await cheerio.load(content);
    return contenido;
  }

  async start() {
    this.pages = [];
    return new Promise((resolve, reject) => {
      this.spider = new Spider({
        concurrent: 5,
        delay: 0,
        allowDuplicates: false,
        catchErrors: true,
        addReferrer: false,
        xhr: false,
        keepAlive: true,
        error: (err, url) => {
          console.error(err, url);
          reject(err);
        },
        done: () => {
          resolve(this.pages);
        },
        headers: {
          "User-Agent": "",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*",
          "Accept-Language": "en-US,en;q=0.5",
          "Referer": "https://www.google.com/",
          "DNT": "1",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1"
        },
        encoding: "utf8",
      });
      this.urls.forEach((url) => {
        this.spider.queue(url, this.handleRequest.bind(this));
      });
    });
  }
}

module.exports = { Crawler };
