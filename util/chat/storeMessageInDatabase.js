const SupabaseVectorStoreCustom = require("../supabase");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { v4: uuidv4 } = require('uuid');
async function storeMessageInDatabase(message, senderType, sala, dbConfig, file	= null) {
	dbConfig.extraData = {
					custom: true,
					type: "message",
					sender: senderType,
					chat: sala,
					content: message,
					uuid: uuidv4(),
					metadata: senderType === 'ia' ? [] : undefined,
					file : file 
					
	};


	
	await SupabaseVectorStoreCustom.fromTexts([message], { source: senderType }, new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }), dbConfig);
}


module.exports ={
	storeMessageInDatabase 

}