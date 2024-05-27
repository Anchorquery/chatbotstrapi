const { WebBrowser } = require("langchain/tools/webbrowser");
const { OpenAIEmbeddings } = require("@langchain/openai");

async function handleUrlMessage(model, data) {
	try {
		const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
		const browser = new WebBrowser({ model, embeddings });

		const result = await browser.invoke(
			`${data.url},${data.message}`
		);

		if (result.includes('Error:')) {
			return { error: true, message: 'An error occurred while processing your request.' };
		}

		return {
			error:false,
			message:result
		};
	} catch (error) {
		return { error: true, message: 'An error occurred while processing your request.' };

	}

}



module.exports = { handleUrlMessage }