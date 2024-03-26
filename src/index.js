'use strict';



const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { LLMChain } = require("langchain/chains");
const { v4: uuidv4 } = require('uuid');
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { CallbackManager } = require("langchain/callbacks");
const Promise = require('bluebird');
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const path = require('path');
const { PromptTemplate } = require ("langchain/prompts");
const { summarizeLongDocument } = require("../util/summarizer");
const SupabaseVectorStoreCustom = require("../util/supabase");
const clientS = require('../util/superbase-client.js');
const { convert } = require('html-to-text');
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



            user.avatar = user.avatar ? URL + user.avatar.url : URL + '/uploads/user_147dd8408e.png';




            user["socketId"] = socket.id;

            user["lastConnection"] = new Date().getTime();
            user["status"] = 'online';

            socket.user = user;


            // lo agrego a una sala unica para el usuario llamada user_uuid


            socket.join(`user_${user.uuid}`);


            next();
          } catch (error) {


            strapi.log.debug(error)

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

            try {
              let { message, sala, client,cantidadVectoresMenajes,  cantidadMensajesHistorial, language,tone } = data;

              message = message.trim();

              let mentions = extractMentionData(message,true);
              
              console.log(mentions)
             
  
  
  
  
              cantidadMensajesHistorial = cantidadMensajesHistorial || 10;

              cantidadVectoresMenajes = cantidadVectoresMenajes || 5;
             
  
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
  
  
              // emito un mensaje indicando que se buscan mensajes anteriores
  
              socket.emit('info', { message: 'Buscando mensajes en memoria' });

              let relationMessages = [];
              let pastMessages=[];
              if(mentions.archivo.length === 0 && mentions.tag.length === 0) {
                 [relationMessages,pastMessages] = await Promise.all([strapi.services['api::chat.custom-chat'].prepararMemoriaVector(socket.user.id, message, cantidadVectoresMenajes, chatModel.id), await strapi.services['api::chat.custom-chat'].prepararMemoria(message,chatModel, cantidadMensajesHistorial)]);
              }
  

  
  
              const inquiry = message
  
  
              const memory = new BufferMemory({
                chatHistory: new ChatMessageHistory(pastMessages),
                memoryKey: "immediateHistory",
                inputKey: "input",
                aiPrefix: "AI: ",
                humanPrefix: "Human: ",
  
  
              });
  
              // memoria preparada mando mensaje de que se ha encontrado
  
              socket.emit('info', { message: 'Memoria preparada' });
  

              // emito mensaje de que se estan buscando documentos relacionados
  
              socket.emit('info', { message: 'Buscando documentos relacionados con la consulta' });
  
  
  
              let matches = await strapi.services['api::chat.custom-chat'].getMatchesFromEmbeddings(socket.user.id, inquiry, cantidadVectoresMenajes, client,mentions);

              console.log("MATCHES", matches)
  
              // emito mensaje de que se han encontrado documentos relacionados

              if(!matches){
                matches = [];
              }
  
              socket.emit('info', { message: `Se encontraron ${matches.length} documentos relacionados ` });
  
  
  
             /* const source = matches && Array.from(
                matches.reduce((map, match) => {
                  const metadata = match.metadata || {};
                  strapi.log.debug(metadata)
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
              );*/
  
              /*const source = matches && Array.from(
                matches.reduce((map, match) => {
                  const metadata = match.metadata || {};
                  const { source } = metadata;
                  let url = null;
                  let normalizedUrl = null;
                  if (match.type === 'file') {
                    strapi.log.debug(url)
                     url = source.split('uploads')[1];
                     normalizedUrl = path.normalize('/uploads' + url); 

                  }else{
                     normalizedUrl = match.url;
                     url = match.url;
  
                  }
                    metadata.text = match.content;
                    if (!map.has(normalizedUrl)) {
                      map.set(normalizedUrl, {
                        type: match.type,
                        url: normalizedUrl,
                        titles: [match.title], 
                        metadata: [metadata],
                        text : match.content,
                      });
                    } else {
                      // agrego el titulo si no existe en el arreglo
  
                      if(!map.get(normalizedUrl).titles.includes(match.title)){
                          
                          map.get(normalizedUrl).titles.push(match.title);
                  
                      }
                      
  
                      map.get(normalizedUrl).metadata.push(metadata);
                    }
                  
                  return map;
                }, new Map()).values()
              );*/
              
              let docs = matches.map((match) => {
  
                return match.content;
  
              });
  
              let promtp = null;
              if(matches.length> 0)  {
                promtp = `
                - Se dará INPUT , CHATHISTORY, MEMORY y RELEVANTDOCS
                - INPUT corresponde al mensaje que el usuario está enviando, puede ser una pregunta o una petición. 
                - CHATHISTORY es una memoria con mensajes pasados que tiene relacion con el mensaje del usuario. 
                - MEMORY corresponde a los ultimos mensajes de la conversación en orden cronologico. 
                - RELEVANTDOCS , información relevante que guarda relación con el mensaje del usuario (INPUT).
                - Tienes acceso al historial de chat con el usuario (CHATHISTORY/MEMORY) y al contexto (RELEVANTDOCS) proporcionado por el usuario. 
                - Al responder, piensa si el mensaje (INPUT) se refiere a algo en la MEMORY o en el CHATHISTORY antes de consultar los RELEVANTDOCS. 
                - Si el mensaje del usuario (INPUT) no tiene relación con la MEMORIA o con el CHATHISTORY no los uses como referencia. Si no tienen información no la inventes, pero si hay  RELEVANTDOCS responde en base a eso.
                - No justifiques tus respuestas, si el INPUT no tiene ninguna relación o sentido con MEMORY,CHATHISTORY o  RELEVANTDOCS  entonces no los uses como contexto. 
                - No te refieras a ti mismo en ninguno de los contenidos creados. 
                - Siempre responde en {idioma}.
                - Siempre responde utilizando un tono {tone}. 
                - Siempre responde en texto enriquecido, usando encabezados, listas, parrafos , negritas , entre otras etiquetas que sean oportunas.
                - Tu objetivo principal es responder sin inventar nada. Si no tienes inforamción para responder , avisa que no puedes dar una respuesta clara por falta de contexto.   
                
                RELEVANTDOCS: {context}
                 
                CHATHISTORY: {history}
                 
                MEMORY: {immediateHistory}
                
                INPUT : {input}
                
                Respuesta final :`;
              }else{
                promtp = `
                - Se dará INPUT y MEMORY.
                - INPUT corresponde al mensaje que el usuario está enviando, puede ser una pregunta o una petición. 
                - MEMORY corresponde a los ultimos mensajes de la conversación en orden cronologico. 
                - No te refieras a ti mismo en ninguno de los contenidos creados. 
                - Siempre responde en {idioma}.
                - Siempre responde utilizando un tono {tone}. 
                - Siempre responde en texto enriquecido, usando encabezados, listas, parrafos , negritas , entre otras etiquetas que sean oportunas. 
                
                 
                CHATHISTORY: {history}
                 
                MEMORY: {immediateHistory}
                
                INPUT : {input}
                
                Respuesta final :`;


              }

              
              const promptTemplate = new PromptTemplate({
                template: promtp,
                inputVariables: matches.length> 0 ? ["context", "input", "immediateHistory", "history", "idioma", "tone"] : [ "input", "immediateHistory", "history", "idioma", "tone"]
              });
  
  
              // mando mensaje de preparando modelo
  
              socket.emit('info', { message: 'Preparando modelo' });
  
              
  
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
  
  
                    socket.emit('messageEnd', { message: result , source : [], uuid : uuidv4() , sala: sala});

  
                    
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
  
              socket.emit('info', { message: 'Formateando información' });
              // lanzo un error randon para probar el error handler
  
  
              // @ts-ignore
              const summary = allDocs.length > process.env.LIMIT_DOCUMENT_CHARACTERS_MATH ? await summarizeLongDocument({ document: allDocs, inquiry: inquiry }) : allDocs
              socket.emit('info', { message: 'Iniciando respuesta.' });
              let response = await chain.call(
                {
                  history : relationMessages,
                  input: inquiry,
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
                  metadata : [],
                }
  
                await SupabaseVectorStoreCustom.fromTexts([response.text], { source: 'ia' }, new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY }), dbConfig);
            } catch (error) {
              strapi.io.emit('error', { message: 'Ha ocurrido un error en el servidor', error: error });
              strapi.log.debug(error)

              // lanzo el error

              throw error;
            }



            });


          socket.on('disconnect', async (socket) => {
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
    // function extractMentionData(htmlMessage, data_id = false) {
    //   const mentionRegex = /<span class="mention"[^>]*title="([^"]*)"[^>]*data-id="([^"]*)"[^>]*>/g;
    //   const matches = [...htmlMessage.matchAll(mentionRegex)];
      
    //   if (data_id) {
    //     // Si data_id es verdadero, retorna solo un array de data-ids convertidos a enteros.
    //     return matches.map(match => parseInt(match[2], 10));
    //   } else {
    //     // Retorna el objeto con title y dataId (convertido a entero) si data_id es falso.
    //     return matches.map(match => ({
    //       title: match[1],
    //       dataId: parseInt(match[2], 10), // Convierte dataId a entero
    //     }));
    //   }
    // }
    function extractMentionData(htmlMessage, data_id = false) {
      // Ajusta la expresión regular para que coincida con tu HTML específico.
      const mentionRegex = /<span class="(archivo|tag) mention" contenteditable="true" title="([^"]+)" data-id="([^"]+)"[^>]*>/g;
      const matches = [...htmlMessage.matchAll(mentionRegex)];
    
      const result = {
        archivo: [],
        tag: []
      };
    
      matches.forEach(match => {
        const dataId = match[3]; // Captura data-id
        const title = match[2]; // Captura el título
    
        const item = data_id ? dataId : { title, dataId };
    
        // Determina si es archivo o tag y añade al array correspondiente.
        if (match[1] === 'archivo') {
          result.archivo.push(item);
        } else if (match[1] === 'tag') {
          result.tag.push(item);
        }
      });
    
      return result;
    }
    
    
    

  },



};
