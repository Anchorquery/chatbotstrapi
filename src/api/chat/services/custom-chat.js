'use strict';

/**
 * strapi-chat service
 */

const sessionManager = require("../sessionManager");
const { OpenAI } = require("langchain/llms/openai");
const { BufferMemory, ChatMessageHistory,VectorStoreRetrieverMemory } = require("langchain/memory");
const { ConversationChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");
const { v4: uuidv4 } = require('uuid');
const { createCoreService } = require("@strapi/strapi/lib/factories");
const { MemoryVectorStore }= require("langchain/vectorstores/memory");
const { OpenAIEmbeddings }= require("langchain/embeddings/openai");

const { HumanMessage, AIMessage } = require("langchain/schema");

const { OPENAI_API_KEY } = process.env;

const clientS = require('../../../../util/superbase-client.js');

const { SupabaseVectorStore } = require('langchain/vectorstores/supabase');



function configureLangChainChat(config = {}) {


  const memory = new BufferMemory();

  const model = new OpenAI({
    openAIApiKey: OPENAI_API_KEY,
    modelName: "gpt-3.5-turbo" || config.modelName,
    temperature: config.tone ? Number(config.tone) : 0.7,
    timeout: 45000,



  });

  const chain = new ConversationChain({
    llm: model,
    memory: memory,
  });

  return {
    chain: chain,
    memory: memory,
    model: model,
  }
}

async function generateSession(apiKey, config = {}) {

  const sessionId = uuidv4();

  const language = config.language || "English";

  /* const template = `
     system: Your name is {input}, you are playing a human character who is witty, snarky and very smart.
 
     Directions: 
       Always respond in character.
       If something is not clear, ask for clarification.
       If you are stuck, ask for help.
       Ask questions to learn more about the topic and conversation.
       Anwser in: {language}
   `;*/

  const template = `¡Hola! Soy ChatGPT, un modelo de lenguaje de inteligencia artificial. Estoy aquí para ayudarte con tus preguntas y brindarte información sobre una amplia gama de temas. ¿En qué puedo asistirte hoy?, responde en: {language}`;

  const initializedPrompt = new PromptTemplate({ template, inputVariables: ["language"] });

  const initialPrompt = await initializedPrompt.format({ language: language });
  const langChain = configureLangChainChat(config)
  await sessionManager.saveSession(sessionId, langChain.chain, initialPrompt)
  return sessionId;
}

async function getResponse(session, input) {

  try {

    let respuesta = await session.chain.call({ input: input })

    return respuesta;


  } catch (error) {
    // console.log(error)
    throw new Error(error.message);
  }



}

// Just added this  logInitialChat function
async function logInitialChat(sessionId, strapi, user) {
  await strapi
    .service("api::chat.chat")
    .create({ data: { sessionId: sessionId, user: user.id } });
}

// Just added this function updateExistingChat
async function updateExistingChat(sessionId, history, strapi) {
  const existingChat = await strapi
    .service("api::chat.chat")
    .find({ filters: { sessionId: sessionId } });

  const id = existingChat.results[0]?.id;

  if (id)
    await strapi
      .service("api::chat.chat")
      .update(id, { data: { history: JSON.stringify(history.messages) } });
}

module.exports = createCoreService('api::chat.chat', ({ strapi }) => ({

  async configureLangChain(chat, config = {}) {


  

    // genero la memoria 

    const pastMessages = await this.prepararMemoria(chat, 5);

  /*  const memory = new BufferMemory({
      chatHistory: new ChatMessageHistory(pastMessages),
    });*/

    const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
    let memory = new VectorStoreRetrieverMemory({
      vectorStoreRetriever: vectorStore.asRetriever(1),
      memoryKey: "history",
      
    });

   // memory = await this.prepararMemoriaVector(memory ,chat, 100);



    const model = new OpenAI({
      openAIApiKey: OPENAI_API_KEY,
      modelName: "gpt-3.5-turbo" || config.modelName,
      temperature: config.temperature ? Number(config.temperature.temperature) : 0.7,
      timeout: 45000,
      topP: config.topP ? Number(config.temperature.topP) : 1,
      streaming: config.streaming ? config.streaming : false,
      n: config.n ? Number(config.n) : 1,
    
    });

    const chain = new ConversationChain({
      llm: model,
      memory: memory,
    });

    return {
      chain: chain,
      memory: memory,
      model: model,
    }
  },

  async configureChat(prompt,config) {
  
    const language = config.language || "English";

   const  inputVariables = prompt.contextInputs;
   const template = prompt.content;
  

  
    const promptTemplate = new PromptTemplate({ template, inputVariables: [] });  
    const initialPrompt = await promptTemplate.format({ language: language });



  /* await strapi.db.query('api::chat.chat').create({

    data : {

      // @ts-ignore
      user : user.id,
      uuid : sessionId,
      history : JSON.stringify([]),
      session : {langChain , initialPrompt},
      config : config,
      iaConfig : langChain.model,
    }

    })*/
      

    
    return true;
  },

  async chat(ctx) {
    const user = ctx.state.user;
    let { tone, sessionId, language, message } = ctx.request.body.data;

    let socket = ctx.socket;


    const existingSession = await sessionManager.sessions[sessionId];
    if (!existingSession) {
      const apiToken = process.env.OPENAI_API_KEY;
      if (!apiToken) throw new Error("OpenAI API Key not found");

      sessionId = await generateSession(apiToken, { tone: tone, language: language });

      const newSession = await sessionManager.getSession(sessionId);


      await logInitialChat(sessionId, strapi, user);

      const response = await getResponse(newSession, newSession.initialPrompt);

      response.sessionId = sessionId;

      return response;
    } else {
      existingSession.chain.llm.temperature = tone ? Number(tone) : 0.7;



      existingSession.chain.llm.language = language ? language : "Español";

      // le agrego al message "Responde en: language"

      message = message + " Responde en: " + language;

      const session = await sessionManager.getSession(sessionId);


      const history = await sessionManager.getHistory(sessionId);

      const response = await getResponse(session, message);


      // Call the updateExistingChat function
      await updateExistingChat(sessionId, history, strapi);

      response.sessionId = sessionId;
      response.history = history.messages;

      await sessionManager.showAllSessions();
      return response;

    }
  },

  async getSessionById(ctx) {
    const sessionId = ctx.params.sessionId;
    const sessionExists = await sessionManager.getSession(sessionId);
    if (!sessionExists) return { error: "Session not found" };
    const history = await sessionManager.getHistory(sessionId);

    const response = {
      sessionId: sessionId,
      history: history.messages,
    };

    return response;
  },

  async deleteSessionById(ctx) {
    const sessionId = ctx.params.sessionId;
    const sessionExists = await sessionManager.getSession(sessionId);
    if (!sessionExists) return { error: "Session not found" };
    await sessionManager.clearSessionById(sessionId);
    return { message: "Session deleted" };
  },

  async clearAllSessions(ctx) {
    await sessionManager.clearAllSessions();
    return { message: "Sessions cleared" };
  },

  async getAllSessions(ctx) {
    const sessions = await sessionManager.showAllSessions();
    return sessions;
  },

 async prepararMemoria(chat, limit, user = 'User' ) {

  if (!chat) return;

  if (!limit) limit = 100;
  
  // busco todos lo mensajes del chat con el limit y los ordeno por fecha

  const mensajes = await strapi.db.query('api::message.message').findMany({

    where: {

      chat: chat.id,
    },
    limit: limit
  });


  const memoria = [];



  if (chat.config && chat.config.content) {

    memoria.push(new AIMessage({
      content: chat.config.content,
      name: "IA BOT",

    }));

 }


  mensajes.forEach(mensaje => {

    if (mensaje.sender== 'ia') {

      memoria.push(new AIMessage({
        content: mensaje.content.trim(),
        name: "IA BOT",

      }));

    } else {

      memoria.push(new HumanMessage({
        content: mensaje.content.trim(),
        name: user,

      }));

    }

  });


  return memoria;

},
async prepararMemoriaVector(idUser, message, match_count, sala ) {

  try {
    
    const embedder = new OpenAIEmbeddings({
      modelName: "text-embedding-ada-002"
    });

    const embeddings = await embedder.embedQuery(message);

    

    const {data} = await clientS.rpc('query_messages', {
      query_embedding: embeddings,
      match_threshold: 0.78,
      match_count:match_count, 
      sala : sala ? sala : null,
    });

    strapi.io.in(`user_${sala}`).emit('info', { message: `Se encontraron ${data.length} mensajes relacionados a la consulta.` });


    return data
    .map((doc) => doc.content)
    .join(', ')
    .trim()
    .replaceAll('\n', ' ');

    return data;

    
  } catch (error) {
    console.log(error)
    throw new Error(`Error querying embeddings: ${error}`);
  }


},

async getMatchesFromEmbeddings ( creator, message, match_count,client = null,grupo_incrustacion = null) {

  try {
    
    const embedder = new OpenAIEmbeddings({
      modelName: "text-embedding-ada-002"
    });

    const embeddings = await embedder.embedQuery(message);

    

    const {data} = await clientS.rpc('query_documents', {
      query_embedding: embeddings,
      match_threshold: 0.78,
      match_count:match_count, 
      client : client ? client : null,
      //creator : creator ? creator : null,
      creator : null,
      grupo_incrustacion : null,
    });

    return data;

    
  } catch (error) {
    console.log(error)
    throw new Error(`Error querying embeddings: ${error}`);
  }


}
}));

