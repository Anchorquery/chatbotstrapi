const  {handleTextMessage,extractMentionData}  = require("./handleText.js");
const {handleAudioMessage} = require("./handleVoice.js");
const {handleFileMessage } = require("./handleFileMessage.js");
const {handleUrlMessage} = require("./handleUrlMessage.js");
module.exports = {

	handleTextMessage,
	extractMentionData,
	handleAudioMessage,
	handleFileMessage,
	handleUrlMessage
}