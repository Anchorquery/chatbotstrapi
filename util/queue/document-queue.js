const Queue = require('bull');
const { SiteMapLoader } = require("../../util/crawlers/site-map-loader.js");
const { convert } = require('html-to-text');
const { Crawler } = require('../crawlers/crawler.js');
const { Document } = require("langchain/document");
const { summarizeLongDocument } = require('../summarizer.js');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const SupabaseVectorStoreCustom = require('../supabase.js');
const clientS = require('../../util/superbase-client.js');
const Promise = require('bluebird');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const chunkSize = 1000;
const chunkOverlap = 200;
const textSplitter = new RecursiveCharacterTextSplitter({
	chunkSize: chunkSize,
	chunkOverlap: chunkOverlap,
});
const embading = new OpenAIEmbeddings({
	openAIApiKey: process.env.OPENAI_API_KEY,
	//batchSize: 300,
	modelName: 'text-embedding-ada-002',

}

);
const dbConfig = {
	client: clientS,
	tableName: 'documents',
	query_name: 'match_documents_2',
};
module.exports = class DocumentSitemapQueue {
	constructor(user, groupIncrust) {
		this.user = user;
		this.groupIncrust = groupIncrust;
		//	this.progress = 0;
		this.queue = new Queue('document-queue', {
			redis: process.env.REDIS_URL,
			limiter: {
				max: 2,
				duration: 1000
			}
		}
		);
		// add a worker
		this.queue.process('document-queue', job => {
			console.log('processing document-queue', user);
			this.processDocument(job)
		})

		this.queue.on('waiting', function (jobId) {

			// @ts-ignore
			strapi.io.in(`user_${user.uuid}`).emit('messageTaskSchedule', { type: 'waiting', message: `Tarea en espera` });
			strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({

				where: {

					id: groupIncrust

				},
				data: {
					queueState: 'waiting',
					inQueue: true
				}

			});
		});
		// @ts-ignore
		this.queue.on('active', function (job, jobPromise) {
			console.log(`A job with ID ${job.id} is active`);


			// @ts-ignore
			strapi.io.in(`user_${user.uuid}`).emit('messageTaskSchedule', { type: 'active', message: `Tarea en proceso` });

			strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({

				where: {

					id: groupIncrust

				},
				data: {
					queueState: 'active',
					inQueue: true
				}

			});
		});
		// @ts-ignore
		this.queue.on('completed', function (job, result) {
			console.log(`A job with ID ${job.id} has been completed`);

			// @ts-ignore
			strapi.io.in(`user_${user.uuid}`).emit('messageTaskSchedule', { type: 'completed', message: `Tarea completada` });

			strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({

				where: {

					id: groupIncrust

				},
				data: {
					queueState: 'completed',
					inQueue: false
				}

			});
		});
		this.queue.on('failed', function (job, err) {
			console.log(`A job with ID ${job.id} has failed with ${err.message}`);
		});
		this.queue.on('error', function (error) {
			console.log(`Queue error: ${error}`);
			console.log(`Queue error: ${error.message}`);

		});
		this.queue.on('removed', function (job) {
			console.log(`Job ${job.id} has been removed.`);
		});

		this.queue.on('progress', function (job, progress) {
			// @ts-ignore
			strapi.io.in(`user_${user.uuid}`).emit('messageTaskSchedule', { type: 'progress', message: `Tarea en proceso`, progress: progress });
		})


	}

	addDocumentToQueue(data) {
		this.queue.add('document-queue', data)
	}
	async processDocument(job) {
		const { urlOrTxt, nombreFile, clienteEmpresa, summarize, cleanHtml, puppeteer, user, grupoIncrustacion, filterUrl = [], blocksize = 0, blocknum = 0, minLenChar = 200, recursivity = false, type = 'sitemap' } = job.data;
		try {
			let urls = [];
			let limit = 0;
			if (type == 'sitemap') {
				// mando el mensaje de analizando sitemap
				// @ts-ignore
				strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', { type: 'message', message: `Analizando sitemap` });
				const sitemapLoader = new SiteMapLoader(urlOrTxt, filterUrl, blocksize, blocknum, minLenChar);
				urls = await Promise.resolve(sitemapLoader.load());

				// envio un mensaje con las urls encontradas
				// @ts-ignore
				strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', { type: 'message', message: `Se encontraron ${urls.length} urls` });
			} else if (type == 'individual') {

				urls = [urlOrTxt];
				// @ts-ignore
				strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', { type: 'message', message: `Analizando Url` });

				if (recursivity == 'true' || recursivity == true) {
					limit = 50;
				}



			} else if (type == 'txt') {

				urls = await Promise.resolve(this.readUrlsFromTxt(urlOrTxt));

				// @ts-ignore
				strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', { type: 'message', message: `Se encontraron ${urls.length} urls en el txt` });

			}

			// si no hay	urls, terminar
			if (urls.length == 0) {

				job.moveToCompleted('done', true)
				return;
			}


			let docs = await Promise.resolve(this.createDocumtUrlCrawler(nombreFile, urls, clienteEmpresa.name, { limit: limit, summarize: summarize, cleanHtml: cleanHtml, puppeteer: puppeteer }));

			dbConfig.extraData = {
				custom: true,
				client: clienteEmpresa.id,
				type: "url",
				creator: user.id,
				title: nombreFile ? nombreFile : urls.length == 1 ? urls[0] : 'Varios documentos',
				grupoIncrustacion: grupoIncrustacion.id,

			}

			await Promise.resolve(this.processDocs(job, docs, embading, dbConfig));


			job.moveToCompleted('done', true)
		} catch (error) {
			if (error.response) {
				job.moveToFailed({ message: 'job failed' })
			}
		}
	}
	async processDocs(job, docs, embading, dbConfig) {
		try {
			// @ts-ignore
			strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', { type: 'message', message: `Tarea en proceso, ${docs.length} documentos fueron encontrados, iniciando incrustación` });
			const totalTasks = docs.length;
			let completedTasks = 0;

			await Promise.map(docs, async (doc) => {

				completedTasks++;

				// Calcula el progreso global
				const progress = (completedTasks / totalTasks) * 100;


				job.progress(progress);






				try {
					await SupabaseVectorStoreCustom.fromDocuments(doc, embading, dbConfig);
				} catch (error) {
					console.log(error);
				}
				
			}, { concurrency: 5 }); // Puedes ajustar la cantidad de promesas en paralelo (en este caso, 5)

			console.log('Todas las promesas se han completado con éxito.');

			// @ts-ignore
			strapi.io.in(`user_${this.user.uuid}`).emit('messageTaskSchedule', { type: 'end', message: `Tarea finalizada, ${totalTasks} documentos fueron insertados` });



			await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({

				where: {

					id: this.groupIncrust

				},
				data: {
					queueState: 'finalizado'
				}

			});

		} catch (error) {
			// lanzo un error

			console.error('Ocurrió un error al procesar las promesas:', error.message );
		}
	}
	// @ts-ignore
	async createDocumtUrlCrawler(nombre, urls, nameClient = null, { limit = 0, summarize = false, cleanHtml = false, puppeteer = false } = {}) {

		try {
			if (typeof urls == 'string') {

				urls = [urls];


			}


			const shouldSummarize = summarize === true;
			const crawler = new Crawler(urls, limit, 1);
			const pages = await Promise.resolve(crawler.start());




			const options = {

				// Extrae solo texto y elimina etiquetas HTML
				ignoreImage: true,  // Ignora las etiquetas de imagen
				noLinkBrackets: true,  // Elimina los corchetes de enlaces
				uppercaseHeadings: false,  // No convierte los encabezados a mayúsculas
				ignoreHref: true,  // Ignora los enlaces (URL)
				ignoreAnchor: true,  // Ignora las anclas (nombres de enlaces)
				tables: true,  // Procesa tablas y extrae su contenido

			};



			const documents = await Promise.all(pages.map(async row => {

				if (cleanHtml) {

					row.text = convert(row.text, options);
				}


				let pageContent = shouldSummarize

					// @ts-ignore
					? await summarizeLongDocument({ document: row.text, forceSummarize: true })
					: row.text;

				if (!shouldSummarize) {
					row.text = convert(row.text, options);
				}


				let chuckHeader = `DOCUMENT NAME: ${row.title} . \n \n`;

				if (nameClient) {

					chuckHeader += `PROPERTY DOCUMENT: ${nameClient} .\n \n`;

				}


				pageContent = chuckHeader + pageContent;


				const docs = textSplitter.splitDocuments([
					new Document({ pageContent, metadata: { url: row.url, file: nombre, title: row.title /*text: this.truncateStringByBytes(pageContent, 36000)*/ } }),
				]);
				return docs;
			}));

			return documents;

		} catch (error) {
			// lanzo un error


			console.log(error);



			throw new Error(error);
		}
	}

	async readUrlsFromTxt(file) {

		try {

			const currentDirectory = __dirname;

			// Navegar atrás cuatro directorios
			const parentDirectory = path.join(currentDirectory, '../..');

			// Parte relativa de la URL
			const relativePath = "public" + file.url;

			// Combinar la ubicación del archivo con la parte relativa
			const absolutePath = path.join(parentDirectory, relativePath);

			const data = await fs.promises.readFile(absolutePath, 'utf8');

			const array = data.toString().split("\n");

			let urls = [];

			// corto 

			for (let i in array) {

				let url = array[i].trim();

				if (url) {

					urls.push(url);

				}

			}

			return urls;

		} catch (error) {
			console.log(error);
		}

	}




}

