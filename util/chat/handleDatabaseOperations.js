const { storeMessageInDatabase } = require("./storeMessageInDatabase");
const clientS = require('../superbase-client.js');
const Promise = require('bluebird');

function handleDatabaseOperations(userMessage, aiMessage, sala, userType, aiType) {
    const dbConfig = {
        client: clientS,
        tableName: 'messages',
        query_name: 'match_documents_2',
    };

    // Utiliza Promise.all para ejecutar ambas operaciones de base de datos en paralelo
    return Promise.all([
        storeMessageInDatabase(userMessage, userType, sala, dbConfig),
        storeMessageInDatabase(aiMessage, aiType, sala, dbConfig)
    ]).then(() => {
        console.log('Both messages stored successfully.');
    }).catch(err => {
        console.error('Error storing messages:', err);
        throw err;  // Re-throw the error if needed
    });
}

module.exports = { handleDatabaseOperations };
