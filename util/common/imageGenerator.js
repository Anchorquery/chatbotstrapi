/*
Descripción:
Esta función genera una imagen basada en una descripción dada y un mensaje adicional, utilizando una API de generación de imágenes como DALL-E. Se forma un prompt que combina varios aspectos contextuales para dirigir la creación de la imagen.

Parámetros:

description (String): Descripción de una imagen previa que se utilizará como parte del contexto para generar la nueva imagen.
message (String): Mensaje adicional que proporciona contexto o solicitudes adicionales para la generación de la imagen.
Retorna:

Object: Un objeto que contiene:
error (Boolean): Indica si ocurrió un error durante la generación de la imagen. En este contexto siempre retorna false indicando que no hubo error.
messageImage (String): URL de la imagen generada o datos relevantes de la imagen.
message (String): El mensaje original proporcionado para la generación de la imagen.
Comportamiento:

Crea un prompt detallado que instruye al modelo DALL-E sobre cómo generar la imagen. Este prompt enfatiza la importancia de adherirse al contexto y las solicitudes proporcionadas en description y message.
Inicializa y configura una instancia de DallEAPIWrapper con parámetros específicos para la generación de imágenes (como el número de imágenes a generar y el modelo específico a utilizar).
Invoca el método invoke de DallEAPIWrapper con el prompt formado para solicitar la generación de la imagen.
Retorna un objeto con los resultados de la generación de la imagen y el mensaje de contexto.
*/

const DallEAPIWrapper = require("../dalle/dalle.js");

async function generateImageFromPrompt(description, message,preview="") {
    const prompt = `Generate the image based on the provided context. You must follow ALL the following rules to generate a correct image:

    - There will be a DESCRIPTION OF A PREVIOUS IMAGE, a CONTEXT, and a REQUEST.
    - Your main goal is to generate an image based on the CONTEXT or by taking into account the DESCRIPTION OF A PREVIOUS IMAGE and fully meeting the REQUEST.
    - Consider all details of the previous image, marked as DESCRIPTION OF A PREVIOUS IMAGE, but prioritize the CONTEXT and REQUEST.
    - If the CONTEXT or DESCRIPTION OF A PREVIOUS IMAGE lacks information, base it on the REQUEST.
    - Do not write on the image.
    
    DESCRIPTION OF A PREVIOUS IMAGE: ${preview}
    CONTEXT: ${description}
    REQUEST: ${message} `
    
    // @ts-ignore
    const tool = new DallEAPIWrapper({
        n: 1,
        modelName: "dall-e-3",
        openAIApiKey: process.env.OPENAI_API_KEY,
    });

    let imageUrl = await tool.invoke(prompt);
    return {
        error: false,
        messageImage: imageUrl,
        message: message
    };
}

module.exports = { generateImageFromPrompt };
