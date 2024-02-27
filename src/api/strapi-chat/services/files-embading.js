'use strict';

/**
	* strapi-chat service
	*/

const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { DirectoryLoader } = require('langchain/document_loaders/fs/directory');
const { OpenAI } = require('langchain/llms/openai');
const client = require('../../../../util/superbase-client.js');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
// llamo para csv , txt , pdf y docx
const { CSVLoader } = require('langchain/document_loaders/fs/csv');
const { DocxLoader } = require('langchain/document_loaders/fs/docx');
const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
const { TextLoader } = require('langchain/document_loaders/fs/text');

const { SupabaseVectorStore } = require('langchain/vectorstores/supabase');




const dbConfig = {
	client,
	tableName: 'documents',
	query_name: 'match_documents',
};

const embading = new OpenAIEmbeddings();

const textSplitter = new RecursiveCharacterTextSplitter({
	chunkSize: 1000,
	chunkOverlap: 200,
});


module.exports = ({ strapi }) => ({
	async loadDocument(ctx) {
		try {

			let path = ctx.request.body.path;

			//saco el formato del archivo

	const format = path.split('.')[1];


			let loader = null;
			if(format == 'txt') {

				loader = new TextLoader(
					path
				);

				}	else if(format == 'csv') {

					loader = new CSVLoader(
						path
					);

				}	else if(format == 'pdf') {

					loader = new PDFLoader(
						path
					);

				}	else if(format == 'docx') {

					loader = new DocxLoader(

						path

					);

				}	else {

					strapi.log.debug('Formato no soportado');

					throw	new Error('Formato no soportado');

				}



				
	
	
			const docs = await loader.loadAndSplit(textSplitter);
	
			return docs;
		}	catch (err) {
			strapi.log.debug(err.message);
			throw new Error(err.message);
		}



	},
	async embeddDocument(docs) {

		try {
			const vectorstores = await SupabaseVectorStore.fromDocuments(
				docs,
				embading,
				dbConfig,
			);
	
			return vectorstores;
		} catch (error) {
			strapi.log.debug(error);
			throw new Error(error.message || error);
		}


	//	await superbase.from('documents').delete();



	}
});