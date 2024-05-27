const { convert } = require('html-to-text');
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { HumanMessage } = require("@langchain/core/messages");
const { generateImageFromPrompt } = require('../common/imageGenerator');
const { verificarPeticionDeImagen, verificarRespuestaNoDisponible, verificarYTraducirMensajeDeError } = require('../common/util');
const { documentosNoEstructurados } = require('../loader/Unstructured');
const { bufferToFile } = require('../common/bufferToFile');

const { v4: uuid } = require('uuid');
/*
Descripción:
handleFileMessage gestiona el procesamiento de mensajes que contienen archivos, manejando distintos tipos de archivos y aplicando la lógica necesaria para cada tipo.

Parámetros:

data (Object): Objeto que contiene el mensaje y el blob del archivo.
fileBlob (Blob): Blob del archivo enviado en el mensaje.
message (String): Mensaje textual asociado con el archivo.
Retorna:

Object: Objeto que describe el resultado del procesamiento del mensaje. Contiene las propiedades error (boolean) y message (string).
Comportamiento:

Si el archivo es un PDF, lo guarda en el sistema de archivos local.
Si el archivo es una imagen, procesa la imagen utilizando la función processImageMessage.
Captura y maneja errores durante el procesamiento, devolviendo un objeto de error si ocurre alguno.

*/

async function handleFileMessage(data) {
    try {
        let { fileBlob, message } = data;
            
        message = convert(message, { wordwrap: 130 });

        if (fileBlob.type === 'application/pdf') {

            const { fileTypeFromBuffer } = await import('file-type');
            const fileBuffer = Buffer.from(fileBlob.blob);

            const type = await fileTypeFromBuffer(fileBuffer);


            let file = {

                name: fileBlob.name,
                mime: type.mime,
                ext: type.ext,
                size: fileBuffer.length,
                hash: uuid() + '_' + fileBlob.name
            }

            const bufferToMedia = await bufferToFile(fileBuffer, file);

            const mediaUpload = await strapi.plugin('upload').service('upload').uploadFileAndPersist(bufferToMedia);

            await strapi.query("plugin::upload.file").create({ data: bufferToMedia });





            const documents = await documentosNoEstructurados("./public/" + mediaUpload.url);

            const contenidoCompleto = documents.map(doc => doc.pageContent).join(' ');

            // corto el contenido si es muy largo

            // @ts-ignore
            const summary = contenidoCompleto.length > process.env.LIMIT_DOCUMENT_CHARACTERS_MATH ? await summarizeLongDocument({ document: contenidoCompleto, inquiry: message }) :  contenidoCompleto;


            return {
                error: false,
                message: summary
            }

        } else if (fileBlob.type.startsWith('image/')) {
            const response = await processImageMessage(fileBlob, message);
            return response;
        }
    } catch (error) {
        return {
            error: true,
            message: verificarYTraducirMensajeDeError(error.message)
        }
    }
}


/*
Descripción:
processImageMessage maneja específicamente el procesamiento de mensajes que contienen imágenes. Convierte la imagen a formato base64, envía una solicitud a un modelo de inteligencia artificial para describir la imagen, y maneja la respuesta basada en si se desea generar una imagen a partir de la descripción.

Parámetros:

fileBlob (Blob): Blob del archivo de imagen enviado.
message (String): Mensaje textual asociado con la imagen.
Retorna:

Object: Objeto que describe el resultado del procesamiento del mensaje. Puede contener las propiedades error (boolean) y message (string o imagen según el caso).
Comportamiento:

Convierte el blob de la imagen a una cadena en formato base64 y crea una URL de imagen.
Envía una petición al modelo de IA para describir la imagen basándose en contenido textual detallado.
Evalúa la respuesta de la IA:
Si la IA indica que no puede proporcionar detalles, devuelve un mensaje de error.
Si se detecta la intención de generar una imagen basada en la descripción, llama a generateImageFromPrompt.
Si no hay intención de generar una imagen, devuelve la descripción como mensaje.
Consideraciones Adicionales:

Asegúrate de que los permisos y configuraciones necesarias para escribir archivos en el servidor estén correctamente establecidos.
Manejo de errores robusto para asegurar que cualquier fallo en la comunicación con el modelo de IA o en la generación de la imagen sea adecuadamente reportado.
*/
async function processImageMessage(fileBlob, message) {
    const base64Image = fileBlob.blob.toString('base64');
    const imgSrc = `data:${fileBlob.type};base64,${base64Image}`;

    message = convert(message, {
        wordwrap: 130
    });

    const chat = new ChatOpenAI({
        modelName: "gpt-4-vision-preview",
        maxTokens: 1024,
    });

    const prompt = new HumanMessage({
        content: [
            {
                type: "text",
                text: 'Describe detalladamente esta imagen, menciona detalladamente   las formas, los colores y estilo artistico; si tiene textos detallalos tambien. en tal caso no puedas  detallarla responde con lo siguiente: "Lo siento, no puedo proporcionar detalles de esta imagen por el siguiente motivo:" y detallas el motivo.',
            },
            {
                type: "image_url",
                image_url: { url: imgSrc },
            },
        ],
    });

    const res = await chat.invoke([prompt]);

    if (verificarRespuestaNoDisponible(res.content)) {
        return { error: true, message: res.content };
    }
    if (await verificarPeticionDeImagen(message)) {
        return generateImageFromPrompt(res.content, message);
    } else {

        return { error: false, message: res.content };
    }
}

module.exports = { handleFileMessage };
