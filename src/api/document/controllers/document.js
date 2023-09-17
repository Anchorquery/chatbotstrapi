'use strict';

/**
	* document controller
	*/
const { Readable } = require("stream");
const path = require('path');
const { v4: uuid } = require('uuid');
const os = require('os');
const fse = require('fs-extra');
const { createCoreController } = require('@strapi/strapi').factories;
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const clientS = require('../../../../util/superbase-client.js');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { CSVLoader } = require('langchain/document_loaders/fs/csv');
const { DocxLoader } = require('langchain/document_loaders/fs/docx');
const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
const { TextLoader } = require('langchain/document_loaders/fs/text');
const slugify = require('slugify').default;
const SupabaseVectorStoreCustom = require("../../../../util/supabase.js");
const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");
const { PuppeteerWebBaseLoader } = require("langchain/document_loaders/web/puppeteer");
const Promise = require('bluebird'); 
const fs = Promise.promisifyAll(require('fs'));
const chunkSize = 5000;
const chunkOverlap = 500;
const textSplitter = new RecursiveCharacterTextSplitter({
	chunkSize: chunkSize,
	chunkOverlap: chunkOverlap,
});

const DocumentSitemapQueue = require("../../../../util/queue/document-queue.js");
module.exports = createCoreController('api::document.document', ({ strapi }) => ({


	async uploadEmbadding(ctx) {
		try {
			const { user } = ctx.state;

			if (!user) return ctx.unauthorized("Unauthorized", { message: 'Unauthorized' });


			const { files: file } = ctx.request.files;


			const { client, type, folder } = ctx.request.body;
			if (!file) return ctx.badRequest("File required", { message: 'File required' });

			const dbConfig = {
				client: clientS,
				tableName: 'documents',
				query_name: 'match_documents_2',
			};
			let buffer = await fs.promises.readFile(file.path);

			// busco el cliente 

			let clienteEmpresa = await strapi.db.query('api::client.client').findOne(

				{
					where: {
						uuid: client
					},
					select: ['id', 'name']
				}

			);



			if (!clienteEmpresa) return ctx.badRequest("Client not found", { message: 'Client not found' });

			let nombreFile = file.name.split('.')[0];



			// elimino caracteres especiales , _ y - del nombre

			nombreFile = nombreFile.trim().replace(/[*+~.()'"!:@]/g, '').replace(/[_-]/g, ' ');




			let grupoIncrustacion = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').findOne(

				{
					where: {
						client: clienteEmpresa.id,
						title: nombreFile,
						create: user.id
					},
					select: ['id']
				}

			);

			/*if (grupoIncrustacion) return ctx.badRequest("Group not found", { message: 'Un archivo bajo este nombre, cliente y generado por ti ya fue incrustado' });*/

			if (!grupoIncrustacion) {

				grupoIncrustacion = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').create(
					{

						data: {
							title: nombreFile,
							client: clienteEmpresa.id,
							create: user.id,
						}

					}
				);

			}

			let fileNameNoExt = uuid() + '_' + nombreFile;

			const createAndAssignTmpWorkingDirectoryToFiles = () => fse.mkdtemp(path.join(os.tmpdir(), 'strapi-upload-'));

			const entity = {
				name: `${file.name}`,
				hash: fileNameNoExt,
				ext: path.extname(file.name),
				mime: file.type,
				size: this.convbyteToKB(file.size),
				provider: 'local',
				tmpWorkingDirectory: await createAndAssignTmpWorkingDirectoryToFiles(),
				getStream: () => Readable.from(buffer),
				folderPath: '/1',
				related: {
					id: grupoIncrustacion.id,
					__type: 'api::grupo-de-incrustacion.grupo-de-incrustacion',
					__pivot: { field: 'media' }
				}

			};





			await strapi.plugin('upload').service('upload').uploadFileAndPersist(entity)


			const imagenIN = await strapi
				.query("plugin::upload.file")
				.create({ data: entity });

			const embading = new OpenAIEmbeddings(

				{
					openAIApiKey: process.env.OPENAI_API_KEY,
					batchSize: 300,
					modelName: 'text-embedding-ada-002',

				}

			);



			let docs = await this.createDocumt(nombreFile, imagenIN, textSplitter, clienteEmpresa.name);



			dbConfig.extraData = {
				custom: true,
				client: clienteEmpresa.id,
				type: "file",
				creator: user.id,
				title: nombreFile,
				grupoIncrustacion: grupoIncrustacion.id,
				fileRelation: {
					id: imagenIN.id,
					type: 'api::document.document',
					field: 'media'
				},
			}




			await SupabaseVectorStoreCustom.fromDocuments(
				docs,
				embading,
				dbConfig,
			);


			return ctx.send({ message: 'File uploaded' });
		} catch (error) {
			console.log(error)

		}



	},

	async uploadUrlEmbadding(ctx) {

		try {

			const { user } = ctx.state;

			if (!user) return ctx.unauthorized("Unauthorized", { message: 'Unauthorized' });

			// saco el archivo de la url

			// @ts-ignore
			strapi.io.in(`user_${user.uuid}`).emit('messageTaskSchedule', { message: `Se encontraron  urls` });

			let { recursivity,summarize, cleanHtml, puppeteer,  client, type, url } = ctx.request.body;

			let file;

			if (ctx.request.files) {

				file = ctx.request.files.file;


			}


			recursivity = recursivity == 'true' ? true : false;

			summarize = summarize == 'true' ? true : false;

			cleanHtml = cleanHtml == 'true' ? true : false;

			puppeteer = puppeteer == 'true' ? true : false;



			if (!url && !file) return ctx.badRequest("Url or file required", { message: 'Url or file required' });


			const dbConfig = {
				client: clientS,
				tableName: 'documents',
				query_name: 'match_documents_2',
			};


			// busco el cliente 

			let clienteEmpresa = await strapi.db.query('api::client.client').findOne(

				{
					where: {
						uuid: client,
						user: user.id
					},
					select: ['id', 'name']
				}

			);



			let nombreFile = file ? file.name.split('.')[0] : url.split('/').pop().split('#')[0].split('?')[0];


			nombreFile = nombreFile.trim().replace(/[*+~.()'"!:@]/g, '').replace(/[_-]/g, ' ');
			let fileNameNoExt = uuid() + '_' + nombreFile;

			if (!clienteEmpresa) return ctx.badRequest("Client not found", { message: 'Client not found' });

			let grupoIncrustacion = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').findOne(

				{
					where: {
						client: clienteEmpresa.id,
						title: nombreFile,
						create: user.id
					},
					select: ['id']
				}

			);

			/*if (grupoIncrustacion) return ctx.badRequest("Group not found", { message: 'Un archivo bajo este nombre, cliente y generado por ti ya fue incrustado' });*/

			if (!grupoIncrustacion) {

				grupoIncrustacion = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').create(
					{

						data: {
							title: nombreFile,
							client: clienteEmpresa.id,
							create: user.id,
						}

					}
				);

			}

			let buffer = null;
			if (file) {
				buffer = await fs.promises.readFile(file.path);



				const createAndAssignTmpWorkingDirectoryToFiles = () => fse.mkdtemp(path.join(os.tmpdir(), 'strapi-upload-'));

				const entity = {
					name: `${file.name}`,
					hash: fileNameNoExt,
					ext: path.extname(file.name),
					mime: file.type,
					size: this.convbyteToKB(file.size),
					provider: 'local',
					tmpWorkingDirectory: await createAndAssignTmpWorkingDirectoryToFiles(),
					getStream: () => Readable.from(buffer),
					folderPath: '/1',
					related: {
						id: grupoIncrustacion.id,
						__type: 'api::grupo-de-incrustacion.grupo-de-incrustacion',
						__pivot: { field: 'media' }
					}

				};





				await strapi.plugin('upload').service('upload').uploadFileAndPersist(entity)


				file = await strapi
					.query("plugin::upload.file")
					.create({ data: entity });



			}
			const documentQueue = new DocumentSitemapQueue(
				user,grupoIncrustacion.id
				);

			if (type == 'txt') {
				
				url = file;


			}
		



			documentQueue.addDocumentToQueue( { urlOrTxt:url,nombreFile,clienteEmpresa,summarize,cleanHtml,puppeteer,user, grupoIncrustacion, filterUrl : [], blocksize : 0 , blocknum : 0, minLenChar : 200,recursivity:recursivity, type: type  } );





			return ctx.send({ message: 'File uploaded' });



		} catch (error) {
			console.log(error)
			// lanzo el error


		}


	},
	async createDocumtUrlIndividual(textSplitter, nombre, url, mode = 'cheerio', nameClient = null) {

		try {

			let loader = null;
			console.log(mode);
			if (mode == 'cheerio') {

				loader = new CheerioWebBaseLoader(url);

			} else {



				loader = new PuppeteerWebBaseLoader(url, {
					launchOptions: {
						headless: true,
						args: ['--no-sandbox', '--disable-setuid-sandbox'],
						timeout: 0,

					},

					gotoOptions: {
						waitUntil: "domcontentloaded",
					},

				});

			}




			const docs = await loader.loadAndSplit(textSplitter);

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
				}
			});

			return docs;

		} catch (error) {
			console.log(error);
		}

	},


	convbyteToKB(bytes) {

		return bytes / 1024;

	},


	async createDocumt(nombre, file, textSplitter, nameClient = null) {

		try {
			const currentDirectory = __dirname;

			// Navegar atrás cuatro directorios
			const parentDirectory = path.join(currentDirectory, '../../../..');

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
				}

			}

			);





			return docs;

		} catch (error) {
			console.log(error);
		}



	},







}));
