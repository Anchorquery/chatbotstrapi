
const { v4: uuid } = require('uuid');
const  { OpenAIWhisperAudio } = require ("langchain/document_loaders/fs/openai_whisper_audio");
const { handleTextMessage } = require("./handleText.js");
const { bufferToFile } = require('../common/bufferToFile.js');

let { OPENAI_API_KEY } = process.env;

async function handleAudioMessage(dato, sala, socket) {
	console.log(socket)
	const { fileTypeFromBuffer } = await import('file-type');
	let { message, client, cantidadVectoresMenajes, cantidadMensajesHistorial, language, tone } = dato;

	const audioBuffer = Buffer.from(message);
	
	const type = await fileTypeFromBuffer(audioBuffer);


	let file ={

		name: "prueba_audio." + type.ext,
		mime:type.mime,
		ext:type.ext,
		size: audioBuffer.length,
		hash: uuid() + '_' + "prueba_audio"
	}

	let bufferToMedia = await bufferToFile(audioBuffer, file);



let test =await strapi.plugin('upload').service('upload').uploadFileAndPersist(bufferToMedia);

await strapi.query("plugin::upload.file").create({ data: bufferToMedia });
	

	
const loader = new OpenAIWhisperAudio("./public/" + test.url,{ clientOptions: { apiKey: OPENAI_API_KEY }} );

const docs = await loader.load();


dato.message = extractPageContent(docs)[0];

if(!dato.message ){

 return {
		error:true,
		message : "No se pudo procesar el audio"
	}
}

let info = await handleTextMessage(dato, sala, socket);



	return info;




}


function extractPageContent(documents) {
	// Usamos map para transformar el array de documentos en un array de contenidos de página
	return documents.map(doc => doc.pageContent);
}



module.exports = { handleAudioMessage }