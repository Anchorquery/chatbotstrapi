'use strict';



const { LLMChain } = require("langchain/chains");

const { v4: uuidv4 } = require('uuid');
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { CallbackManager } = require("langchain/callbacks");
const Promise = require('bluebird');
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { verificarPeticion, verificarPeticionDeImagen } = require('../util/common/util');

const { summarizeLongDocument } = require("../util/summarizer");
const SupabaseVectorStoreCustom = require("../util/supabase");
const clientS = require('../util/superbase-client.js');
const { handleTextMessage, handleAudioMessage, handleFileMessage, handleUrlMessage } = require("../util/chat/index.js");
const { initializeChatModel } = require("../util/common/initializeChatModel.js");
const { handleMessageChain, handleMessageChainLite } = require("../util/chat/handleMessageChain");
const { handleDatabaseOperations } = require("../util/chat/handleDatabaseOperations");
const { generateImageFromPrompt } = require("../util/common/imageGenerator");
const { convert } = require('html-to-text');
const { handlePostImage } = require("../util/chat/handlePostImage");
const { downloadFileToNetwork } = require("../util/common/bufferToFile");
const { processImageMessage } = require("../util/chat/handleFileMessage");
const { ProgressSimulator } = require("../util/common/progressSimulator");
const { handleMessageChainCreate } = require("../util/gpt/handleMessageCreate");


const { OPENAI_API_KEY } = process.env;
let { URL } = process.env;

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {




  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {

    process.nextTick(() => {

      try {

        // @ts-ignore
        var io = require("socket.io")(strapi.server.httpServer, {
          cors: { // cors setup
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["Authorization"],
            credentials: true,
          },
          maxHttpBufferSize: 1e8
        });

        io.use(async (socket, next) => {


          try {
            const token = socket.handshake.auth.token;
            const result = await strapi.plugins[
              'users-permissions'
            ].services.jwt.verify(token);

            if (!result) {

              throw new Error('Invalid Token');

            }

            const user = await strapi.entityService.findOne('plugin::users-permissions.user', result.id, {
              populate: { avatar: true },

              fields: ['id', "name", "username", "lastName", 'uuid'],
            });



            user.avatar = user.avatar ? URL + user.avatar.url : URL + '/uploads/user_147dd8408e.png';




            user["socketId"] = socket.id;

            user["lastConnection"] = new Date().getTime();
            user["status"] = 'online';

            socket.user = user;

            socket.join(`user_${user.uuid}`);


            next();
          } catch (error) {


            console.error("Socket authentication error:", error);
            next(error);

          }



        }).on('connection', function (socket) {


          socket.on('configChat', async (data) => {

            const sessionId = uuidv4();
            let { language, tone, type, prompt, temperature } = data;

            let promesas = [];

            if (temperature) {
              // busco en base de datos
              promesas.push(strapi.db.query('api::temperature.temperature').findOne({
                where: {
                  uuid: temperature
                },
                select: ['temperature', 'topP'],
              })

              );

            } else {
              temperature = {
                temperature: 0.7,
                topP: 0.9
              }
            }

            if (prompt) {

              // busco en base de datos

              promesas.push(strapi.db.query('api::prompt.prompt').findOne({

                where: {

                  uuid: prompt,
                  type: 'chat'

                },
                select: ['content'],
                populate: ['contextInputs']


              }));

            } else {
              prompt = {
                content: null
              }
            }


            if (promesas.length > 0) {

              [temperature, prompt] = await Promise.all(promesas);
            }


            const user = socket.user;


            await strapi.db.query('api::chat.chat').create({

              data: {

                // @ts-ignore
                user: user.id,
                uuid: sessionId,
                config: { language, tone, type, prompt, temperature },

              }

            })




            socket.emit('configChatResponse', { uuid: sessionId });


          });

          socket.on('message', async (data) => {
            try {

              let { type, sala, message, tone, language, chatModel, isGpt, idGpt, clientID } = data;
              let urlImage = null;
              console.log({ type, sala, message, tone, language, chatModel, isGpt, idGpt, clientID });
              if (!message) {

                socket.emit('errorMessage', { message: 'Mensaje no encontrado' });

                return;

              }




              // verifico si sala está vacio o es un objeto vacio


              if (!sala || Object.keys(sala).length === 0) {

                // creo un nuevo chat
                sala = uuidv4();
                let nombre_menssage = new Date().toISOString().split('T')[0] + ' Untitled'

                // verifico si el mensaje es un string

                if (typeof message  === 'string') {

                  // limpio de todo html y lo convierto a texto

                  nombre_menssage = convert(message, {

                    wordwrap: 130

                  })

                  // verifico si el mensaje es mayor a 130 caracteres

                  if (nombre_menssage.length > 130) {

                    // corto el mensaje a 130 caracteres

                    nombre_menssage = nombre_menssage.substring(0, 130) + '...';

                  }



                }


              

                await strapi.db.query('api::chat.chat').create({

                  data: {

                    // @ts-ignore
                    user: socket.user.id,
                    uuid: sala,
                    // nombre de la forma 2024-02-21 Untitled
                    name: nombre_menssage,
                    /*lastMessage: convert(message, {

                      wordwrap: 130

                    }),*/


                  }

                })

                if (isGpt){

                  // actualizo el fild idChatPreview en el gpt

                  await strapi.db.query('api::gpt.gpt').update({

                    where: {

                      id: idGpt

                    },

                    data: {

                      idChatPreview: sala

                    }

                  })
                }
                socket.emit('newChat', { sala, name: nombre_menssage })
              } else {

                //verifico que sala no sea string

                if (typeof sala !== 'string') {

                  sala = sala.uuid;

                }


              }

              
              if (isGpt) {


                // las ejecuto en paralelo

                var [gpt, clientPerfil] = await Promise.all([

                  strapi.db.query('api::gpt.gpt').findOne({

                    where: {

                      id: idGpt

                    }

                  }),

                  strapi.db.query('api::client.client').findOne({

                    where: {

                      id: clientID

                    }

                  })

                ]);


                if (!gpt) {

                  socket.emit('errorMessage', { message: 'Gpt no encontrado' });

                  return;

                }


                if (!clientPerfil) {

                  socket.emit('errorMessage', { message: 'Cliente no encontrado' });

                  return;

                }


                // lo añado a data

                

                data = { ...data, gpt , clientPerfil };

              }

            


              if (type == 'text' || type == 'chat') {
                // Llamar a la función verificarPeticion para analizar el mensaje
                let result = await verificarPeticion(message);
                

                // Verificar si hay intención de generar una imagen
                if (result.is_image && result.is_post == false) {

                  const simulator = new ProgressSimulator(socket);
                  simulator.start()
                    .then((message) => {
                      console.log(message);
                    })
                    .catch((error) => {
                      console.error(error.message);
                    });
                  let resGenerateImage = await generateImageFromPrompt("", message);


                  urlImage = await downloadFileToNetwork(resGenerateImage);

                  if (urlImage.error) {
                    socket.emit('errorMessage', { message: urlImage.message });
                    return;
                  }

                  socket.emit('fileGenerate', { message: urlImage, type: "image", accion: "stop", uuid: uuidv4() });

                  const newRes = await processImageMessage(urlImage.file, message, null, true);

                  if (newRes.error) {

                    socket.emit('errorMessage', { message: newRes.message });

                    return;

                  }

                  simulator.cancel();

                  await handleDatabaseOperations({ url: null, type: null, sender: "user", text: message }, { url: urlImage.file, type: "image", sender: "ia", text: 'Imgen Generada' }, sala, 'user', 'ia');





                  return;
                } else if (result.is_image == true && result.is_post == true) {
                  data.result = result;

                  let model = initializeChatModel(chatModel?.modelName, sala, socket, null);
                  let info = await handlePostImage(data, sala, socket);

                  let response = await handleMessageChain(info, model);

                  // genero la imagen

                  let resGenerateImage = await generateImageFromPrompt(response.text, message);

                  urlImage = await downloadFileToNetwork(resGenerateImage);



                  socket.emit('fileGenerate', { message: urlImage, type: "image", });

                  await handleDatabaseOperations({ url: null, type: null, sender: "user", text: info.message }, { url: null, type: null, sender: "ia", text: response.text }, sala, 'user', 'ia');

                  return;
                } else if (result.is_url) {
                  let model = initializeChatModel(chatModel?.modelName, sala, socket, null, { temperature: 0 });
                  let response = await handleUrlMessage(model, {
                    url: result.url,

                    message: result.message
                  });


                  if (response.error) {

                    socket.emit('errorMessage', { message: response.message });
                    return
                  }
                  socket.emit('fileGenerate', { message: message, type: "url", file: result.url });

                  await handleDatabaseOperations({ url: null, type: null, sender: "user", text: message }, { url: null, type: null, sender: "ia", text: response.message }, sala, 'user', 'ia');


                  return



                }




                // Manejar el mensaje de texto
                let info = await handleTextMessage(data, sala, socket);

                if (info.error) {
                  socket.emit('errorMessage', { message: info.message });

                  return;
                }

                // Inicializar el modelo de chat con la URL de la imagen (si se generó una)
                let model = initializeChatModel(chatModel?.modelName, sala, socket, urlImage);

                let response = await handleMessageChain(info, model);

                // Manejar las operaciones de la base de datos
                await handleDatabaseOperations({ url: null, type: null, sender: "user", text: info.message }, { url: null, type: null, sender: "ia", text: response.text }, sala, 'user', 'ia');
                return;
              }

              else if (type == 'audio') {
                let info = await handleAudioMessage(data, sala, socket);

                if (info.error) {
                  socket.emit('errorMessage', { message: info.message });
                }

                const model = new ChatOpenAI({
                  openAIApiKey: OPENAI_API_KEY,
                  modelName: process.env.MODEL_CHAT_DEFAULT || chatModel.modelName,
                  temperature: 0.7,
                  timeout: 45000,
                  topP: 1,
                  streaming: true,
                  callbackManager: CallbackManager.fromHandlers({
                    async handleLLMNewToken(token) {


                      socket.emit('messageResponse', { message: token });


                    },
                    async handleLLMEnd(result) {


                      socket.emit('messageEnd', { message: result, source: [], uuid: uuidv4(), sala: sala });



                    }
                  }),
                });
                const chain = new LLMChain({
                  llm: model,
                  memory: info.memory,
                  prompt: info.promptTemplate,
                  verbose: true,


                });
                const allDocs = info.docs.join("\n");


                // @ts-ignore
                const summary = allDocs.length > process.env.LIMIT_DOCUMENT_CHARACTERS_MATH ? await summarizeLongDocument({ document: allDocs, inquiry: data.message }) : allDocs
                let response = await chain.call(
                  {
                    history: info.relationMessages,
                    input: info.message,
                    context: summary,
                    language: language || 'Español',
                    tone: tone || 'Formal',
                  },

                )
                const dbConfig = {
                  client: clientS,
                  tableName: 'messages',
                  query_name: 'match_documents_2',
                };
                dbConfig.extraData = {
                  custom: true,
                  type: "message",
                  sender: 'user',
                  chat: sala,
                  content: message,
                  uuid: uuidv4(),
                }

                await SupabaseVectorStoreCustom.fromTexts([message], { source: 'user' }, new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY }), dbConfig);

                dbConfig.extraData = {
                  custom: true,
                  type: "message",
                  sender: 'ia',
                  chat: sala,
                  content: response.text,
                  uuid: uuidv4(),
                  metadata: [],
                }

                await SupabaseVectorStoreCustom.fromTexts([response.text], { source: 'ia' }, new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY }), dbConfig);

                return;
              }
              else if (type == 'file') {

                if (await verificarPeticionDeImagen(convert(message, {
                  wordwrap: 130
                }))) {


                  const simulator = new ProgressSimulator(socket);
                  simulator.start(36000)
                    .then((message) => {
                      console.log(message);
                    })
                    .catch((error) => {
                      console.error(error.message);
                    });
                  var info = await handleFileMessage(data);

                  console.log(info)


                  if (info.error) {

                    socket.emit('errorMessage', { message: info.message });
                    simulator.cancel();
                    return;
                  }


                  socket.emit('fileGenerate', { message: info.urlFileIA, type: "image", accion: "stop", uuid: uuidv4() });
                  simulator.cancel();
                  await handleDatabaseOperations({ url: info.urlFileUser, type: "image", sender: "user", text: data.message }, { url: info.urlFileIA, type: info.typeIA, sender: "ia", text: "Imagen generada" }, sala, 'user', 'ia');

                  return;

                } else {
                  var info = await handleFileMessage(data, true, socket, sala);
                }



                if (info.error) {
                  socket.emit('errorMessage', { message: info.message });
                }



                await handleDatabaseOperations({ url: info.urlFile, type: "image", sender: "user", text: data.message }, { url: null, type: null, sender: "ia", text: info.message }, sala, 'user', 'ia');


                return;

              }
              else {
                socket.emit('errorMessage', { message: 'Tipo de mensaje no soportado' });
              }
            }
            catch (error) {
              console.error('Error handling message:', error);
              socket.emit('errorMessage', { message: 'Ha ocurrido un error en el servidor', error });
            }


          });


          socket.on('crearGpt', async (data) => {

            try {
              const simulator = new ProgressSimulator(socket);
              simulator.start()
                .then((message) => {
                  console.log(message);
                })
                .catch((error) => {
                  console.error('Error:', error.message);
                });

              const { user } = socket;

              let { message, idGpt, client, state, creation_steps, clientName } = data;

              console.log({ message, idGpt, client, state, creation_steps, clientName });


              if (!message) {

                socket.emit('errorMessage', { message: 'Mensaje no encontrado' });

                return;

              }

              if (!client) {

                socket.emit('errorMessage', { message: 'Cliente no encontrado' });

                return;

              }


              /* si el paso es uno entonces se desea crear el gpt, necesito lo sigueinte:
     
               - Genera una descripcion en base al mensaje. 
     
               - Crea instrucciones en base al mensaje
     
               - Crea 4 inciadores de conversacion en base al mensaje
     
               - todo retornado en formato json
              
              */




              let prompt = `Genera una descripción, instrucciones y cuatro iniciadores de conversación en formato JSON basado en el MENSAJE, el NOMBRE_CLIENTE y un CONTEXTO opcional. Asegúrate de que las instrucciones sean claras y detalladas, si se pasa un NOMBRE_CLIENTE , gira todo alrededor de ello  y que el formato JSON siga el ejemplo proporcionado.

          MENSAJE: Un asistente de programación.
          
          NOMBRE_CLIENTE: Fagor Automotation
          
          CONTEXTO: 
          
          Descripción: Ayuda a programar con sugerencias y explicaciones claras.
          
          Instrucciones: Ayuda a los usuarios a programar proporcionando sugerencias de código, soluciones a errores, y explicaciones de conceptos de programación. Puede trabajar con varios lenguajes de programación y está diseñado para ser claro y conciso en sus respuestas. Siempre está dispuesto a proporcionar ejemplos prácticos y guiar a los usuarios a través de los problemas paso a paso. Mantiene un tono amigable y profesional.
          
          Iniciadores de conversación:
          
          1- ) ¿Cómo puedo arreglar este error en mi código?
          2- ) ¿Puedes darme un ejemplo de un bucle en Python?
          3- ) ¿Cómo funciona la recursión en C++?
          4- ) ¿Qué es una clase en Java?
          
          El formato JSON de la salida debe ser el siguiente:
          
        
          
            "descripcion": "Ayuda a programar con sugerencias y explicaciones claras.",
            "instrucciones": "Ayuda a los usuarios a programar proporcionando sugerencias de código, soluciones a errores, y explicaciones de conceptos de programación. Puede trabajar con varios lenguajes de programación y está diseñado para ser claro y conciso en sus respuestas. Siempre está dispuesto a proporcionar ejemplos prácticos y guiar a los usuarios a través de los problemas paso a paso. Mantiene un tono amigable y profesional.",
            "iniciadores_de_conversacion": [
              "¿Cómo puedo arreglar este error en mi código?",
              "¿Puedes darme un ejemplo de un bucle en Python?",
              "¿Cómo funciona la recursión en C++?",
              "¿Qué es una clase en Java?"
            ]
          
          
          Acá los datos:


          MENSAJE: {message}

          NOMBRE_CLIENTE: {clientName}

          CONTEXTO: {context}
          
          `;


              // inicio el modelo

              let model = initializeChatModel('gpt-4o-2024-05-13', null, socket, null, { temperature: 0.7 });


              let response = await handleMessageChainCreate({ message, context: "", client, clientName, prompt }, model);


              let gptData = null;

              if (idGpt){
                gptData = await strapi.db.query('api::gpt.gpt').update({

                  where: {
                    id: idGpt
                  },
                  data: {
                    prompt: response.instrucciones,
                    creation_steps: "dos",
                    description: response.descripcion,
                    conversation_starters: response.iniciadores_de_conversacion,
                    state: "published"
                  }
  
                });
              }else{
                
                // busco el cliente que solo tengo su uuid

                client = await strapi.db.query('api::client.client').findOne({

                  where: {

                    uuid: client

                  }

                });



                gptData = await strapi.db.query('api::gpt.gpt').create({

                  data: {

                    // @ts-ignore

                    client: client.id,

                    title: 'Gpt ' + clientName ,

                    prompt: response.instrucciones,

                    description: response.descripcion,

                    conversation_starters: response.iniciadores_de_conversacion,

                    state: "published",

                    creation_steps: "dos"

                  }

                });
              }



              // emito el mensaje de respuesta

              socket.emit('crearResponseGpt', { message: "Gpt creado exitiosamente. Vaya a la pesataña de configuracion o envie otro mensaje para regenerarlo", data: gptData });
              // cancelo simulador


              simulator.cancel();
            } catch (error) {
              console.error('Error handling message:', error);
            }






          });




          socket.on('disconnect', async (reason) => {
            strapi.log.debug(`Cliente ${socket.id} se ha desconectado`);





          });

        })

        // guardo el socket en el servidor para poder usarlo en los controladores

        strapi.io = io;





      } catch (error) {

        // notifico al frontend que ha ocurrido un error

        strapi.io.emit('error', { message: 'Ha ocurrido un error en el servidor', error: error });

        strapi.log.debug(error)
        throw error;



      }
    });






  },



};
