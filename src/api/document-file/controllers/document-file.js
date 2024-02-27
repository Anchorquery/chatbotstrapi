'use strict';

/**
	* document-file controller
	*/
const showdown = require('showdown');
const client = require('../../client/controllers/client');

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::document-file.document-file', ({ strapi }) => ({

	async create(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		let { title, content, folder } = ctx.request.body.data;


		title = title ? title : 'Sin titulo';


		// si se manda folder, verifico exista y pertenezca al usuario

		let folderR;

		if (folder) {

			folderR = await strapi.db.query('api::document-file.document-file').findOne({
				where: {
					uuid: folder,
				//	create: user.id
				}


			});


			if (!folderR) return ctx.badRequest("folder not found or not belong to user", { error: 'La carpeta no existe o no pertenece al usuario' });
		}


		if(folderR){
			 if(!folderR.isFolder && folderR.typeFolder == "not_folder") return ctx.badRequest("folder is not a folder", { error: 'La carpeta no es una carpeta' });
		}

		let document = await strapi.db.query('api::document-file.document-file').create({

			data: {
				title,
				content,
				parent: folderR ? folderR.id : null,
				//create: user.id,
				words: content ? content.split(' ').length : 0
			}

		});

		// recorro los que son carpetas y actualizo el numero de documentos

		


		return ctx.send({ uuid: document.uuid })

	},

	async update(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		const { id } = ctx.params;


		if (!id) return ctx.badRequest("id is required", { error: 'Envie el id del documento' });



		let { title, content , words} = ctx.request.body.data;

		title = title ? title : 'Sin titulo';

		if (!title) return ctx.badRequest('Titulo no enviado', { error: 'Envie el titulo del documento' });

		// verifico exista el documento y pertenezca al usuario

		let document = await strapi.db.query('api::document-file.document-file').findOne({
			where: {
				uuid: id,
			//	create: user.id
			}
		});





		if (!document) return ctx.badRequest("document not found or not belong to user", { error: 'El documento no existe o no pertenece al usuario' });

		// actualizo el documento

		await strapi.db.query('api::document-file.document-file').update({
			where: {
				uuid: id
			},
			data: {
				title,
				content,
				words  
			}
		});

		return ctx.send({ uuid: id })
	},

	async findOne(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		const { id } = ctx.params;

		if (!id) return ctx.badRequest("id is required");

		strapi.log.debug(id);

		// verifico exista el documento y pertenezca al usuario

		let document = await strapi.db.query('api::document-file.document-file').findOne({
			where: {
				uuid: id,
			//	create: user.id
			}
		});



		if (!document) return ctx.badRequest("document not found or not belong to user"), {	error: 'El documento no existe o no pertenece al usuario' };
		/*const converter = new showdown.Converter();

		document.content = converter.makeHtml(document.content);*/

		return ctx.send({ uuid: document.uuid, title: document.title, content: document.content });

	},

	async findAndFolders(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		// verifico exista el documento y pertenezca al usuario

		let documents = await strapi.db.query('api::document-file.document-file').findMany({
		/*	where: {
				create: user.id
			}*/
		});

		let folders = await strapi.db.query('api::folder-client.folder-client').findMany({
	/*		where: {
				user: user.id
			}*/
		});

		return ctx.send({ documents, folders });


	},
	async createFolder(ctx) {


		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");


		// recibo el mensaje del usuario

		let { name, parentFolder, description, type, client } = ctx.request.body.data;

strapi.log.debug(ctx.request.body.data);
		type = type || 'default';

		if (!name) return ctx.badRequest("name is required");
		if (type == 'client') {

			if (!client) return ctx.badRequest("client is required");

			//if	(parentFolder) return ctx.badRequest("Las carpetas de tipo cliente no pueden tener padre");

		}


		let data = {
			title: name,
			description,
			typeFolder: type,
			create: user.id,
			isFolder: true
		};

		if (type === 'cliente') {
			// verifico exista el cliente y pertenezca al usuario

			let clientR = await strapi.db.query('api::client.client').findOne({
				where: {
					uuid: client,
				//	user: user.id
				}
			});


			if (!clientR) {

				// creo el cliente

				clientR = await strapi.db.query('api::client.client').create({
					data: {
						name: name,
				//		user: user.id
					}
				});
			}

			data.client = clientR.id;


		}

		if (parentFolder) {

			// verifico exista la carpeta y pertenezca al usuario

			let folderR = await strapi.db.query('api::document-file.document-file').findOne({

				where: {
					uuid: parentFolder,
				//	create: user.id
				}

			});

			if (!folderR) return ctx.badRequest("folder not found or not belong to user");

			strapi.log.debug(folderR);

			data.parent = folderR.id;

		}





		await strapi.db.query('api::document-file.document-file').create({
			data
		});






		return ctx.send({
			message: 'Carpeta creada correctamente'
		});


	},
	async find(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		
		let { _limit, _page, _sort, _q, _where } = ctx.query;

		 _limit = _limit ? parseInt(_limit) : 10;
			_page = _page ? parseInt(_page) : 1;
			_sort = _sort ? _sort : 'createdAt:desc';
			_q = _q ? _q : '';
		 // calculo el numero de paginas a saltar o offset

			const _offset =  (_page - 1) * _limit;			
		let _items = [];
		let nombreParent	= {
			title: 'Home'
		};
		if(_where){

			_where = _where[0];

			// añado al where el usuario

	//		_where.create = user.id;

			// obtengo el nombre del padre



			let whereParent = {
				uuid: _where.parent.uuid,
				//create: user.id
			};


	 [nombreParent, _items] = await Promise.all([strapi.db.query('api::document-file.document-file').findOne({

			where: {

				...whereParent,
			},

			select: ['title']

		}), strapi.db.query('api::document-file.document-file').findWithCount({
			limit: _limit,
			offset: _offset,
			where: {
				..._where,
			},

		})]);


	}else{

		 _items = await strapi.db.query('api::document-file.document-file').findWithCount({
			limit: _limit,
			offset: _offset,
			where: {
		//		create: user.id,
				parent: {
					 id :{
							$null: true,
						}
				},
			},

		});

	}

		const _total = _items[1];

		// @ts-ignore
		_items = _items[0];

		// recorro items y verifico si es carpeta y si es asi, obtengo el numero de documentos que tiene
		// @ts-ignore
		for (let i = 0; i < _items.length; i++) {
			// @ts-ignore
			if (_items[i].isFolder) {
			// @ts-ignore
			let cantidadFolder = await strapi.db.query('api::document-file.document-file').count({

					where: {
					// @ts-ignore
						parent: _items[i].id

					}

				});

				// @ts-ignore
				_items[i].items = cantidadFolder;

				

				

			}

		}


		// añado a items un objeto con el nombre del padre

		// @ts-ignore
		_items = {title: nombreParent.title, items: _items };



		const _lastPage = Math.ceil(_total / _limit);
		return ctx.send({ data: _items, meta: { pagination: { page: _page, limit: _limit, total: _total, lastPage: _lastPage } } });

	},

	async delete(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: 'No autorizado' });

		const { id } = ctx.params;

		if (!id) return ctx.badRequest("id is required", { error: 'Envie el id del documento' });

		// verifico exista el documento y pertenezca al usuario

		let document = await strapi.db.query('api::document-file.document-file').findOne({
			where: {
				uuid: id,
			//	create: user.id
			},
			populate : {
				client:true
			}
		});
		strapi.log.debug(document)
		if(document.isFolder && document.client){

			//debo borrar el cliente

			await strapi.entityService.delete('api::client.client', document.client.id);
		}

		if (!document) return ctx.badRequest("document not found or not belong to user");

		// reemplazo el id del params que es en realidad un uuid por el document.id

		ctx.params.id = document.id;



		// @ts-ignore
		return await super.delete(ctx);
	},

	async findInfobase(ctx){

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		let { _limit, _page, _sort, _q, _where } = ctx.query;

		 _limit = _limit ? parseInt(_limit) : 10;
			_page = _page ? parseInt(_page) : 1;
			_sort = _sort ? _sort : 'createdAt:desc';
			_q = _q ? _q : '';

		// busco los grupo de inscrustaciones

		const _offset =  (_page - 1) * _limit;			
			let _items = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findWithCount({
				limit:_limit,
				offset: _offset,
				where: {
					create: user.id,
					infobase:true,
					queueState:"completed"
				},
				
			});



			const _total = _items[1];

			// @ts-ignore
			_items = _items[0];

			const _lastPage = Math.ceil(_total / _limit);
			return ctx.send({ data: _items, meta: { pagination: { page: _page, limit: _limit, total: _total, lastPage: _lastPage } } });
	}


}));
