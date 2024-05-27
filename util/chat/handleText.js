const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { PromptTemplate } = require("langchain/prompts");

async function handleTextMessage(dato, sala, socket) {
	let { message, client, cantidadVectoresMenajes, cantidadMensajesHistorial, language, tone } = dato;

	message = message.trim();



	let mentions = extractMentionData(message, true);


	cantidadMensajesHistorial = cantidadMensajesHistorial || 10;

	cantidadVectoresMenajes = cantidadVectoresMenajes || 5;


	const chatModel = await strapi.db.query('api::chat.chat').findOne({

			where: {

					uuid: sala,
					user: socket.user.id

			},
	});

	if (!chatModel) {

			// emito un error


			return {
					error: true,
					message: "Chat no encontrado"
			}
	}


	socket.emit('info', { message: 'Buscando mensajes en memoria' });

	let relationMessages = [];
	let pastMessages = [];
	if (mentions.archivo.length === 0 && mentions.tag.length === 0) {
			[relationMessages, pastMessages] = await Promise.all([strapi.services['api::chat.custom-chat'].prepararMemoriaVector(socket.user.id, message, cantidadVectoresMenajes, chatModel.id), await strapi.services['api::chat.custom-chat'].prepararMemoria(message, chatModel, cantidadMensajesHistorial)]);
	}




	const inquiry = message


	const memory = new BufferMemory({
			chatHistory: new ChatMessageHistory(pastMessages),
			memoryKey: "immediateHistory",
			inputKey: "input",
			aiPrefix: "AI: ",
			humanPrefix: "Human: ",


	});




	let data = await strapi.services['api::chat.custom-chat'].getMatchesFromEmbeddings(socket.user.id, inquiry, cantidadVectoresMenajes, client, mentions);

	let matches = data.data;

	// emito mensaje de que se han encontrado documentos relacionados

	if (!matches) {
			matches = [];
	}




	let docs = matches.map((match) => {

			return match.content;

	});

	let promtp = null;
	if (matches.length > 0) {
			promtp = `
			- Se dará INPUT , CHATHISTORY, MEMORY y RELEVANTDOCS
			- INPUT corresponde al mensaje que el usuario está enviando, puede ser una pregunta o una petición. 
			- CHATHISTORY es una memoria con mensajes pasados que tiene relacion con el mensaje del usuario. 
			- MEMORY corresponde a los ultimos mensajes de la conversación en orden cronologico. 
			- RELEVANTDOCS , información relevante que guarda relación con el mensaje del usuario (INPUT).
			- Tienes acceso al historial de chat con el usuario (CHATHISTORY/MEMORY) y al contexto (RELEVANTDOCS) proporcionado por el usuario. 
			- Al responder, piensa si el mensaje (INPUT) se refiere a algo en la MEMORY o en el CHATHISTORY antes de consultar los RELEVANTDOCS. 
			- Si el mensaje del usuario (INPUT) no tiene relación con la MEMORIA o con el CHATHISTORY no los uses como referencia. Si no tienen información no la inventes, pero si hay  RELEVANTDOCS responde en base a eso.
			- No justifiques tus respuestas, si el INPUT no tiene ninguna relación o sentido con MEMORY,CHATHISTORY o  RELEVANTDOCS  entonces no los uses como contexto. 
			- No te refieras a ti mismo en ninguno de los contenidos creados. 
			- Siempre responde en {language}.
			- Siempre responde utilizando un tono {tone}. 
			- Siempre responde en texto enriquecido, usando encabezados, listas, parrafos , negritas , entre otras etiquetas que sean oportunas.
			- Tu objetivo principal es responder sin inventar nada. Si no tienes inforamción para responder , avisa que no puedes dar una respuesta clara por falta de contexto.   
			
			RELEVANTDOCS: {context}
				
			CHATHISTORY: {history}
				
			MEMORY: {immediateHistory}
			
			INPUT : {input}
			
			Respuesta final :`;
	} else {
			promtp = `
			- Se dará INPUT y MEMORY.
			- INPUT corresponde al mensaje que el usuario está enviando, puede ser una pregunta o una petición. 
			- MEMORY corresponde a los ultimos mensajes de la conversación en orden cronologico. 
			- No te refieras a ti mismo en ninguno de los contenidos creados. 
			- Siempre responde en {language}.
			- Siempre responde utilizando un tono {tone}. 
			- Siempre responde en texto enriquecido, usando encabezados, listas, parrafos , negritas , entre otras etiquetas que sean oportunas. 
			
				
			CHATHISTORY: {history}
				
			MEMORY: {immediateHistory}
			
			INPUT : {input}
			
			Respuesta final :`;


	}


	const promptTemplate = new PromptTemplate({
			template: promtp,
			inputVariables: matches.length > 0 ? ["context", "input", "immediateHistory", "history", "language", "tone"] : ["input", "immediateHistory", "history", "language", "tone"]
	});


	// mando mensaje de preparando modelo

	return {
			promptTemplate,
			docs,
			message: data.message,
			memory,
			relationMessages,
			error: false
	}





}

function extractMentionData(htmlMessage, data_id = false) {
	// Ajusta la expresión regular para que coincida con tu HTML específico.
	const mentionRegex = /<span class="(archivo|tag) mention" contenteditable="true" title="([^"]+)" data-id="([^"]+)"[^>]*>/g;
	const matches = [...htmlMessage.matchAll(mentionRegex)];

	const result = {
			archivo: [],
			tag: []
	};

	matches.forEach(match => {
			const dataId = match[3]; // Captura data-id
			const title = match[2]; // Captura el título

			const item = data_id ? dataId : { title, dataId };

			// Determina si es archivo o tag y añade al array correspondiente.
			if (match[1] === 'archivo') {
					result.archivo.push(item);
			} else if (match[1] === 'tag') {
					result.tag.push(item);
			}
	});

	return result;
}

module.exports = { handleTextMessage,extractMentionData };