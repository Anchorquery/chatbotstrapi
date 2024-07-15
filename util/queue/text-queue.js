/*COLAS PARA ARCHIVOS, NO PARA URLS*/const Queue = require('bull');

const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const SupabaseVectorStoreCustom = require('../supabase.js');
const clientS = require('../../util/superbase-client.js');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const {REDIS_PASSWORD, REDIS_HOST,REDIS_PORT,REDIS_DB} = process.env;
const textSplitter = new RecursiveCharacterTextSplitter({
	chunkSize: 2000,
	chunkOverlap:100,
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
      redis: {
							host: REDIS_HOST,
    			port: parseInt(REDIS_PORT),
							password: REDIS_PASSWORD,
						},
      limiter: {
        max: 2,
        duration: 1000,
      },
    });
				try {
					this.initializeQueue();
				} catch (error) {
						strapi.log.error(error)
				}	
    
  }

  initializeQueue() {
    this.queue.process('document-file-queue', (job) => this.processDocument(job));

   this.queue.on('waiting', (jobId) => this.onWaiting(jobId));
    this.queue.on('active', (job, jobPromise) => this.onActive(job));
    this.queue.on('completed', (job, result) => this.onCompleted(job,result));
    this.queue.on('failed', (job, err) => this.onFailed(job, err));
    this.queue.on('error', (error) => this.onError(error));
    this.queue.on('removed', (job) => this.onRemoved(job));
    this.queue.on('progress', (job, progress) => this.onProgress(job, progress));
  }

		async onWaiting(jobId) {
			strapi.log.debug(`A job with ID ${jobId} is waiting`);
			await this.updateGroupIncrustation('waiting', true);
			this.emitMessageTask('waiting', `Tarea en espera`);
			
	}

	async onActive(job) {
			strapi.log.debug(`A job with ID ${job.id} is active`);
			await this.updateGroupIncrustation('active', true);
			this.emitMessageTask('active', `Tarea en proceso`);
			
	}

	async onCompleted(job,result) {
			strapi.log.debug(`A job with ID ${job.id} has been completed`,result);
			
			await this.updateGroupIncrustation('completed', false);
			this.emitMessageTask('completed', `Tarea completada`);
			await this.queue.close();
	}

	async onFailed(job, err) {

			strapi.log.debug(`A job with ID ${job.id} has failed with ${err.message}`);
			await this.queue.close();
	}

	async onError(error) {
			strapi.log.debug(`Queue error: ${error}`);
			await this.queue.close();
	}

	async onRemoved(job) {
			strapi.log.debug(`Job ${job.id} has been removed.`);
			
	}

	onProgress(job, progress) {
			this.emitMessageTask('progress', `Tarea en proceso`, progress);
	}

	emitMessageTask(type, message, progress = null, ) {
			const payload = { type, message };
			if (progress !== null) {
					payload.progress = progress;
			}

payload.grupoIncrustacion = this.groupIncrust;
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
					grupoIncrustacion,text, infobase
			} = job.data;
	
			try {

	

let docs =  await this.createDocumt(nombreFile, text, textSplitter, clienteEmpresa ? clienteEmpresa.nombre  : null)

					let extraData = {
							custom: true,
							client: clienteEmpresa ? clienteEmpresa.id : null,
							type: "text",
							creator: user.id,
							title: nombreFile,
							infobase:infobase,
							grupoIncrustacion: this.groupIncrust,
					};
	
					// @ts-ignore
					await this.processDocs(job, docs, embading, { ...dbConfig, extraData });
					job.moveToCompleted('done', true);
			} catch (error) {
					strapi.log.error('Error processing document:', error.message);
					job.moveToFailed({ message: 'job failed' });
						throw error.message;
					
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
									strapi.log.error(`Error processing document: ${docError.message}`);
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
					strapi.log.error('Ocurrió un error al procesar las promesas:', error.message);
					throw new Error('Failed to process documents due to an error');
			}
	}

	async createDocumt(nombre, text, textSplitter, nameClient = null) {

		try {


			console.log('Nombre:', nombre);
			console.log('Texto:', text);

			

			let chuckHeader = `DOCUMENT NAME: ${nombre} . \n \n`;
			if (nameClient) {
				chuckHeader += `PROPERTY DOCUMENT: ${nameClient}.  \n \n`;
			}

			const docs = await textSplitter.splitText(text);


			docs.forEach((doc) => {

				console.log('Documento:', doc);

				doc.pageContent = chuckHeader + doc.pageContent;
				doc.metadata = {
					...doc.metadata,
					client: nameClient,
					file: nombre,
				}

			}

			);




			console.log('Documentos creados:', docs.length);

			console.log('Documentos creados:', docs);


			return docs;

		} catch (error) {
			strapi.log.debug(error);
		}



	}
	

	
}

module.exports = DocumentQueue;
