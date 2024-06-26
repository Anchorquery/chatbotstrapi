const { LLMChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");


async function handleMessageChainCreate(info, model) {
try {
	const chain = new LLMChain({

		llm: model,
		prompt: PromptTemplate.fromTemplate(info.prompt),
		verbose: false,

});



const response = await chain.call({

	message : info.message,

	context : info.context ? info.context : ' ',

	clientName : info.clientName ? info.clientName : ' ',

});

return procesarDatos(response.text);
} catch (error) {
	console.log(error)
	return error
}


}

function procesarDatos(textoJson) {
	try {
			console.log("Texto JSON:", textoJson);


			// Eliminar las etiquetas de bloque de código si están presentes
			if (textoJson.startsWith("```json") && textoJson.endsWith("```")) {
					textoJson = textoJson.slice(7, -3).trim();
			}

			// Parsear el texto JSON
			const datos = JSON.parse(textoJson);

			// Extraer los datos
			const descripcion = datos.descripcion;
			const instrucciones = datos.instrucciones;
			const iniciadoresDeConversacion = datos.iniciadores_de_conversacion;

			// Crear un objeto para guardar en la base de datos
			const datosParaGuardar = {
					descripcion: descripcion,
					instrucciones: instrucciones,
					iniciadores_de_conversacion: iniciadoresDeConversacion
			};



			return datosParaGuardar;
	} catch (error) {
			console.error("Error al procesar los datos:", error);
			return null;
	}
}

module.exports ={
	handleMessageChainCreate
}