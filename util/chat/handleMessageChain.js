const { LLMChain } = require("langchain/chains");
const { generateDocumentSummary } = require("../common/util.js");
async function handleMessageChain(info, model) {

	const summary = await generateDocumentSummary(info.docs,info.message);
	const chain = new LLMChain({
					llm: model,
					memory: info.memory,
					prompt: info.promptTemplate,
					verbose: false,
	});

	const response = await chain.call({
					history: info.relationMessages,
					input: info.message,
					context: summary,
					language: info.language ? info.language : 'Español',
					tone: info.tone ? info.tone : 'Formal',
	});

	return response;
}


module.exports ={
	handleMessageChain
}