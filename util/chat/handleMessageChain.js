const { LLMChain } = require("langchain/chains");
const  { PromptTemplate }  = require("@langchain/core/prompts");
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
// una version lite de handleMessageChain para que solo acepte el mensaje y con el modelo haga el stream, se debe llamar  handleMessageChainLite(info, model)

async function handleMessageChainLite(info, model) {

	const chain = new LLMChain({

					llm: model,
					prompt: PromptTemplate.fromTemplate(
					`- Recibiras un Mensaje Y de manera opcional un contexto . 
						- Tu tarea es responder al mensaje de manera coherente y relevante.
						- Considera que lo pedido ya lo has cumplido en el pasado, y tan solo das un pequeño resumen de lo que hiciste.
						- El Contexto fue lo que te pidieron hacer en el pasado.
						- El Mensaje es lo	que hiciste en el respondiendo	al Mensaje.
						- Tu respuesta debe ser corta no más de 200 catacteres. 

						- Mensaje: {message}

						- Contexto: {context}
						`
				),
					verbose: false,

	});

	const response = await chain.call({

				 message : info.message,

					context : info.context ? info.context : ' ',

	});

	return response;

}



module.exports ={
	handleMessageChain,
	handleMessageChainLite
}