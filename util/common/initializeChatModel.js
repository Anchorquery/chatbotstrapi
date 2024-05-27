const { ChatOpenAI } = require("langchain/chat_models/openai");
const { CallbackManager } = require("langchain/callbacks");
const { v4: uuidv4 } = require('uuid');
const { OPENAI_API_KEY } = process.env;
function initializeChatModel(modelName, sala, socket,urlImage=null,config =null) {
	return new ChatOpenAI({
		openAIApiKey: OPENAI_API_KEY,
		modelName: process.env.MODEL_CHAT_DEFAULT || modelName,
		temperature:config?.temperature || 0.7,
		timeout: 45000,
		topP: 1,
		verbose:false,
		streaming: true,
		callbackManager: CallbackManager.fromHandlers({
			async handleLLMNewToken(token) {


				socket.emit('messageResponse', { message: token });


			},
			async handleLLMEnd(result) {


				socket.emit('messageEnd', { message: result, source: [], uuid: uuidv4(), sala: sala,urlImage  });



			}
		}),
	});
}


module.exports = {
	initializeChatModel
}