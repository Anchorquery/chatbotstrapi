/*COLAS PARA ARCHIVOS, NO PARA URLS*/const Queue = require('bull');

const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const SupabaseVectorStoreCustom = require('../supabase.js');
const clientS = require('../../util/superbase-client.js');
const Promise = require('bluebird');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const path = require('path');
const { CSVLoader } = require('langchain/document_loaders/fs/csv');
const { DocxLoader } = require('langchain/document_loaders/fs/docx');
const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
const { TextLoader } = require('langchain/document_loaders/fs/text');
const fs = Promise.promisifyAll(require('fs'));
const textSplitter = new RecursiveCharacterTextSplitter({
	chunkSize: 1000,
	chunkOverlap:200,
});
const embading = new OpenAIEmbeddings(

	{
		openAIApiKey: process.env.OPENAI_API_KEY,
		batchSize: 300,
		modelName: 'text-embedding-ada-002',

	}

);
const dbConfig = {
	client: clientS,
	tableName: 'documents',
	query_name: 'match_documents_2',
};
class DocumentQueue {
  constructor(user, groupIncrust) {
    this.user = user;
    this.groupIncrust = groupIncrust;
    this.queue = new Queue('document-file-queue', {
      redis: process.env.REDIS_URL,
      limiter: {
        max: 2,
        duration: 1000,
      },
    });

    this.initializeQueue();
  }

  initializeQueue() {
    this.queue.process('document-file-queue', (job) => this.processDocument(job));

   this.queue.on('waiting', (jobId) => this.onWaiting(jobId));
    this.queue.on('active', (job, jobPromise) => this.onActive(job));
    this.queue.on('completed', (job, result) => this.onCompleted(job));
    this.queue.on('failed', (job, err) => this.onFailed(job, err));
    this.queue.on('error', (error) => this.onError(error));
    this.queue.on('removed', (job) => this.onRemoved(job));
    this.queue.on('progress', (job, progress) => this.onProgress(job, progress));
  }

		onWaiting(jobId) {
			this.emitMessageTask('waiting', `Tarea en espera`);
			this.updateGroupIncrustation('waiting', true);
	}

	onActive(job) {
			console.log(`A job with ID ${job.id} is active`);
			this.emitMessageTask('active', `Tarea en proceso`);
			this.updateGroupIncrustation('active', true);
	}

	onCompleted(job) {
			console.log(`A job with ID ${job.id} has been completed`);
			this.emitMessageTask('completed', `Tarea completada`);
			this.updateGroupIncrustation('completed', false);
	}

	onFailed(job, err) {
			console.log(`A job with ID ${job.id} has failed with ${err.message}`);
	}

	onError(error) {
			console.log(`Queue error: ${error}`);
	}

	onRemoved(job) {
			console.log(`Job ${job.id} has been removed.`);
	}

	onProgress(job, progress) {
			this.emitMessageTask('progress', `Tarea en proceso`, progress);
	}

	emitMessageTask(type, message, progress = null) {
			const payload = { type, message };
			if (progress !== null) {
					payload.progress = progress;
			}
			// @ts-ignore
			strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', payload);
	}

	async updateGroupIncrustation(state, inQueue) {
			await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({
					where: { id: this.groupIncrust },
					data: { queueState: state, inQueue: inQueue }
			});
	}

  addDocumentToQueue(data) {
    this.queue.add('document-file-queue', data);
  }

		async processDocument(job) {
			const {
					nombreFile, clienteEmpresa, user,
					grupoIncrustacion,file, infobase
			} = job.data;
	
			try {

	

let docs =  await this.createDocumt(nombreFile, file, textSplitter, clienteEmpresa ? clienteEmpresa.nombre  : null)
				console.log(this.groupIncrust)
					let extraData = {
							custom: true,
							client: clienteEmpresa ? clienteEmpresa.id : null,
							type: "file",
							creator: user.id,
							title: nombreFile,
							infobase:infobase,
							grupoIncrustacion: this.groupIncrust,
					};
	
					// @ts-ignore
					await this.processDocs(job, docs, embading, { ...dbConfig, extraData });
					job.moveToCompleted('done', true);
			} catch (error) {
					console.error('Error processing document:', error.message);
					job.moveToFailed({ message: 'job failed' });
			}
	}
	

		async processDocs(job, docs, embedding, dbConfig) {
			try {
					// @ts-ignore
					strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', {
							type: 'message',
							message: `Tarea en proceso, ${docs.length} documentos fueron encontrados, iniciando incrustación`,
					});
	

							try {
			

								await SupabaseVectorStoreCustom.fromDocuments(docs, embedding, dbConfig);
	

									job.progress(100);
							} catch (docError) {
									// Log the error specific to the document processing but allow other documents to continue processing
									console.error(`Error processing document: ${docError.message}`);
							}


						// @ts-ignore
					strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', {
							type: 'end',
							message: `Tarea finalizada, el documento fue insertado`,
					});
	
					// Actualización del estado en la base de datos
				await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({
							where: { id: this.groupIncrust },
							data: { queueState: 'completed' },
					});
			} catch (error) {
					// Captura de errores generales en el proceso de documentos
					console.error('Ocurrió un error al procesar las promesas:', error.message);
					throw new Error('Failed to process documents due to an error');
			}
	}

	async createDocumt(nombre, file, textSplitter, nameClient = null) {

		try {
			const currentDirectory = __dirname;

			const parentDirectory = path.join(currentDirectory, '../..');

			// Parte relativa de la URL
			const relativePath = "public" + file.url;

			// Combinar la ubicación del archivo con la parte relativa
			const absolutePath = path.join(parentDirectory, relativePath);




			//saco el formato del archivo

			const format = file.ext;


			let loader = null;
			if (format == '.txt' || format == '.TXT') {

				loader = new TextLoader(
					absolutePath
				);

			} else if (format == '.csv'  || format == '.CSV') {

				loader = new CSVLoader(
					absolutePath
				);

			} else if (format == '.pdf' || format == '.PDF') {

				loader = new PDFLoader(
					absolutePath
				);

			} else if (format == '.docx' || format == '.DOCX') {

				loader = new DocxLoader(

					absolutePath

				);

			} else {

				console.log('Formato no soportado');

				throw new Error('Formato no soportado');

			}
			let docs = await loader.loadAndSplit(textSplitter);

			let chuckHeader = `DOCUMENT NAME: ${nombre} . \n \n`;
			if (nameClient) {
				chuckHeader += `PROPERTY DOCUMENT: ${nameClient}.  \n \n`;
			}


			docs.forEach((doc) => {

				doc.pageContent = chuckHeader + doc.pageContent;
				doc.metadata = {
					...doc.metadata,
					client: nameClient,
					file: nombre,
					url : file.url
				}

			}

			);





			return docs;

		} catch (error) {
			console.log(error);
		}



	}
	

	
}

module.exports = DocumentQueue;
