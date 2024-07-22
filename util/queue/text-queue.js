const Queue = require('bull');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const SupabaseVectorStoreCustom = require('../supabase.js');
const clientS = require('../../util/superbase-client.js');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { REDIS_PASSWORD, REDIS_HOST, REDIS_PORT, REDIS_DB } = process.env;

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 100,
});

const embading = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  batchSize: 300,
  modelName: 'text-embedding-ada-002',
});

const dbConfig = {
  client: clientS,
  tableName: 'documents',
  query_name: 'match_documents_2',
};

class DocumentQueue {
  constructor(user, groupIncrust) {
    this.user = user;
    this.groupIncrust = groupIncrust;
    this.queue = new Queue('document-text-queue', {
      redis: {
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT),
        password: REDIS_PASSWORD,
      },
      limiter: {
        max: 10,
        duration: 2000,
      },
    });

    this.initializeQueue();
  }

  initializeQueue() {
    this.queue.process('document-text-queue', (job) => this.processDocument(job));

    this.queue.on('waiting', (jobId) => this.onWaiting(jobId));
    this.queue.on('active', (job) => this.onActive(job));
    this.queue.on('completed', (job, result) => this.onCompleted(job, result));
    this.queue.on('failed', (job, err) => this.onFailed(job, err));
    this.queue.on('error', (error) => this.onError(error));
    this.queue.on('removed', (job) => this.onRemoved(job));
    this.queue.on('progress', (job, progress) => this.onProgress(job, progress));
  }

  onWaiting(jobId) {
    this.emitMessageTask('waiting', 'Tarea en espera');
    this.updateGroupIncrustation('waiting', jobId, true);
  }

  onActive(job) {
    strapi.log.debug(`A job with ID ${job.id} is active`);
    this.emitMessageTask('active', 'Tarea en proceso');
    this.updateGroupIncrustation('active', job.id, true);
  }

  async onCompleted(job, result) {
    strapi.log.debug(`A job with ID ${job.id} has been completed`);
    this.emitMessageTask('completed', 'Tarea completada');
    this.updateGroupIncrustation('completed', job.id, false);
  }

  async onFailed(job, err) {
    strapi.log.error(`A job with ID ${job.id} has failed with ${err.message}`);
    this.emitMessageTask('failed', `Tarea fallida: ${err.message}`);
    await this.updateGroupIncrustation('failed', job.id, false, err.message);
  }

  async onError(error) {
    strapi.log.error(`Queue error: ${error}`);
    this.emitMessageTask('error', `Error en la tarea: ${error.message}`);
    await this.updateGroupIncrustation('error', null, false, error.message);
  }

  async onRemoved(job) {
    strapi.log.debug(`Job ${job.id} has been removed.`);
    this.emitMessageTask('removed', 'Tarea removida');
    this.updateGroupIncrustation('removed', job.id, false);
  }

  onProgress(job, progress) {
    this.emitMessageTask('progress', 'Tarea en proceso', progress);
  }

  emitMessageTask(type, message, progress = null) {
    const payload = { type, message };
    if (progress !== null) {
      payload.progress = progress;
    }
    payload.grupoIncrustacion = this.groupIncrust;
    // @ts-ignore
    strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', payload);
  }

  async updateGroupIncrustation(state, idQueue, inQueue, error = null) {
    let data = { queueState: state, inQueue: inQueue };
    if (idQueue) {
      data.idQueue = idQueue;
    }
    if (error) {
      data.error = error;
    }
    await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({
      where: { id: this.groupIncrust },
      data: data,
    });
  }

  addDocumentToQueue(data) {
    this.queue.add('document-text-queue', data);
  }

  async processDocument(job) {
    const { nombreFile, clienteEmpresa, user, grupoIncrustacion, text, infobase, tags } = job.data;

    try {
      let docs = await this.createDocument(nombreFile, text, clienteEmpresa ? clienteEmpresa.nombre : null, tags);

      let extraData = {
        custom: true,
        client: clienteEmpresa ? clienteEmpresa.id : null,
        type: 'text',
        creator: user.id,
        title: nombreFile,
        infobase: infobase,
        grupoIncrustacion: this.groupIncrust,
      };

      // @ts-ignore
      await this.processDocs(job, docs, embading, { ...dbConfig, extraData });
      job.moveToCompleted('done', true);
    } catch (error) {
      strapi.log.error('Error processing document:', error.message);
      this.emitMessageTask('error', `Error en la tarea: ${error.message}`);
      await this.updateGroupIncrustation('failed', job.id, false, error.message);
      job.moveToFailed({ message: 'job failed' });
      throw new Error(error.message);
    }
  }

  async processDocs(job, docs, embedding, dbConfig) {
    try {
      this.emitMessageTask('message', 'Tarea en proceso, iniciando incrustación');

      await SupabaseVectorStoreCustom.fromDocuments(docs, embedding, dbConfig);
      job.progress(100);

      this.emitMessageTask('end', 'Tarea finalizada, el documento fue insertado');
      await this.updateGroupIncrustation('completed', null, false);
    } catch (error) {
      strapi.log.error('Error processing documents:', error.message);
      this.emitMessageTask('error', `Error en la tarea: ${error.message}`);
      await this.updateGroupIncrustation('error', null, false, error.message);
      job.moveToFailed({ message: 'job failed' });
      throw new Error('Failed to process documents due to an error');
    }
  }

  async createDocument(nombre, text, nameClient = null, tags = []) {
    try {
      let chuckHeader = `DOCUMENT NAME: ${nombre} .\n\n`;
      if (nameClient && nameClient !== 'null') {
        chuckHeader += `PROPERTY DOCUMENT: ${nameClient}.\n\n`;
      }

      if (tags && tags.length > 0) {

        // busco todos los tags por el id del array

        tags = await strapi.db.query('api::tag.tag').findMany({

          where: {

            id: {
              $in: tags
            }

          },
          select: ['title']

        });



        tags = tags.map((tag) => tag.title);

        chuckHeader += `TAGS: ${tags.join(', ')}.\n\n`;

      }

      const textChunks = await textSplitter.splitText(text);
      const docs = textChunks.map(chunk => ({
        pageContent: chuckHeader + chunk,
        metadata: {
          client: nameClient,
          file: nombre,
        },
      }));

      return docs;
    } catch (error) {
      strapi.log.error('Error creating documents:', error.message);
      this.emitMessageTask('error', `Error en la tarea: ${error.message}`);
      await this.updateGroupIncrustation('error', null, false, error.message);
      throw new Error(`Error creating documents: ${error.message}`);
    }
  }
}

module.exports = DocumentQueue;
