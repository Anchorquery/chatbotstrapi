'use strict';



const { LLMChain } = require("langchain/chains");

const { v4: uuidv4 } = require('uuid');
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { CallbackManager } = require("langchain/callbacks");
const Promise = require('bluebird');
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");


const { summarizeLongDocument } = require("../util/summarizer");
const SupabaseVectorStoreCustom = require("../util/supabase");
const clientS = require('../util/superbase-client.js');
const { handleTextMessage, handleAudioMessage,handleFileMessage } = require("../util/chat/index.js")
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

            console.log(data);
            try {
              let { type, sala, message, tone, language, chatModel } = data;

              if (!message) {

                socket.emit('error', { message: 'Mensaje no encontrado' });

                return;

              }


              if (!sala) {

                // creo un nuevo chat
                sala = uuidv4();
                await strapi.db.query('api::chat.chat').create({

                  data: {

                    // @ts-ignore
                    user: socket.user.id,
                    uuid: sala,


                  }

                })

              }
              if (type == 'text' || type == 'chat') {

                let info = await handleTextMessage(data, sala, socket);

                if (info.error) {
                  socket.emit('error', { message: info.message });
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
                    idioma: language || 'Español',
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
              else if (type == 'audio') {
                let info = await handleAudioMessage(data, sala, socket);

                if (info.error) {
                  socket.emit('error', { message: info.message });
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
                    idioma: language || 'Español',
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
               let info =await handleFileMessage(data );


               if (info.error) {
                socket.emit('error', { message: info.message });
               }

               // necesito mandar el mensaje 


               console.log(info);
                
              }
              else {
                socket.emit('error', { message: 'Tipo de mensaje no soportado' });
              }
            }
            catch (error) {
              console.error('Error handling message:', error);
              socket.emit('error', { message: 'Ha ocurrido un error en el servidor', error });
            }


          });


          socket.on('disconnect', async (reason) => {
            strapi.log.debug(`Cliente ${socket.id} se ha desconectado`);

            console.log(reason)



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
