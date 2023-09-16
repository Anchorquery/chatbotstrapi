'use strict';



const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { ConversationChain, LLMChain } = require("langchain/chains");
const { v4: uuidv4 } = require('uuid');
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { CallbackManager } = require("langchain/callbacks");
const Promise = require('bluebird');
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const path = require('path');
const { PromptTemplate, OpenAI } = require("langchain");
const { templates } = require("../util/templates");
const { summarizeLongDocument } = require("../util/summarizer");
const SupabaseVectorStoreCustom = require("../util/supabase");
const clientS = require('../util/superbase-client.js');
const chat = require("./api/chat/controllers/chat");
const { OPENAI_API_KEY } = process.env;
let { URL } = process.env;
const llm = new OpenAI({});
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
        let interval;
        // @ts-ignore
        var io = require("socket.io")(strapi.server.httpServer, {
          cors: { // cors setup
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["Authorization"],
            credentials: true,
          },
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

            console.log(`Cliente ${user.username} ${user.name} ${user.lastname} se ha conectado`);


            user.avatar = user.avatar ? URL + user.avatar.url : URL + '/uploads/user_147dd8408e.png';




            user["socketId"] = socket.id;

            user["lastConnection"] = new Date().getTime();
            user["status"] = 'online';

            socket.user = user;


            // lo agrego a una sala unica para el usuario llamada user_uuid


            socket.join(`user_${user.uuid}`);


            next();
          } catch (error) {


            console.log(error)

          }



        }).on('connection', function (socket) {
          if (interval) {
            clearInterval(interval);
          }

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

            let { message, sala, client } = data;

            message = message.trim();





           
  


            if (!sala) {

              socket.emit('error', { message: 'Chat no encontrado' });

              return;

            }

            if (!message) {

              socket.emit('error', { message: 'Mensaje no encontrado' });

              return;

            }

            const chatModel = await strapi.db.query('api::chat.chat').findOne({

              where: {

                uuid: sala,
                user: socket.user.id

              },
            });

            if (!chatModel) {

              // emito un error

              socket.emit('error', { message: 'Chat no encontrado' });
              return;
            }




            let [relationMessages,pastMessages] = await Promise.all([strapi.services['api::chat.custom-chat'].prepararMemoriaVector(socket.user.id, message, 5, chatModel.id), await strapi.services['api::chat.custom-chat'].prepararMemoria(chatModel, 50)]);

            console.log(relationMessages)

            console.log(pastMessages)

            const inquiryChain = new LLMChain({
              llm, prompt: new PromptTemplate({
                template: templates.inquiryTemplate,
                inputVariables: ["userPrompt", "conversationHistory"],
              })
            });
           // const inquiryChainResult = await inquiryChain.call({ userPrompt: message, conversationHistory: pastMessages })
            const inquiry = message


            const memory = new BufferMemory({
              chatHistory: new ChatMessageHistory(pastMessages),
              //   returnMessages: true, //optional
              memoryKey: "immediateHistory",
              inputKey: "input",
              //  outputKey: "answer", 
              aiPrefix: "AI: ",
              humanPrefix: "Human: ",


            });




            const matches = await strapi.services['api::chat.custom-chat'].getMatchesFromEmbeddings(socket.user.id, inquiry, 5, client);



            const source = matches && Array.from(
              matches.reduce((map, match) => {
                const metadata = match.metadata || {};
                console.log(metadata)
                const { source } = metadata;
                if (match.type === 'file') {
                  const url = source.split('uploads')[1];
                  const normalizedUrl = path.normalize(path.join(URL, 'uploads' + url)).replace(/\\/g, '/');
                  if (!map.has(normalizedUrl)) {
                    map.set(normalizedUrl, {
                      type: 'file',
                      url: normalizedUrl,
                      title: match.title,
                    });
                  }
                }
                return map;
              }, new Map()).values()
            );
            let docs = matches.map((match) => {

              return match.content;

            });

            /*
              
            version antigua que maneja sciertos casos de promtps
            
            const promptTemplate = new PromptTemplate({
              template: matches.length>0 ? templates.qaTemplate2 : templates.defaultTemplate,
              inputVariables:matches.length>0 ? ["summaries", "question", "conversationHistory"] : ["conversationHistory", "question"]
            });*/

            // le quito los saltos de linea al prompt

            let promtp =chatModel.config.prompt.content.replace(/\n/g, " ");


            
            const promptTemplate = new PromptTemplate({
              template: promtp,
              inputVariables: ["context", "input", "immediateHistory", "history", "idioma", "tone"]
            });

            const model = new ChatOpenAI({
              openAIApiKey: OPENAI_API_KEY,
              modelName: "gpt-3.5-turbo" || chatModel.modelName,
              temperature: 0.7,
              timeout: 45000,
              topP: 1,
              streaming: true,
              //verbose: true,
              callbackManager: CallbackManager.fromHandlers({
                async handleLLMNewToken(token) {


                  socket.emit('messageResponse', { message: token });


                },
                async handleLLMEnd(result) {


                  socket.emit('messageEnd', { message: result });
                }
              }),
            });
            const chain = new LLMChain({
              llm: model,
              memory: memory,
              prompt: promptTemplate,
              verbose: true,


            });
            const allDocs = docs.join("\n")

            // @ts-ignore
            const summary = allDocs.length > 4000 ? await summarizeLongDocument({ document: allDocs, inquiry: inquiry }) : allDocs

            let response = await chain.call(
              {
                history : relationMessages,
                input: inquiry,
                context: summary,
                idioma: chatModel.config.language || 'Español',
                tone: chatModel.config.tone || 'Formal',
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
              chat : sala,
              content : message,
              uuid : uuidv4(),
            }
   
              await SupabaseVectorStoreCustom.fromTexts([message], { source: 'user' }, new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY }), dbConfig);

              dbConfig.extraData = {
                custom: true,
                type: "message",
                sender: 'ia',
                chat : sala,
                content : response.text,
                uuid : uuidv4(),
              }

              await SupabaseVectorStoreCustom.fromTexts([response.text], { source: 'ia' }, new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY }), dbConfig);

            });


          socket.on('disconnect', async (socket) => {
            console.log(`Cliente ${socket.id} se ha desconectado`);


          });






        })

        // guardo el socket en el servidor para poder usarlo en los controladores

        strapi.io = io;





      } catch (error) {
        console.log(error)
        throw error;
      }
    });


  },



};