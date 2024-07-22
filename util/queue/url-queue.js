const Queue = require('bull');
const { SiteMapLoader } = require('../crawlers/site-map-loader.js');
const { convert } = require('html-to-text');
const { Crawler } = require('../crawlers/crawler.js');
const { Document } = require('langchain/document');
const { summarizeLongDocument } = require('../summarizer.js');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const SupabaseVectorStoreCustom = require('../supabase.js');
const clientS = require('../superbase-client.js');
const Promise = require('bluebird');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const path = require('path');

const fs = Promise.promisifyAll(require('fs'));
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 100,
});

const { REDIS_PASSWORD, REDIS_HOST, REDIS_PORT, REDIS_DB } = process.env;
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
class DocumentURLQueue {
  constructor(user, groupIncrust) {
    this.user = user;
    this.groupIncrust = groupIncrust;
    this.queue = new Queue('document-url-queue', {
      redis: {
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT),
        password: REDIS_PASSWORD,
      },
      limiter: {
        max: 10,       // Máximo de 5 trabajos
        duration: 2000,
      },
    });

    this.initializeQueue();
  }

  initializeQueue() {
    this.queue.process('document-url-queue', (job) => this.processDocument(job));

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
    this.updateGroupIncrustation('waiting', jobId, true);
  }

  onActive(job) {
    strapi.log.debug(`A job with ID ${job.id} is active`);
    this.emitMessageTask('active', `Tarea en proceso`);
    this.updateGroupIncrustation('active', job.id, true);
  }

  async onCompleted(job) {
    strapi.log.debug(`A job with ID ${job.id} has been completed`);
    this.emitMessageTask('completed', `Tarea completada`);
    this.updateGroupIncrustation('completed', job.id, false);


  }

  async onFailed(job, err) {
    strapi.log.debug(`A job with ID ${job.id} has failed with ${err.message}`);

    this.emitMessageTask('failed', `Tarea fallida`);

    this.updateGroupIncrustation('failed', job.id, false);


  }

  async onError(error) {
    strapi.log.debug(`Queue error: ${error}`);

    this.emitMessageTask('error', `Error en la tarea`);

    this.updateGroupIncrustation('error', null, false, error);



  }

  async onRemoved(job) {
    strapi.log.debug(`Job ${job.id} has been removed.`);

    this.emitMessageTask('removed', `Tarea removida`);

    this.updateGroupIncrustation('removed', job.id, false);

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

  async updateGroupIncrustation(state, idQueue, inQueue, error = null) {

    let data = {
      queueState: state,
      inQueue: inQueue
    }

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
    this.queue.add('document-url-queue', data);
  }

  async processDocument(job) {
    const {
      urlOrTxt, nombreFile, clienteEmpresa, summarize, cleanHtml, puppeteer, user,
      grupoIncrustacion, filterUrl = [], blocksize = 0, blocknum = 0,
      minLenChar = 200, recursivity = false, type = 'sitemap', tags = []
    } = job.data;

    try {
      let urls = await this.determineUrls(type, urlOrTxt, filterUrl, blocksize, blocknum, minLenChar);
      if (urls.length === 0) {
        console.log('No URLs found for processing');
        job.moveToCompleted('done', true);
        return;
      }

      let limit = this.determineLimit(recursivity, type);
      let docs = await this.createDocumtUrlCrawler(nombreFile, urls, clienteEmpresa?.name, {
        limit, summarize, cleanHtml, puppeteer
      }, tags);



      let extraData = {
        custom: true,
        client: clienteEmpresa ? clienteEmpresa.id : null,
        type: "url",
        creator: user.id,
        title: nombreFile || (urls.length === 1 ? urls[0] : 'Varios documentos'),
        grupoIncrustacion: grupoIncrustacion.id,
      };

      // @ts-ignore
      await this.processDocs(job, docs, embading, { ...dbConfig, extraData });
      job.moveToCompleted('done', true);
    } catch (error) {
      console.log('Error processing document:', error.message);
      // @ts-ignore
      strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', {
        type: 'error',
        message: `Error en la tarea: ${error.message}`,
      });

      // actualizo base de datos

      await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({

        where: { id: this.groupIncrust },

        data: { queueState: 'error', error: error.message },

      });

      job.moveToFailed({ message: 'job failed' });
    }
  }

  async determineUrls(type, urlOrTxt, filterUrl, blocksize, blocknum, minLenChar) {
    switch (type) {
      case 'sitemap':
        // Lógica para cargar URLs desde un sitemap
        const sitemapLoader = new SiteMapLoader(urlOrTxt, filterUrl, blocksize, blocknum, minLenChar);
        return await sitemapLoader.load();

      case 'url':
        // Si es una URL individual, simplemente devuelve la URL como un arreglo
        return [urlOrTxt];

      case 'txt':
        // Lógica para cargar URLs desde un archivo de texto
        return await this.readUrlsFromTxt(urlOrTxt);

      default:
        // En caso de tipo desconocido o no soportado, devuelve un arreglo vacío
        return [];
    }
  }

  determineLimit(recursivity, type) {
    // Ejemplo sencillo basado en recursividad y tipo
    if (recursivity && (type === 'url' || type === 'sitemap')) {
      // Poner un límite más alto si hay recursividad y el tipo es individual o sitemap
      return 50;
    } else {
      // Un límite estándar o ninguna limitación para otros casos
      return 0;
    }
  }


  async processDocs(job, docs, embedding, dbConfig) {
    try {
      // @ts-ignore
      strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', {
        type: 'message',
        message: `Tarea en proceso, ${docs.length} documentos fueron encontrados, iniciando incrustación`,
      });

      let completedTasks = 0;
      const totalTasks = docs.length;

      // Procesamiento de cada documento de manera concurrente con un límite de concurrencia
      await Promise.map(docs, async (doc) => {
        try {
          await SupabaseVectorStoreCustom.fromDocuments(doc, embedding, dbConfig);

          // Incremento y calculo del progreso después de cada tarea completada
          completedTasks++;
          const progress = (completedTasks / totalTasks) * 100;
          job.progress(progress);
        } catch (docError) {
          // Log the error specific to the document processing but allow other documents to continue processing
          console.error(`Error processing document: ${docError.message}`);
        }
      }, { concurrency: 5 }); // Puedes ajustar la cantidad de promesas en paralelo

      // Emitir evento de finalización al completar todas las tareas
      // @ts-ignore
      strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', {
        type: 'end',
        message: `Tarea finalizada, ${completedTasks} de ${totalTasks} documentos fueron insertados`,
      });

      // Actualización del estado en la base de datos
      await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({
        where: { id: this.groupIncrust },
        data: { queueState: 'finalizado' },
      });
    } catch (error) {
      // Captura de errores generales en el proceso de documentos
      console.error('Ocurrió un error al procesar las promesas:', error.message);

      // Emitir evento de error al fallar la tarea

      // @ts-ignore
      strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', {
        type: 'error',
        message: `Error en la tarea: ${error.message}`,
      });

      // Actualización del estado en la base de datos

      await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({
        where: { id: this.groupIncrust },
        data: { queueState: 'error', error: error.message },
      });
      throw new Error('Failed to process documents due to an error');
    }
  }


  async createDocumtUrlCrawler(nombre, urls, nameClient = null, options = {}, tags = []) {
    // Asegurarse de que las URLs sean un array.
    if (typeof urls === 'string') {
      urls = [urls];
    }

    const {
      limit = 0,
      summarize = false,
      cleanHtml = false,
      puppeteer = false
    } = options;

    try {
      const crawlerOptions = {
        ignoreImage: true,
        noLinkBrackets: true,
        uppercaseHeadings: false,
        ignoreHref: true,
        ignoreAnchor: true,
        tables: true,
      };

      // Inicializar y empezar el crawler.
      // @ts-ignore
      const crawler = new Crawler(urls, limit, 200, puppeteer);

      const pages = await crawler.start();


      // Procesar cada página extraída por el crawler.
      const documents = await Promise.all(pages.map(async page => {
        // Limpiar HTML si es necesario.
        let textContent = cleanHtml ? convert(page.text, crawlerOptions) : page.text;

        // Resumir contenido si es necesario.
        if (summarize) {
          // @ts-ignore
          textContent = await summarizeLongDocument({ document: textContent, forceSummarize: true });
        }

        // Construir el encabezado del documento.
        let header = `DOCUMENT NAME: ${page.title}.\n\n`;
        if (nameClient && nameClient !== 'null') {
          header += `PROPERTY DOCUMENT: ${nameClient}.\n\n`;
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

          header += `TAGS: ${tags.join(', ')}.\n\n`;

        }


        let docs = await textSplitter.splitDocuments([
          new Document({
            pageContent: textContent,
            metadata: {
              url: page.url,
              file: nombre,
              title: page.title,
            },
          }),
        ]);




        docs.forEach((doc) => {

          doc.pageContent = header + doc.pageContent;
          doc.metadata = {
            ...doc.metadata,
            client: nameClient,
            file: nombre,
            url: page.url
          }

        }

        );

        return docs;

      }));

      return documents;
    } catch (error) {
      console.error('PIla errores', error);
      console.error("Error in createDocumtUrlCrawler:", error.message);

      // emito el error al cliente

      // @ts-ignore
      strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', {
        type: 'error',
        message: `Error en la tarea: ${error.message}`,
      });

      // actualizo base de datos

      await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({

        where: { id: this.groupIncrust },

        data: { queueState: 'error', error: error.message },

      });

      throw new Error(`Failed to create documents from URLs: ${error.message}`);
    }
  }


  async readUrlsFromTxt(file) {
    try {
      const currentDirectory = __dirname;
      const parentDirectory = path.join(currentDirectory, '../..');
      const relativePath = "public" + file.url;
      const absolutePath = path.join(parentDirectory, relativePath);

      const data = await fs.promises.readFile(absolutePath, 'utf8');
      const array = data.toString().split("\n");

      let urls = array
        .map(url => url.trim())
        .filter(url => url); // Filtra cualquier string vacío o no válido

      return urls;
    } catch (error) {

      //@ts-ignore
      strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', {
        type: 'error',
        message: `Error en la tarea: ${error.message}`,
      });

      // actualizo base de datos

      await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({

        where: { id: this.groupIncrust },

        data: { queueState: 'error', error: error.message },

      });

      console.error("Error reading URLs from txt file:", error.message);
      throw new Error(`Failed to read URLs from file: ${file.url}`);
    }
  }

}

module.exports = DocumentURLQueue;
