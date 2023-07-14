const { PuppeteerWebBaseLoader } = require("langchain/document_loaders/web/puppeteer");
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { CheerioWebBaseLoader } =require ("langchain/document_loaders/web/cheerio");



const textSplitter = new RecursiveCharacterTextSplitter({
	chunkSize: 1000,
	chunkOverlap: 200,
});





module.exports = ({ strapi }) => ({

	loadUrlPuperter: async (ctx, type) => {

		try {
			let url = ctx.request.body.url;
			let loader = null;
			if (!type) {

				type = 'puppeteer';

			}
			if (type == 'cheerio') {

				loader = new CheerioWebBaseLoader(url);

			} else if (type == 'puppeteer') {



				loader = new PuppeteerWebBaseLoader(url, {
					launchOptions: {
						headless: true,
						args: ['--no-sandbox', '--disable-setuid-sandbox'],
						timeout: 0,

					},

					gotoOptions: {
						waitUntil: "domcontentloaded",
					},

				});

			}else{
				
				throw new Error("type not found");

			}




			const docs = await loader.loadAndSplit(textSplitter);

			return docs;
		} catch (err) {

			console.log(err.message);

			throw new Error(err.message);

		}

	},

});