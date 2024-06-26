'use strict';

/**
	* infobase controller
	*/

const { createCoreController } = require('@strapi/strapi').factories;
const DocumentQueue = require("../../../../util/queue/files-queue.js");
const Promise	= require('bluebird');
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
	process.env.URL + '/api/users/drive/oauth2callback'
);

function isUUID(str) {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(str);
}

function isInteger(str) {
	const num = parseInt(str, 10);
	return Number.isInteger(num);
}

function checkString(str) {
	if (isUUID(str)) {
		return 'UUID';
	} else if (isInteger(str)) {
		return 'Integer';
	} else {
		return 'Neither';
	}
}
async function getFolderName(folderId, drive) {
	try {
			const response = await drive.files.get({
					fileId: folderId,
					fields: 'id, name',
			});
			return response.data.name;
	} catch (error) {
			console.error('Error getting folder name:', error);
			return null;
	}
}

async function getTotalItemsInFolder(folderId, drive) {
	try {
			const response = await drive.files.list({
					q: `'${folderId}' in parents and trashed = false`,
					fields: 'files(id)',
					pageSize: 1000
			});

			let totalItems = response.data.files.length;
			let nextPageToken = response.data.nextPageToken;

			while (nextPageToken) {
					const nextPageResponse = await drive.files.list({
							q: `'${folderId}' in parents and trashed = false`,
							fields: 'files(id)',
							pageSize: 1000,
							pageToken: nextPageToken
					});
					totalItems += nextPageResponse.data.files.length;
					nextPageToken = nextPageResponse.data.nextPageToken;
			}

			return totalItems;
	} catch (error) {
			console.error('Error getting total items:', error);
			return 0;
	}
}
module.exports = createCoreController('api::grupo-de-incrustacion.grupo-de-incrustacion', ({ strapi }) => ({


	async findInfobase(ctx) {
		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		let { _limit, _page, _sort, _q, _client, _isMe, _type, _isInfobase, _state, _databaseType, _parent } = ctx.query;



		_limit = parseInt(_limit) || 10;
		_page = parseInt(_page) || 1;
		_sort = _sort || 'createdAt:desc';
		_q = _q || '';


		// verifico si _client es un uuid o un id de cliente, ya que si es uuid debo buscar el id del cliente


		if (_client) {

			let type = checkString(_client);

			if (type == 'UUID') {

				let client = await strapi.db.query("api::client.client").findOne({

					where: {

						uuid: _client

					}

				});

				_client = client.id;

				ctx.query._client = _client;

			}


		}

		if (_client== 'null') {
				
			_client = null;

			ctx.query._client = _client;
		}





		if (_databaseType === 'googleDrive') {
			return await this.searchInGoogleDrive(ctx, user, _limit, _page, _q, _parent);
		} else {
			return await this.searchInDatabase(ctx, user, { _limit, _page, _sort, _q, _client, _isMe, _type, _isInfobase, _state });
		}
	},


	// Función para buscar en Google Drive
	async searchInGoogleDrive(ctx, user, _limit, _page, _q, folderId = 'root') {
		try {
				const googleTokens = await strapi.db.query("api::user-google-token.user-google-token").findOne({
						where: { user: user.id },
				});

				if (!googleTokens) {
						return ctx.badRequest("Error", { error: true, message: "Tokens de Google no encontrados" });
				}

	
				oauth2Client.setCredentials({
						access_token: googleTokens.access_token,
						refresh_token: googleTokens.refresh_token,
						expiry_date: googleTokens.expiry_date,
				});

				const drive = google.drive({ version: 'v3', auth: oauth2Client });

				// Obtener el total de ítems en la carpeta
				const totalItems = await getTotalItemsInFolder(folderId, drive);
				console.log(`Total items in folder: ${totalItems}`);

				let query = `'${folderId}' in parents and trashed = false`;
				if (_q) {
						query += ` and name contains '${_q}'`;
				}
				let pageToken = ctx.query._pageToken || null;

				
				let params = {
					supportsAllDrives	: true,
					q: query,
					pageSize: _limit,
					fields: 'nextPageToken, files(id, name, mimeType, parents)'
			};
			if (pageToken && pageToken !== 'null') {
					params.pageToken = pageToken;
			}

			const response = await drive.files.list(params);


				const files = response.data.files;
				const nextPageToken = response.data.nextPageToken;
				if (!files || files.length === 0) {
						return ctx.send({ data: [], meta: { pagination: { page: _page, limit: _limit, total: 0, lastPage: 1 } } });
				}

				// Obtener los nombres de las carpetas parent
				for (let file of files) {
						if (file.parents && file.parents.length > 0) {
								// @ts-ignore
								file.parentNames = await Promise.all(file.parents.map(parentId => getFolderName(parentId, drive)));
						}
				}

				const totalFiles = totalItems;
				const _lastPage = Math.ceil(totalFiles / _limit);

				return ctx.send({ data: files, meta: { pagination: { page: _page, limit: _limit, total: totalFiles, lastPage: _lastPage,prevPageToken: pageToken , nextPageToken } } });

		} catch (error) {
				console.error("Google Drive Error:", error);
				return ctx.badRequest("Error", { error: true, message: error.message });
		}
},


	// Función para buscar en la base de datos actual
	async searchInDatabase(ctx, user, queryParams) {
		const { _limit, _page, _sort, _q, _client, _isMe, _type, _isInfobase, _state } = queryParams;

		let where = { queueState: "completed" };

		if (_client) where.client = _client;
		if (_type) where.type = _type;
		if (_isMe == true) where.create = user.id;
		if (_isInfobase == true) where.infobase = _isInfobase;
		if (_state) where.queueState = _state;
		if (_q) where.title = { $containsi: _q };

		const _offset = (_page - 1) * _limit;

		try {
			const [items, total] = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findWithCount({
				limit: _limit,
				offset: _offset,
				where: where,
				sort: _sort,
				populate: ["media", "client", "create", "tags"]
			});

			items.forEach(element => {
				element.create = element.create?.name ? `${element.create?.name} ${element.create?.lastName}` : element.create?.email;
			});

			const _lastPage = Math.ceil(total / _limit);

			return ctx.send({ data: items, meta: { pagination: { page: _page, limit: _limit, total, lastPage: _lastPage } } });

		} catch (error) {
			console.error(error);
			return ctx.badRequest("Error", { error: true, message: error.message });
		}
	},
	async findOneInfobase(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		let { uuid } = ctx.params;



		let where = {
			uuid
		};


		// Realiza la consulta con las condiciones acumuladas en 'where'
		let _item = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findOne({
			where: where,
			populate: ["media", "client", "tags"]
		});



		console.log(_item.tags)
		if (_item.tags && _item.tags.length > 0) {

			_item.tags = _item.tags.map(tag => tag.title);

		}


		console.log(_item.tags)



		return ctx.send({ data: _item, meta: {} });
	},
	async updateInfobase(ctx) {

		const { uuid } = ctx.params;

		let { title, client, state, tags } = ctx.request.body;

		client = await await strapi.db.query("api::client.client").findOne({
			where: {
				uuid: client
			}
		});
		console.log("tags", tags)

		tags = await this.procesarTags(tags);


		let grupoIns = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findOne({
			where: {
				uuid
			}
		});

		console.log("tags", tags)

		await strapi.entityService.update('api::grupo-de-incrustacion.grupo-de-incrustacion', grupoIns.id, {
			data: {
				title,
				client: client?.id,
				tags: tags,
				isTag: tags && tags.length > 0 ? true : false
			},
		});



		if (state != "completed") {

			const grupoIncrustacion = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findOne({
				where: {
					uuid: uuid
				},

				populate: true

			});
			if (!grupoIncrustacion || grupoIncrustacion.media == null) {

				return ctx.badRequest("Grupo de incrustacion no encontrado");

			}



			// elimino todas las incrustaciones actuales


			await strapi.db.query("api::document.document").deleteMany({
				where: {
					grupoIncrustacion: {
						$eq: grupoIncrustacion.id,
					},
				},
			});

			this.procesarYSubirDocumento(grupoIncrustacion.id, title, grupoIncrustacion.media, client, ctx.state.user);


		}





		return ctx.send({ data: uuid });


	},

	async procesarTags(tags) {
		if (tags && tags.length > 0) {

			let arrayTags = [];
			for (let tagName of tags) {
				let existingTag = await strapi.db.query("api::tag.tag").findOne({
					where: { title: tagName }
				});

				if (!existingTag) {
					// Crear el tag si no existe
					existingTag = await strapi.db.query("api::tag.tag").create({
						data: { title: tagName }
					});
				}


				arrayTags.push(existingTag.id);


			}


			return arrayTags;

		}
	},

	async procesarYSubirDocumento(grupoIncrustacion, nombreFile, file, clienteEmpresa, user) {

		try {


			const documentQueue = new DocumentQueue(
				user, grupoIncrustacion
			);

			strapi.log.debug(documentQueue)
			strapi.log.debug("grupoIncrustacion al llamar la funcion")
			strapi.log.debug(grupoIncrustacion)


			documentQueue.addDocumentToQueue({ infobase: true, nombreFile, clienteEmpresa, user, grupoIncrustacion, file });
		} catch (error) {

			strapi.log.debug(error)
			return error.message;


		}



	},




	async updateInfobaseCron(ctx) {

		let grupos_incrustacion = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findMany({
			limit: 1000,
		});



		for (let grupoIncrustacion of grupos_incrustacion) {


			await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").update({
				where: {
					id: grupoIncrustacion.id
				},
				data: {

					isTag: false

				}

			});


		}


		return ctx.send({ data: "ok" });


	},
 

	async incrustarDedeDrive(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		// si se manda un uuid entonces es actualizar si no es crear

		let { title, client, idDrive, tags,  uuid  } = ctx.request.body;

		console.log("tags", ctx.request.body)
		if (!idDrive) {
			return ctx.badRequest("Faltan datos");
		}


		/// obtengo el arcivo	de google drive


		const googleTokens = await strapi.db.query("api::user-google-token.user-google-token").findOne({
			where: { user: user.id },
		});

		if (!googleTokens) {
			return ctx.badRequest("Error", { error: true, message: "Tokens de Google no encontrados" });
		}


		oauth2Client.setCredentials({
			access_token: googleTokens.access_token,
			refresh_token: googleTokens.refresh_token,
			expiry_date: googleTokens.expiry_date,
		});

		const drive = google.drive({ version: 'v3', auth: oauth2Client });

		const file = await drive.files.get({
			fileId: idDrive,
			fields: 'id, name, mimeType, parents',
		});

		console.log(file)

		let mimeType = file.data.mimeType;

		// el archivo debe ser pdf, word o excel

		if (mimeType != "application/pdf" && mimeType != "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && mimeType != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {

			return ctx.badRequest("El archivo no es valido");

		}

		// obtengo el cliente

		client = await strapi.db.query("api::client.client").findOne({
			where: {
				uuid: client
			}
		});


		// obtengo el archivo


		const fileStream = await drive.files.get({
			fileId: idDrive,
			alt: 'media',
		}, { responseType: 'stream' });

		// obtengo el nombre del archivo

		let nombreFile = file.data.name;

		// obtengo el tamaño del archivo

		let size = file.data.size;

		// obtengo el tipo de archivo

		let type = file.data.mimeType;

		// obtengo el id del archivo

		let id = file.data.id;

		// SUBO EL ARCHIVO A STRAPI

		// GENERO EL GRUPO DE INCRUSTACION


		if (uuid) {

			let grupoIncrustacion = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findOne({
				where: {
					uuid
				}
			});

			if (!grupoIncrustacion) {

				return ctx.badRequest("Grupo de incrustacion no encontrado");

			}

			await strapi.entityService.update('api::grupo-de-incrustacion.grupo-de-incrustacion', grupoIncrustacion.id, {
				data: {
					title,
					client: client?.id,
					media: {
						id: id,
						name: nombreFile,
						size,
						type
					},
					isTag: tags && tags.length > 0 ? true : false,
					tags: tags
				},
			});

			return ctx.send({ data: uuid });

		}	else {

			let grupoIncrustacion = await strapi.entityService.create('api::grupo-de-incrustacion.grupo-de-incrustacion', {
				title,
				client: client?.id,
				media: {
					id: id,
					name: nombreFile,
					size,
					type
				},
				isTag: tags && tags.length > 0 ? true : false,
				tags: tags
			});

			return ctx.send({ data: grupoIncrustacion.uuid });

		}


		//retorno para ver como funciona la funcion

		 return ctx.send({ data: fileStream.data });

	}









 





}));
