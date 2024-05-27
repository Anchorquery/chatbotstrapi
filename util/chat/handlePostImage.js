const { handleTextMessage, extractMentionData } = require("./handleText.js");
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { PromptTemplate } = require("langchain/prompts");

async function handlePostImage(dato, sala, socket) {
	let { message, client, cantidadVectoresMenajes, cantidadMensajesHistorial, language, tone } = dato;
	message = message.trim();

	const mentions = extractMentionData(message, true);
	cantidadMensajesHistorial = cantidadMensajesHistorial || 10;
	cantidadVectoresMenajes = cantidadVectoresMenajes || 5;

	const chatModel = await getChatModel(sala, socket.user.id);
	if (!chatModel) return emitError(socket, "Chat no encontrado");

	socket.emit('info', { message: 'Buscando mensajes en memoria' });

	let { relationMessages, pastMessages } = await getChatHistory(mentions, message, cantidadVectoresMenajes, cantidadMensajesHistorial, chatModel, socket.user.id);
	const inquiry = message;

	const memory = new BufferMemory({
		chatHistory: new ChatMessageHistory(pastMessages),
		memoryKey: "immediateHistory",
		inputKey: "input",
		aiPrefix: "AI: ",
		humanPrefix: "Human: ",
	});

	let { data, matches } = await getMatches(socket.user.id, inquiry, cantidadVectoresMenajes, client, mentions);

	const docs = matches.map(match => match.content);
	const promptTemplate = createPromptTemplate(matches.length > 0, language, tone);





	return {
		promptTemplate,
		docs,
		message: data.message,
		memory,
		relationMessages,
		error: false,
	};
}

async function getChatModel(sala, userId) {
	return await strapi.db.query('api::chat.chat').findOne({
		where: { uuid: sala, user: userId },
	});
}

function emitError(socket, message) {
	socket.emit('error', { message });
	return { error: true, message };
}

async function getChatHistory(mentions, message, cantidadVectoresMenajes, cantidadMensajesHistorial, chatModel, userId) {
	let relationMessages = [];
	let pastMessages = [];
	if (mentions.archivo.length === 0 && mentions.tag.length === 0) {
		[relationMessages, pastMessages] = await Promise.all([
			strapi.services['api::chat.custom-chat'].prepararMemoriaVector(userId, message, cantidadVectoresMenajes, chatModel.id),
			strapi.services['api::chat.custom-chat'].prepararMemoria(message, chatModel, cantidadMensajesHistorial),
		]);
	}
	return { relationMessages, pastMessages };
}

async function getMatches(userId, inquiry, cantidadVectoresMenajes, client, mentions) {
	let data = await strapi.services['api::chat.custom-chat'].getMatchesFromEmbeddings(userId, inquiry, cantidadVectoresMenajes, client, mentions);
	let matches = data.data || [];
	return { data, matches };
}

function createPromptTemplate(hasMatches, language, tone) {
	const templateWithDocs = `
	- You will be given INPUT, CHATHISTORY, MEMORY, and RELEVANTDOCS.
	- INPUT corresponds to the message the user is sending, which can be a question or a request.
	- CHATHISTORY is a memory of past messages related to the user's message.
	- MEMORY corresponds to the most recent messages in the conversation in chronological order.
	- RELEVANTDOCS are relevant information related to the user's message (INPUT).
	- You have access to the chat history with the user (CHATHISTORY/MEMORY) and the context (RELEVANTDOCS) provided by the user.
	- When responding, consider if the user's message (INPUT) refers to something in the MEMORY or CHATHISTORY before consulting the RELEVANTDOCS.
	- If the user's message (INPUT) is not related to MEMORY or CHATHISTORY, do not use them as a reference. If they lack information, do not invent it, but if there are RELEVANTDOCS, respond based on that.
	- Do not justify your answers. If the INPUT has no relation or sense with MEMORY, CHATHISTORY, or RELEVANTDOCS, then do not use them as context.
	- Do not refer to yourself in any of the created content.
	- Always respond in {language}.
	- Always respond using a {tone}.
	- Always respond in rich text, using headings, lists, paragraphs, bold, and other appropriate tags.
	- Your main goal is to respond without inventing anything. If you don't have enough information to respond, state that you cannot provide a clear answer due to a lack of context.
	
	RELEVANTDOCS: {context}
	CHATHISTORY: {history}
	MEMORY: {immediateHistory}
	INPUT: {input}
	Final response:`;

	const templateWithoutDocs = `
	- You will be given INPUT and MEMORY.
	- INPUT corresponds to the message the user is sending, which can be a question or a request.
	- MEMORY corresponds to the most recent messages in the conversation in chronological order.
	- Do not refer to yourself in any of the created content.
	- Always respond in {language}.
	- Always respond using a {tone}.
	- Always respond in rich text, using headings, lists, paragraphs, bold, and other appropriate tags.
	
	CHATHISTORY: {history}
	MEMORY: {immediateHistory}
	INPUT: {input}
	Final response:`;

	return new PromptTemplate({
		template: hasMatches ? templateWithDocs : templateWithoutDocs,
		inputVariables: hasMatches ? ["context", "input", "immediateHistory", "history", "language", "tone"] : ["input", "immediateHistory", "history", "language", "tone"]
	});
}

module.exports = {
	handlePostImage
};
