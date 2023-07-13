'use strict';

/**
 * strapi-chat service
 */

const sessionManager = require("../sessionManager");
const { OpenAI } = require("langchain/llms/openai");
const { BufferMemory } = require("langchain/memory");
const { ConversationChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");
const { v4: uuidv4 } = require('uuid');

const  { apiKey:OPENAI_API_KEY } = process.env;

function configureLangChainChat(apiKey, config = {}) {
  
  
  const memory = new BufferMemory();





  const model = new OpenAI({
    openAIApiKey: apiKey,
    modelName: "gpt-3.5-turbo" || config.modelName,
    temperature: config.tone ?  Number(config.tone):  0.7,
    timeout: 45000,
    streaming: false,
   
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

async function generateSession(apiKey , config = {}) {

  const sessionId = uuidv4();

  const language = config.language || "English";

  const template = `
    system: Your name is {input}, you are playing a human character who is witty, snarky and very smart.

    Directions: 
      Always respond in character.
      If something is not clear, ask for clarification.
      If you are stuck, ask for help.
      Ask questions to learn more about the topic and conversation.
      Anwser in: {language}
  `;

  const initializedPrompt = new PromptTemplate({ template, inputVariables: ["input","language"]  });

  const initialPrompt = await initializedPrompt.format({ input: "Ava", language: language });
  const langChain = configureLangChainChat(apiKey, config)
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
async function logInitialChat(sessionId, strapi,user) {
  await strapi
    .service("api::chat.chat")
    .create({ data: { sessionId: sessionId , user:user.id } });
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

module.exports = ({ strapi }) => ({
  chat: async (ctx) => {
    const user = ctx.state.user;
    let {tone, sessionId, language,message} = ctx.request.body.data;


    const existingSession = await sessionManager.sessions[sessionId];

    //cambio la temper de la sesion



    if (!existingSession) {
      const apiToken = process.env.OPENAI_API_KEY;
      if (!apiToken) throw new Error("OpenAI API Key not found");

      sessionId = await generateSession(apiToken, {tone:tone, language: language });

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

  getSessionById: async (ctx) => {
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

  deleteSessionById: async (ctx) => {
    const sessionId = ctx.params.sessionId;
    const sessionExists = await sessionManager.getSession(sessionId);
    if (!sessionExists) return { error: "Session not found" };
    await sessionManager.clearSessionById(sessionId);
    return { message: "Session deleted" };
  },

  clearAllSessions: async (ctx) => {
    await sessionManager.clearAllSessions();
    return { message: "Sessions cleared" };
  },

  getAllSessions: async (ctx) => {
    const sessions = await sessionManager.showAllSessions();
    return sessions;
  },

});
