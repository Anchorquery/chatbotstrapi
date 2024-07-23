/*COLAS PARA ARCHIVOS, NO PARA URLS*/
const Queue = require('bull');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const SupabaseVectorStoreCustom = require('../supabase.js');
const clientS = require('../../util/superbase-client.js');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const path = require('path');
const { CSVLoader } = require('langchain/document_loaders/fs/csv');
const { DocxLoader } = require('langchain/document_loaders/fs/docx');
const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
const { TextLoader } = require('langchain/document_loaders/fs/text');
const { documentosNoEstructurados } = require('../loader/Unstructured');
const { REDIS_PASSWORD, REDIS_HOST, REDIS_PORT, REDIS_DB } = process.env;

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 5000,
  chunkOverlap: 500,
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

class DocumentFileQueue {
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
        max: 10,
        duration: 2000,
      },
    });
    this.initializeQueue();
  }

  initializeQueue() {
    console.log('Initializing document file queue', this.groupIncrust);
    this.queue.process('document-file-queue', 10, (job) => this.processDocument(job));

    this.queue.on('waiting', (jobId) => this.onWaiting(jobId));
    this.queue.on('active', (job) => this.onActive(job));
    this.queue.on('completed', (job, result) => this.onCompleted(job, result));
    this.queue.on('failed', (job, err) => this.onFailed(job, err));
    this.queue.on('error', (error) => this.onError(error));
    this.queue.on('removed', (job) => this.onRemoved(job));
    this.queue.on('progress', (job, progress) => this.onProgress(job, progress));
  }

  async onWaiting(jobId) {
    console.log(`A job with ID ${jobId} is waiting`);
    await this.updateGroupIncrustation('waiting', jobId, true);
    this.emitMessageTask('waiting', 'Tarea en espera');
  }

  async onActive(job) {
    console.log(`A job with ID ${job.id} is active`);
    await this.updateGroupIncrustation('active', job.id, true);
    this.emitMessageTask('active', 'Tarea en proceso');
  }

  async onCompleted(job, result) {
    console.log(`A job with ID ${job.id} has been completed`, result);
    await this.updateGroupIncrustation('completed', job.id, false);
    this.emitMessageTask('completed', 'Tarea completada');
  }

  async onFailed(job, err) {
    console.log(`A job with ID ${job.id} has failed with ${err.message}`);
    await this.updateGroupIncrustation('failed', job.id, false, err.message);
    this.emitMessageTask('failed', `Tarea fallida: ${err.message}`);
  }

  async onError(error) {
    console.log(`Queue error: ${error}`);
    await this.updateGroupIncrustation('error', null, false, error);
    this.emitMessageTask('error', `Error en la tarea: ${error.message}`);
  }

  async onRemoved(job) {
    console.log(`Job ${job.id} has been removed.`);
    this.emitMessageTask('removed', 'Tarea removida');
    //await this.updateGroupIncrustation('removed', job.id, false);
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
    let data = {
      queueState: state,
      inQueue: inQueue,
    };
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
    this.queue.add('document-file-queue', data, {
      attempts: 3, // Number of retry attempts

    });
  }

  async processDocument(job) {
    const { nombreFile, clienteEmpresa, user, file, infobase, tags } = job.data;

    try {
      let docs = await this.createDocument(nombreFile, file, clienteEmpresa ? clienteEmpresa.nombre : null, tags);

      let extraData = {
        custom: true,
        client: clienteEmpresa ? clienteEmpresa.id : null,
        type: "file",
        creator: user.id,
        title: nombreFile,
        infobase: infobase,
        grupoIncrustacion: this.groupIncrust,
      };

      // @ts-ignore
      await this.processDocs(job, docs, embading, { ...dbConfig, extraData });
      job.moveToCompleted('done', true);
    } catch (error) {
      console.log('Error processing document:', error);
      await this.updateGroupIncrustation('failed', job.id, false, error.message);
      this.emitMessageTask('failed', `Error en la tarea: ${error.message}`);
      job.moveToFailed({ message: 'job failed' });
      throw new Error(error.message);
    }
  }

  async processDocs(job, docs, embedding, dbConfig) {
    try {
      this.emitMessageTask('message', `Tarea en proceso, ${docs.length} documentos fueron encontrados, iniciando incrustación`);

      await SupabaseVectorStoreCustom.fromDocuments(docs, embedding, dbConfig);
      job.progress(100);

      this.emitMessageTask('end', 'Tarea finalizada, el documento fue insertado');
      await this.updateGroupIncrustation('completed', null, false);
    } catch (error) {
      console.log('Ocurrió un error al procesar las promesas:', error.message);
      this.emitMessageTask('error', `Error en la tarea: ${error.message}`);
      await this.updateGroupIncrustation('error', null, false, error.message);
      job.moveToFailed({ message: 'job failed' });
      throw new Error('Failed to process documents due to an error');
    }
  }

  async createDocument(nombre, file, nameClient = null, tags = []) {
    try {
      const currentDirectory = __dirname;
      const parentDirectory = path.join(currentDirectory, '../..');
      const relativePath = "public" + file.url;
      const absolutePath = path.join(parentDirectory, relativePath);

      const format = file.ext;
      let loader = null;

      switch (format.toLowerCase()) {
        case '.txt':
          loader = new TextLoader(absolutePath);
          break;
        case '.csv':
          loader = new CSVLoader(absolutePath);
          break;
        case '.pdf':
          loader = new PDFLoader(absolutePath);
          break;
        case '.docx':
          loader = new DocxLoader(absolutePath);
          break;
        default:
          const documents = await documentosNoEstructurados(absolutePath);
          return this.addMetadataToDocuments(documents, nombre, file.url, nameClient, tags);
      }

      let docs = await loader.loadAndSplit(textSplitter);
      return this.addMetadataToDocuments(docs, nombre, file.url, nameClient);
    } catch (error) {
      console.log('Error creating documents:', error.message);
      this.emitMessageTask('error', `Error en la tarea: ${error.message}`);
      await this.updateGroupIncrustation('error', null, false, error.message);
      throw new Error(`Failed to create documents: ${error.message}`);
    }
  }

  async addMetadataToDocuments(docs, nombre, url, nameClient, tags = []) {
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
    return docs.map((doc) => ({
      ...doc,
      pageContent: chuckHeader + doc.pageContent,
      metadata: {
        ...doc.metadata,
        client: nameClient,
        file: nombre,
        url: url,
      },
    }));
  }
}

module.exports = DocumentFileQueue;
