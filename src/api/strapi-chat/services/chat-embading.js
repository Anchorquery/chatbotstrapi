const { OpenAIEmbeddings } = require('langchain/embeddings/openai');


const { ConversationalRetrievalQAChain } = require('langchain/chains');
const sessionManager = require("../sessionManager");
const { OpenAI } = require("langchain/llms/openai");
const { BufferMemory } = require("langchain/memory");
const { ConversationChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");
const { v4: uuidv4 } = require('uuid');
const client = require('../../../../util/superbase-client.js');

const { SupabaseVectorStore } = require('langchain/vectorstores/supabase');

const dbConfig = {
	client,
	tableName: 'documents',
	query_name: 'match_documents',
};
const embading = new OpenAIEmbeddings();



const CONDENSE_PROMPT = `Dada la siguiente conversación y una pregunta de seguimiento, reformule la pregunta de seguimiento para que sea una pregunta independiente.

Historial de conversaciones:
{chat_history}
Entrada de seguimiento: {question}
Pregunta independiente:`;

const QA_PROMPT = `Eres un útil asistente de IA. Use las siguientes piezas de contexto para responder la pregunta al final.
Si no sabe la respuesta, simplemente diga que no la sabe. NO trate de inventar una respuesta.
Si la pregunta no está relacionada con el contexto, responda cortésmente que está sintonizado para responder solo preguntas relacionadas con el contexto.

{context}

Pregunta: {question}
Helpful Answer in Markdown`;
module.exports = ({ strapi }) => ({


makeChain: async (ctx) => {

	/// saco el historial del buffer

	const history = ctx.request.body.data.history;

	const question	= ctx.request.body.data.message;
strapi.log.debug(question);
strapi.log.debug(ctx.request.body);
	strapi.log.debug("2");
	const model = new OpenAI({
		temperature: 1, // increase temepreature to get more creative answers
		modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
  });
		strapi.log.debug("3");
/*const vectorstore = await SupabaseVectorStore.fromExistingIndex(
	embading,
	dbConfig,
);*/
const vectorStore = await SupabaseVectorStore.fromExistingIndex(new OpenAIEmbeddings(), {
	client,
	tableName: 'documents',
	queryName: 'match_documents',


})
strapi.log.debug("4");

const chain = await ConversationalRetrievalQAChain.fromLLM(
	model,
	vectorStore.asRetriever(),
	{
			qaTemplate: QA_PROMPT,
			questionGeneratorTemplate: CONDENSE_PROMPT,
			returnSourceDocuments: true, //The number of source documents returned is 4 by default
	},
);
strapi.log.debug("5");

const response = await chain.call({
	question: question,
	chat_history:  [],
});

strapi.log.debug(response);

return response;





}




});
