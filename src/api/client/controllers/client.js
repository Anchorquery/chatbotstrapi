'use strict';

/**
 * client controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::client.client' , ({ strapi }) => ({


	async create (ctx){


		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", {	message: 'Unauthorized' });	

		// recibo el mensaje del usuario

		let {name , description, folder} = ctx.request.body.data;

		if (!name) return ctx.badRequest("Name required", {	message: 'Name required' });


		// verifico no exista un cliente con el mismo nombre

		const client = await strapi.db.query('api::client.client').findOne({
			where: {
				name: name,
				user : user.id
			}
		});


		if (client) return ctx.badRequest("Client already exists", {	message: 'Client already exists' });

		if (folder) {

			// verifico exista la carpeta y pertenezca al usuario

			let folderR = await strapi.db.query('api::document-file.document-file').findOne({

				where: {
					uuid: folder,
					create: user.id
				}

			});

			if (!folderR) return ctx.badRequest("folder not found or not belong to user");

			console.log(folderR);

			folder = folderR.id;

		}else{
			
			folder = null;
		}



		const folderT = await strapi.db.query('api::document-file.document-file').create({
			data: {
				title: name,
				description: description,
				create: user.id,
				typeFolder : client,
				isFolder :true,
				parent : folder
			}
		});


	let cliente =	await strapi.db.query('api::client.client').create({
			data: {
				name: name,
				description: description,
				user: user.id,
				folder: folderT.id
			}
		});

		// actualizo el folder con el cliente

		await strapi.db.query('api::document-file.document-file').update({
			where: {
				id: folderT.id
			},
			data: {
				client: cliente.id
			}
		});


		return ctx.send({
			message: 'Client created',
		});



		

	},
	async findOne(ctx){

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized"});

		let { id } = ctx.params;

		if (!id) return ctx.badRequest("Client is required", { error: "Client is required"});

		const client = await strapi.db.query('api::client.client').findOne({
			where: {
				uuid: id,
				//user: user.id
			}
		});

		if (!client) return ctx.badRequest("Client not found", { error: "Client not found"});

		return ctx.send({
			message: 'Client found',
			client
		});


	},

	async find (ctx){
		
		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized"});

		
		let { _limit, _page, _sort, _q, _where } = ctx.query;

		 _limit = _limit ? parseInt(_limit) : 10;
			_page = _page ? parseInt(_page) : 1;
			_sort = _sort ? _sort : 'createdAt:desc';
			_q = _q ? _q : '';
		 // calculo el numero de paginas a saltar o offset

			const _offset =  (_page - 1) * _limit;			
		let _items = [];


		 _items = await strapi.db.query('api::client.client').findWithCount({
			limit: _limit,
			offset: _offset,
			/*where: {
				user: user.id,
			},*/

		});



		const _total = _items[1];

		// @ts-ignore
		_items = _items[0];







		const _lastPage = Math.ceil(_total / _limit);
		return ctx.send({ data: _items, meta: { pagination: { page: _page, limit: _limit, total: _total, lastPage: _lastPage } } });

	}

}));
