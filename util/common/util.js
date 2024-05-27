const { ChatOpenAI } = require("langchain/chat_models/openai");
const { summarizeLongDocument } = require("../summarizer");

/*
Documentación de verificarRespuestaNoDisponible
Descripción:
Esta función evalúa si un contenido dado incluye frases que indican la incapacidad para proporcionar una respuesta.

Parámetros:

content (String): Texto que se desea evaluar.
Retorna:

boolean: Devuelve true si el contenido incluye alguna de las frases indicativas de una respuesta no disponible, de lo contrario false.
Comportamiento:
Utiliza una expresión regular para buscar frases clave que sugieren que la respuesta no está disponible o no puede ser proporcionada.
*/

function verificarRespuestaNoDisponible(content) {
	const regex = /lo siento,? no puedo|no es posible|no tengo acceso|no puedo proporcionar/i;
	return regex.test(content);
}

/*
Documentación de verificarPeticionDeImagen
Descripción:
Interroga a un modelo de inteligencia artificial para determinar si un mensaje textual contiene la intención de crear una imagen.

Parámetros:

message (String): Mensaje que se evaluará para detectar la intención de generar una imagen.
Retorna:

boolean: Devuelve true si el mensaje implica el deseo de generar una imagen, de lo contrario false.
Comportamiento:

Inicializa y configura un modelo de Chat OpenAI.
Envía el mensaje al modelo y recibe la evaluación en formato JSON.
Utiliza parseContentIfNeeded para asegurar que el contenido pueda ser correctamente evaluado como un objeto JSON.
*/
async function verificarPeticionDeImagen(message) {
	const model = new ChatOpenAI({
					openAIApiKey: process.env.OPENAI_API_KEY,
					modelName: "gpt-3.5-turbo-0125",
					temperature: 0.7,
					timeout: 45000,
					topP: 1
	}).bind({
					response_format: { type: "json_object" },
	});

	const res = await model.invoke([
					["system", "Recibe un mensaje de entrada y evalúa si contiene la intención de crear una imagen. Devuelve la evaluación en formato JSON con una propiedad llamada : 'is_image' con el valor 'true' si el mensaje implica el deseo de generar una imagen, y 'false' si no es así."],
					["human", message],
	]);
	return parseContentIfNeeded(res.content)["is_image"];
}
/*
Documentación de verificarYTraducirMensajeDeError
Descripción:
Analiza un mensaje de error para determinar si fue causado por un sistema de seguridad y proporciona una traducción o explicación más amigable.

Parámetros:

texto (String): Mensaje de error original generado por el sistema.
Retorna:

String: Mensaje de error traducido o el original si no se detecta que es específico de seguridad.
Comportamiento:

Utiliza expresiones regulares para detectar mensajes de error relacionados con el sistema de seguridad.
Traduce estos mensajes a un lenguaje más claro y accesible para el usuario.
*/
function verificarYTraducirMensajeDeError(texto) {
	const mensajeDeSeguridad = /Your request was rejected as a result of our safety system/i;
	const contenidoProhibido = /Your prompt may contain text that is not allowed by our safety system/i;
	if (mensajeDeSeguridad.test(texto) && contenidoProhibido.test(texto)) {
					return "Tu solicitud fue rechazada por nuestro sistema de seguridad, revisa el texto ingresado.";
	}
	return texto;
}

/*
Documentación de parseContentIfNeeded
Descripción:
Verifica si el contenido recibido es una cadena de texto JSON y, de ser necesario, lo parsea a un objeto JavaScript.

Parámetros:

content (String | Object): Contenido que puede ser una cadena JSON o ya un objeto JavaScript.
Retorna:

Object | null: Objeto JavaScript si el contenido es una cadena JSON válida y se parseó correctamente, el propio objeto si ya era un objeto, o null si la cadena no pudo ser parseada.
Comportamiento:

Verifica si content es una cadena.
Si es una cadena, intenta convertirla en un objeto JavaScript utilizando JSON.parse().
Captura errores durante el parseo y retorna null si ocurre un error.
Estas descripciones proporcionan una visión clara de las funcionalidades y comportamientos esperados de cada función, facilitando su uso y mantenimiento en el contexto del módulo en el que se encuentran.
*/
function parseContentIfNeeded(content) {
	if (typeof content === 'string') {
					try {
									return JSON.parse(content);
					} catch (error) {
									console.error("Error parsing content:", error);
									return null;  // Retorna null si no se puede parsear la cadena
					}
	}
	return content;
}

async function generateDocumentSummary(docs , message) {
	const allDocs = docs.join("\n");

	// @ts-ignore
	return allDocs.length > process.env.LIMIT_DOCUMENT_CHARACTERS_MATH ? await summarizeLongDocument({ document: allDocs, inquiry: message }) : allDocs;
}


async function verificarPeticionDePost(message){

	const model = new ChatOpenAI({
		openAIApiKey: process.env.OPENAI_API_KEY,
		modelName: "gpt-3.5-turbo-0125",
		temperature: 0.7,
		timeout: 45000,
		topP: 1
}).bind({
		response_format: { type: "json_object" },
});

const res = await model.invoke([
		["system", "Recibe un mensaje de entrada y evalúa si se desea algún tipo de escrito, consulta post o demás. Ignorando si hay petición de imagen. Si hay intenciones de algún tipo de texto retorna en formato json dos propiedades la primera es 'is_post:true' y la segunda 'message' con un extracto de lo deseado por la entrada(no agregando nada sobre la imagen deseada) , en caso no hay intenciones devuelve esas mimsas propiedades con valor false"],
		["human", message],
]);
return parseContentIfNeeded(res.content)
}
async function verificarPeticion(message) {
	const model = new ChatOpenAI({
					openAIApiKey: process.env.OPENAI_API_KEY,
					modelName: "gpt-4o-2024-05-13",
					temperature: 0,
					timeout: 45000,
					topP: 1
	}).bind({
					response_format: { type: "json_object" },
	});

	const res = await model.invoke([
					["system", `Recibe un mensaje de entrada y evalúa si contiene la intención de crear una imagen, algún tipo de escrito, consulta post u otros, o visitar una URL, además si se habla de una persona o empresa captura el nombre.
					Devuelve la evaluación en formato JSON con las siguientes propiedades:
					- 'is_post': true/false
					- 'message': Extracto del mensaje con lo que se desea en la petición  , si aplica
					- 'is_image': true/false
					- 'is_url': true/false
					- 'url': URL mencionada en el mensaje, si aplica
					- 'cliente': Nombre de la persona mencionada, si aplica; de lo contrario, null`],
					["human", message],
	]);

	return parseContentIfNeeded(res.content);
}

// Función para parsear la respuesta si es necesario
function parseContentIfNeeded(content) {
	try {
					return JSON.parse(content);
	} catch (e) {
					return content;
	}
}


function simuladorCarga(socket, type = "file") {
	let progress = 0;
	let intervalId = null;

	function iniciar() {
					if (intervalId) {
									clearInterval(intervalId);
					}

					intervalId = setInterval(() => {
									progress += 10;
									socket.emit('loading', { message: progress });
									if (progress >= 100) {
													clearInterval(intervalId);
													socket.emit('loading', { message: 'Carga completa' });
									}
					}, 1000);
	}

	function detener() {
					if (intervalId) {
									clearInterval(intervalId);
									intervalId = null;
									console.log('Simulación de carga detenida.');
					}
	}

	return { iniciar, detener };
}


module.exports = { verificarPeticionDeImagen, verificarRespuestaNoDisponible , verificarYTraducirMensajeDeError,generateDocumentSummary,verificarPeticionDePost,verificarPeticion,simuladorCarga};


