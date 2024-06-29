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

			if (!grupoIncrustacion) {

				grupoIncrustacion = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').create(
					{

						data: {
							title: nombreFile,
							client: clienteEmpresa.id,
							create: user.id,
							queueState: "waiting"
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



			await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({
				where: { id: grupoIncrustacion.id },
				data: { queueState: "waiting", inQueue: true }});

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
				url :  imagenIN.url,
				uuid : uuid(),
				creator: user.id,
				title: nombreFile,
				grupoIncrustacion: grupoIncrustacion.id,
				fileRelation: {
					id: imagenIN.id,
					type: 'api::document.document',
					field: 'media'
				},
			}



		try {
			await SupabaseVectorStoreCustom.fromDocuments(
				docs,
				embading,
				dbConfig,
			);
		} catch (error) {
			await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({
				where: { id: grupoIncrustacion.id },
				data: { queueState: "error", inQueue: false }
		});
		strapi.log.debug(error);
			return ctx.badRequest("Error", { message: error });
			 
		}


		await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({
			where: { id: grupoIncrustacion.id },
			data: { queueState: "completed", inQueue: false }
	});
			return ctx.send({ message: 'File uploaded' });
		} catch (error) {

		
			strapi.log.debug(error)

		}



	},

	async uploadUrlEmbadding(ctx) {
  try {
    const { user } = ctx.state;
    if (!user) return ctx.unauthorized("Unauthorized", { message: 'Unauthorized' });

    // Emit message to user
    strapi.io.in(`user_${user.uuid}`).emit('messageTaskSchedule', { message: `Se encontraron urls` });

    let { recursivity, summarize, cleanHtml, puppeteer, client, type, url } = ctx.request.body;
    let file = ctx.request.files ? ctx.request.files.file : null;

    console.log(ctx.request.body);

    // Parse boolean values
    recursivity = this.parseBoolean(recursivity);
    summarize = this.parseBoolean(summarize);
    cleanHtml = this.parseBoolean(cleanHtml);
    puppeteer = this.parseBoolean(puppeteer);

    if (!url && !file) return ctx.badRequest("Url or file required", { message: 'Url or file required' });

    const clienteEmpresa = await this.getClient(client);
    if (!clienteEmpresa) return ctx.badRequest("Client not found", { message: 'Client not found' });

    let nombreFile = this.getFileName(file, url);
    let fileNameNoExt = `${uuid()}_${this.sanitizeFileName(nombreFile)}`;

    let grupoIncrustacion = await this.getOrCreateGrupoIncrustacion(clienteEmpresa, nombreFile, user.id, url, type);
    if (!grupoIncrustacion) {
      return ctx.badRequest("Group creation failed", { message: 'Group creation failed' });
    }

    if (file) {
      await this.processFile(file, fileNameNoExt, grupoIncrustacion.id);
    }
					console.log(user, grupoIncrustacion.id);
    const documentQueue = new DocumentSitemapQueue(user, grupoIncrustacion.id);
    if (type === 'txt') {
      url = file;
    }

    documentQueue.addDocumentToQueue({
      urlOrTxt: url, nombreFile, clienteEmpresa, summarize, cleanHtml, puppeteer,
      user, grupoIncrustacion, filterUrl: [], blocksize: 0, blocknum: 0,
      minLenChar: 200, recursivity, type
    });

			

    return ctx.send({ message: 'File uploaded' });
  } catch (error) {
    console.log(error);  }
},

// Helper functions
parseBoolean(value) {
  return value === 'true' ? true : false;
},

async getClient(clientUuid) {
  return await strapi.db.query('api::client.client').findOne({
    where: { uuid: clientUuid },
    select: ['id', 'name']
  });
},

getFileName(file, url) {
  return file ? file.name.split('.')[0] :  this.getFileNameFromUrl(url);
},
getFileNameFromUrl(url) {
	// Crear un objeto URL a partir de la cadena de URL
	const urlObj = new URL(url);
console.log(urlObj);
	// Obtener el path de la URL y eliminar la primera barra
let path = urlObj.pathname.slice(1).trim();

if (path == '' || path == '/') {


	path = urlObj.hostname;

	return	path;
}
	// Dividir el path en segmentos
	const segmentos = path.split('/');

	console.log(segmentos);
	let nombreConGuiones = segmentos[segmentos.length - 1];

	if (nombreConGuiones == '' && segmentos.length > 1) {
		nombreConGuiones = segmentos[segmentos.length - 2];
	}


	// Reemplazar los guiones con espacios
	const nombreConEspacios = nombreConGuiones.replace(/-/g, ' ');


	return nombreConEspacios;
},
sanitizeFileName(fileName) {
  return fileName.trim().replace(/[*+~.()'"!:@]/g, '').replace(/[_-]/g, ' ');
},

async getOrCreateGrupoIncrustacion(clienteEmpresa, nombreFile, userId, url, type) {
  let grupoIncrustacion = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').findOne({
    where: { client: clienteEmpresa.id, title: nombreFile, create: userId },
    select: ['id']
  });

  if (!grupoIncrustacion) {
    let data = { title: nombreFile, client: clienteEmpresa.id, create: userId };
    if (url) {
      data.remote_url = url;
    }
    grupoIncrustacion = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').create({
      data: { ...data, type }
    });
  }

  return grupoIncrustacion;
},

async processFile(file, fileNameNoExt, grupoIncrustacionId) {
  const buffer = await fs.promises.readFile(file.path);

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
      id: grupoIncrustacionId,
      __type: 'api::grupo-de-incrustacion.grupo-de-incrustacion',
      __pivot: { field: 'media' }
    }
  };

  await strapi.plugin('upload').service('upload').uploadFileAndPersist(entity);
  await strapi.query("plugin::upload.file").create({ data: entity });
},

	async createDocumtUrlIndividual(textSplitter, nombre, url, mode = 'cheerio', nameClient = null) {

		try {

			let loader = null;
			strapi.log.debug(mode);
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
			strapi.log.debug(error);
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

				strapi.log.debug('Formato no soportado');

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
			strapi.log.debug(error);
		}



	},

}));
