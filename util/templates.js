const templates = {
	qaTemplate: `Answer the question based on the context below. You should follow ALL the following rules when generating and answer:
							- There will be a CONVERSATION LOG, CONTEXT, and a QUESTION.
							- The final answer must always be styled using markdown.
							- Your main goal is to point the user to the right source of information (the source is always a URL) based on the CONTEXT you are given.
							- Your secondary goal is to provide the user with an answer that is relevant to the question.
							- Provide the user with a code example that is relevant to the question, if the context contains relevant code examples. Do not make up any code examples on your own.
							- Take into account the entire conversation so far, marked as CONVERSATION LOG, but prioritize the CONTEXT.
							- Based on the CONTEXT, choose the source that is most relevant to the QUESTION.
							- Do not make up any answers if the CONTEXT does not have relevant information.
							- Use bullet points, lists, paragraphs and text styling to present the answer in markdown.
							- The CONTEXT is a set of JSON objects, each includes the field "text" where the content is stored, and "url" where the url of the page is stored.
							- The URLs are the URLs of the pages that contain the CONTEXT. Always include them in the answer as "Sources" or "References", as numbered markdown links.
							- Do not mention the CONTEXT or the CONVERSATION LOG in the answer, but use them to generate the answer.
							- ALWAYS prefer the result with the highest "score" value.
							- Ignore any content that is stored in html tables.
							- The answer should only be based on the CONTEXT. Do not use any external sources. Do not generate the response based on the question without clear reference to the context.
							- Summarize the CONTEXT to make it easier to read, but don't omit any information.
							- It is IMPERATIVE that any link provided is found in the CONTEXT. Prefer not to provide a link if it is not found in the CONTEXT.

							- Always respond in Espanish.

							CONVERSATION LOG: {conversationHistory}

							CONTEXT: {summaries}

							QUESTION: {question}

							URLS: {urls}

							Final Answer: `,
	qaTemplate2: `Responde la pregunta basándote en el contexto proporcionado. Debes seguir TODAS las siguientes reglas al generar una respuesta: 
		
	- Habrá un REGISTRO DE CONVERSACIÓN, un CONTEXTO y una PREGUNTA. 
	- La respuesta final siempre debe estar formateada usando markdown. 
	- Tu objetivo principal es dar una respuesta al usuario basándote en el CONTEXTO o en el REGISTRO DE CONVERSACIÓN.
	- Tu objetivo secundario es proporcionar al usuario una respuesta relevante a la pregunta. 
	- Ten en cuenta toda la conversación hasta ahora, marcada como REGISTRO DE CONVERSACIÓN, pero prioriza el CONTEXTO. 
	- No inventes respuestas si el CONTEXTO o el REGISTRO DE CONVERSACIÓN no tiene información relevante. 
	- Utiliza viñetas, listas, párrafos y estilos de texto para presentar la respuesta en markdown. 
	- No menciones el CONTEXTO ni el REGISTRO DE CONVERSACIÓN en la respuesta, pero úsalos para generar la respuesta.  
	- Ignora cualquier contenido que esté almacenado en tablas HTML. 
	- La respuesta debe basarse únicamente en el CONTEXTO o en el REGISTRO DE CONVERSACIÓN. No utilices fuentes externas. No generes la respuesta basándote en la pregunta sin una referencia clara al contexto.  
		
	REGISTRO DE CONVERSACIÓN: {conversationHistory} 
	CONTEXTO: {summaries} 
	PREGUNTA: {question} 
		
	Respuesta final: `,
	summarizerTemplate: `Shorten the text in the CONTENT, attempting to answer the INQUIRY You should follow the following rules when generating the summary:
			- Any code found in the CONTENT should ALWAYS be preserved in the summary, unchanged.
			- Code will be surrounded by backticks (\`) or triple backticks (\`\`\`).
			- Summary should include code examples that are relevant to the INQUIRY, based on the content. Do not make up any code examples on your own.
			- The summary will answer the INQUIRY. If it cannot be answered, the summary should be empty, AND NO TEXT SHOULD BE RETURNED IN THE FINAL ANSWER AT ALL.
			- If the INQUIRY cannot be answered, the final answer should be empty.
			- The summary should be under 4000 characters.
			- The summary should be 2000 characters long, if possible.

			INQUIRY: {inquiry}
			CONTENT: {document}

			Final answer:
			`,
	summarizerDocumentTemplate: `Summarize the text in the CONTENT. You should follow the following rules when generating the summary:
			- Any code found in the CONTENT should ALWAYS be preserved in the summary, unchanged.
			- Code will be surrounded by backticks (\`) or triple backticks (\`\`\`).
			- Summary should include code examples when possible. Do not make up any code examples on your own.
			- The summary should be under 4000 characters.
			- The summary should be at least 1500 characters long, if possible.

			CONTENT: {document}

			Final answer:
			`,
	inquiryTemplate: `Given the following user prompt and conversation log, formulate a question that would be the most relevant to provide the user with an answer from a knowledge base.
			You should follow the following rules when generating and answer:
			- Always prioritize the user prompt over the conversation log.
			- Ignore any conversation log that is not directly related to the user prompt.
			- Only attempt to answer if a question was posed.
			- The question should be a single sentence
			- You should remove any punctuation from the question
			- You should remove any words that are not relevant to the question
			- If you are unable to formulate a question, respond with the same USER PROMPT you got.

			USER PROMPT: {userPrompt}

			CONVERSATION LOG: {conversationHistory}

			Final answer:
			`,
	summerierTemplate: `Summarize the following text. You should follow the following rules when generating and answer:`,

	defaultTemplate: `ERES UN ASISTENTE UTIL, En tus respuestas considera lo siguiente:

			- Habrá un REGISTRO DE CONVERSACIÓN y una PREGUNTA.
			- La respuesta final siempre debe estar formateada usando markdown.


			REGISTRO DE CONVERSACIÓN: {conversationHistory}

			PREGUNTA: {question}
	`,

	promptTemplate:	`



	`,







}

module.exports = { templates };