const { convert } = require("html-to-text");
const SupabaseVectorStoreCustom = require("../supabase");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { v4: uuidv4 } = require('uuid');
async function storeMessageInDatabase(message, senderType, sala, dbConfig, file = null) {
	dbConfig.extraData = {
		custom: true,
		type: "message",
		sender: senderType,
		chat: sala,
		content: message,
		uuid: uuidv4(),
		metadata: senderType === 'ia' ? [] : undefined,
		file: file

	};



	await SupabaseVectorStoreCustom.fromTexts([message], { source: senderType }, new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }), dbConfig);

	// si le mensaje es del usuario, lo guardo como ultimo mensaje del chat

	if (senderType === 'user') {

		await strapi.db.query('api::chat.chat').update({

			where: {

				uuid: sala

			},

			data: {

				lastMessage: convert(message, {

					wordwrap: 130

				}),
				lastModification : new Date()


			}

		});
	}

}


module.exports = {
	storeMessageInDatabase

}