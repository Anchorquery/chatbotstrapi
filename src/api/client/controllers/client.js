'use strict';

/**
	* client controller
	*/

const { createCoreController } = require('@strapi/strapi').factories;
const { Promise } = require('bluebird');

module.exports = createCoreController('api::client.client', ({ strapi }) => ({


	async create(ctx) {


		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { message: 'Unauthorized' });

		// recibo el mensaje del usuario

		let { name, description, folder } = ctx.request.body.data;

		if (!name) return ctx.badRequest("Name required", { message: 'Name required' });


		// verifico no exista un cliente con el mismo nombre

		const client = await strapi.db.query('api::client.client').findOne({
			where: {
				name: name,
				user: user.id
			}
		});


		if (client) return ctx.badRequest("Client already exists", { message: 'Client already exists' });

		if (folder) {

			// verifico exista la carpeta y pertenezca al usuario

			let folderR = await strapi.db.query('api::document-file.document-file').findOne({

				where: {
					uuid: folder,
					create: user.id
				}

			});

			if (!folderR) return ctx.badRequest("folder not found or not belong to user");

			strapi.log.debug(folderR);

			folder = folderR.id;

		} else {

			folder = null;
		}



		const folderT = await strapi.db.query('api::document-file.document-file').create({
			data: {
				title: name,
				description: description,
				create: user.id,
				typeFolder: client,
				isFolder: true,
				parent: folder
			}
		});


		let cliente = await strapi.db.query('api::client.client').create({
			data: {
				name: name,
				description: description,
				user: user.id,
				folder: folderT.id
			}
		});

		// actualizo el folder con el cliente




		// creo un gpt 

		


		Promise.allSettled([
			await strapi.db.query('api::document-file.document-file').update({
				where: {
					id: folderT.id
				},
				data: {
					client: cliente.id
				}
			}), await strapi.db.query('api::gpt.gpt').create({

				data: {

					title: `GPT ${name}`,
					client: cliente.id,
					state: 'draft',
					creation_steps: "uno",
				}
			})]
		);



		return ctx.send({
			message: 'Client created',
		});





	},
	async findOne(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized" });

		let { id } = ctx.params;

		if (!id) return ctx.badRequest("Client is required", { error: "Client is required" });

		const client = await strapi.db.query('api::client.client').findOne({
			where: {
				uuid: id,
				//user: user.id
			}
		});

		if (!client) return ctx.badRequest("Client not found", { error: "Client not found" });

		return ctx.send({
			message: 'Client found',
			client
		});


	},

	async find(ctx) {
		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		let { _limit, _page, _sort, _q, _where, _client, _isMe, _type } = ctx.query;

		_limit = _limit ? parseInt(_limit) : 10;
		_page = _page ? parseInt(_page) : 1;
		_sort = _sort ? _sort : 'createdAt:desc';
		_q = _q ? _q : '';

		const _offset = (_page - 1) * _limit;
		let _items = [];
		let where = {};

		if (_type !== null && _type !== undefined && _type !== "null" && _type) {
			where.type = _type;
		}

		if (_isMe) {
			where.user = user.id;
		}

		if (_q) {
			where.name = {
				$containsi: _q
			};
		}

		_items = await strapi.db.query('api::client.client').findWithCount({
			limit: _limit,
			offset: _offset,
			where: where,
			populate: ['gpt', 'folder'],
			orderBy: { name: 'asc' },

		});

		const _total = _items[1];

		// @ts-ignore
		_items = _items[0];

		const _lastPage = Math.ceil(_total / _limit);
		return ctx.send({ data: _items, meta: { pagination: { page: _page, limit: _limit, total: _total, lastPage: _lastPage } } });
	},

	async delete(ctx) {

		// verifico este logueado

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized" });


		// saco el id del chat

		const { id } = ctx.params;

		if (!id) return ctx.badRequest("Client is required", { error: "Client is required" });


		// busco el chat en la base de datos


		const clientModel = await strapi.db.query('api::client.client').findOne({

			where: {

				uuid: id,
				user: user.id

			},

			populate: ['folder', 'gpt']



		});

		if (!clientModel) return ctx.badRequest("Chat not found", { error: "Chat not found" });

		if	(clientModel.folder) {

			await strapi.db.query('api::document-file.document-file').delete({

				where: {

					parent: clientModel.folder.id

				},

			})

		}

		
		if(clientModel.gpt){
			await strapi.db.query('api::gpt.gpt').delete({

				where: {
	
					id: clientModel.gpt.id
	
				},
	
			})
		}



		await strapi.db.query('api::client.client').delete({

			where: {

				uuid: id,

			},

		})




		return ctx.send({ message: "Chat deleted" });

	},
	async findOnePerfil(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized" });

		let { uuid } = ctx.params;

		if (!uuid) return ctx.badRequest("Client is required", { error: "Client is required" });

		const client = await strapi.db.query('api::client.client').findOne({
			where: {
				uuid: uuid,
				//user: user.id,

			},
			populate: ['folder', 'picture', 'gpt','carpeta']
		});

		if (!client) return ctx.badRequest("Client not found", { error: "Client not found" });


		client.picture = client.picture ? process.env.URL + client.picture.url : '/assets/img/Front/upload-image.png';

		return ctx.send({
			...client
		});


	},

	async updateClient(ctx) {


		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized" });

		let { uuid } = ctx.params;

		if (!uuid) return ctx.badRequest("Client is required", { error: "Client is required" });

		let { name, description, siteUrl, direction, telefono, contactPerson, contactEmail } = ctx.request.body.data;

		if (!name) return ctx.badRequest("Name required", { error: "Name required" });

		const client = await strapi.db.query('api::client.client').findOne({
			where: {
				uuid: uuid,
				user: user.id
			},
			populate: ['folder']

		});




		if (!client) return ctx.badRequest("Client not found", { error: "Client not found" });

		// actualizo el folder


		const [documentFileResult, clientResult] = await Promise.all([
			strapi.db.query('api::document-file.document-file').update({
				where: {
					id: client.folder.id
				},
				data: {
					title: name,
				}
			}),
			strapi.db.query('api::client.client').update({
				where: {
					uuid: client.uuid
				},
				data: {
					name: name,
					description: description,
					siteUrl: siteUrl,
					direction: direction,
					telefono: telefono,
					contactPerson: contactPerson,
					contactEmail: contactEmail
				}
			})
		]);

		return ctx.send({
			message: 'Client updated',
		});


	},

	async updateLogo(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized" });

		let { uuid } = ctx.params;

		if (!uuid) return ctx.badRequest("Client is required", { error: "Client is required" });

		const client = await strapi.db.query('api::client.client').findOne({
			where: {
				uuid: uuid,
				user: user.id
			},
			populate: ['folder']

		});

		if (!client) return ctx.badRequest("Client not found", { error: "Client not found" });

		const { logo } = ctx.request.files;

		if (!logo) return ctx.badRequest("Logo is required", { error: "Logo is required" });


		console.log(logo);

		return ctx.send({
			message: 'Client updated',
		});

	},



}));
