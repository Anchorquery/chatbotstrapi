const { storeMessageInDatabase } = require("./storeMessageInDatabase");
const clientS = require('../superbase-client.js');
const Promise = require('bluebird');

/*function handleDatabaseOperations(userMessage, aiMessage, sala, userType, aiType) {
    const dbConfig = {
        client: clientS,
        tableName: 'messages',
        query_name: 'match_documents_2',
    };

    let fileia = aiMessage.url ? aiMessage : null;
    let fileuser = userMessage.url ? userMessage : null;
    return Promise.all([
        storeMessageInDatabase(userMessage.text, userType, sala, dbConfig, fileuser),
        storeMessageInDatabase(aiMessage.text, aiType, sala, dbConfig, fileia)
    ]).then(() => {
        console.log('Both messages stored successfully.');
    }).catch(err => {
        console.error('Error storing messages:', err);
        throw err;  // Re-throw the error if needed
    });
}*/

async function handleDatabaseOperations(userMessage, aiMessage, sala, userType, aiType) {
    const dbConfig = {
      client: clientS,
      tableName: 'messages',
      query_name: 'match_documents_2',
    };
  
    let fileia = aiMessage.url ? aiMessage : null;
    let fileuser = userMessage.url ? userMessage : null;
  
    try {
      await storeMessageInDatabase(userMessage.text, userType, sala, dbConfig, fileuser);
      console.log('User message stored successfully.');
  
      await storeMessageInDatabase(aiMessage.text, aiType, sala, dbConfig, fileia);
      console.log('AI message stored successfully.');
    } catch (err) {
      console.error('Error storing messages:', err);
      throw err;  // Re-throw the error if needed
    }
  }

module.exports = { handleDatabaseOperations };
