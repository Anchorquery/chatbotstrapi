'use strict';



const { LLMChain } = require("langchain/chains");

const { v4: uuidv4 } = require('uuid');
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { CallbackManager } = require("langchain/callbacks");
const Promise = require('bluebird');
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { verificarPeticion } = require('../util/common/util');

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
              
              let { type, sala, message, tone, language, chatModel } = data;
              let urlImage = null;
console.log(data)
              if (!message) {

                socket.emit('errorMessage', { message: 'Mensaje no encontrado' });

                return;

              }





              if (!sala) {

                // creo un nuevo chat
                sala = uuidv4();
                let nameSala =new Date().toISOString().split('T')[0] + ' Untitled'
                await strapi.db.query('api::chat.chat').create({

                  data: {

                    // @ts-ignore
                    user: socket.user.id,
                    uuid: sala,
                    // nombre de la forma 2024-02-21 Untitled
                    name:  nameSala,
                    lastMessage: convert(message, {

                      wordwrap: 130
      
                    }),


                  }

                })
                socket.emit('newChat', { sala,name:nameSala })
              }else{

                //verifico que sala no sea string

                if (typeof sala !== 'string') {

                  sala = sala.uuid;

                }


              }



              if (type == 'text' || type == 'chat') {
                // Llamar a la función verificarPeticion para analizar el mensaje
                let result = await verificarPeticion(message);
                console.log({ result });

                // Verificar si hay intención de generar una imagen
                if (result.is_image && result.is_post == false) {

                  const simulator = new ProgressSimulator(socket);
                  simulator.start()
                  .then(message => {
                    console.log(message);
                  })
                  let resGenerateImage = await generateImageFromPrompt("", message);


                  urlImage = await downloadFileToNetwork (resGenerateImage);

                  if (urlImage.error) {
                    socket.emit('errorMessage', { message: urlImage.message });
                    return;
                  }

                  socket.emit('fileGenerate', { message: urlImage, type:"image",accion:"stop", uuid: uuidv4()});

                  ///let model = initializeChatModel(chatModel?.modelName, sala, socket, null);

                  const newRes =await processImageMessage(urlImage.file, message,null, true);

                  if (newRes.error) {

                    socket.emit('errorMessage', { message: newRes.message });
 
                    return;

                  }
                



                  //await  handleMessageChainLite({message:newRes.message , context :message}, model);

                  simulator.cancel();

                  await handleDatabaseOperations(message, "Imagen generada correctamente" , sala, 'user', 'ia',urlImage.file);
	                


                  

                  return;
                } else if (result.is_image == true && result.is_post == true) {
                  data.result = result;

                  let model = initializeChatModel(chatModel?.modelName, sala, socket, null);
                  let info =await handlePostImage(data, sala, socket);

                  let response = await handleMessageChain(info, model);

                  // genero la imagen

                  let resGenerateImage = await generateImageFromPrompt(response.text, message);

                  urlImage = await downloadFileToNetwork (resGenerateImage);

                  

                  socket.emit('fileGenerate', { message: urlImage, type:"image", });

                  await handleDatabaseOperations(info.message, response.text, sala, 'user', 'ia');

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
                  socket.emit('fileGenerate', { message: message, type:"url", file:result.url });

                  await handleDatabaseOperations(message, response.message, sala, 'user', 'ia');

                  
                  return



                }




                // Manejar el mensaje de texto
                let info = await handleTextMessage(data, sala, socket);

                if (info.error) {
                  socket.emit('errorMessage', { message: info.message });
                }

                // Inicializar el modelo de chat con la URL de la imagen (si se generó una)
                let model = initializeChatModel(chatModel?.modelName, sala, socket, urlImage);

                // Manejar la cadena de mensajes
                let response = await handleMessageChain(info, model);

                // Manejar las operaciones de la base de datos
                await handleDatabaseOperations(info.message, response.text, sala, 'user', 'ia');
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
                let info = await handleFileMessage(data);


                if (info.error) {
                  socket.emit('errorMessage', { message: info.message });
                }

                // necesito mandar el mensaje 


                console.log(info);

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
