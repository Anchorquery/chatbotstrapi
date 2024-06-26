
'use strict';
/**
	* chat controller
	*/
const { OpenAI } = require("langchain/llms/openai");
const { BufferMemory } = require("langchain/memory");
const { ConversationChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");
const { v4: uuidv4 } = require('uuid');
const { createCoreController } = require('@strapi/strapi').factories;
const { convert } = require('html-to-text');
const { Promise } = require('bluebird');
const { OPENAI_API_KEY } = process.env;

module.exports = createCoreController('api::chat.chat', ({ strapi }) => ({

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
		let where = {

		};

		if (_type !== null && _type !== undefined && _type !== "null" && _type) {
			where.type = _type;
		}

		if (_isMe) {
			where.user = user.id;
		}

		if (_q) {
			where.name = {
				$containsi: _q
			}
		}

		_items = await strapi.db.query('api::chat.chat').findWithCount({
			limit: _limit,
			offset: _offset,
			where: where,
			populate: ['user'],
		});



		const _total = _items[1];

		// @ts-ignore
		_items = _items[0];



		const _lastPage = Math.ceil(_total / _limit);
		return ctx.send({ data: _items, meta: { pagination: { page: _page, limit: _limit, total: _total, lastPage: _lastPage } } });

	},

	async create(ctx) {


		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");


		// recibo el mensaje del usuario

		const { prompt, type, tone, language, temperature } = ctx.request.body.data;


		strapi.log.debug({ prompt, type, tone, language, temperature });








	},
	async config(ctx) {



	},

	async createCopy(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		// saco los datos 

		let { language, tone, temperature, variation, type, prompt, description } = ctx.request.body.data;

		if (!prompt) return ctx.badRequest("Prompt is required");

		if (!language) language = 'es';

		if (!tone) return ctx.badRequest("Tone is required");

		if (!temperature) return ctx.badRequest("Temperature is required");

		if (!description) return ctx.badRequest("Variation is required");



		if (!variation) variation = 1;


		if (!type) type = 'copy';


		// busco por uuid la temperatura api::temperature.temperature

		const temperatureModel = await strapi.db.query('api::temperature.temperature').findOne({

			where: {

				uuid: temperature

			}

		});

		if (!temperatureModel) return ctx.badRequest("Temperature not found");


		// busco por uuid el tono api::tone.tone

		const toneModel = await strapi.db.query('api::tone.tone').findOne({

			where: {

				uuid: tone

			},

		});

		if (!toneModel) return ctx.badRequest("Tone not found");


		// reemplazo el tono y temperatura de ctx.request.body.data

		ctx.request.body.data.tone = toneModel;

		ctx.request.body.data.temperature = temperatureModel;

		// busco el promptTemplate en la base de datos 

		const promptTemplate = await strapi.db.query('api::prompt.prompt').findOne({

			where: {
				uuid: prompt
			},

			select: ['content']



		});



		const iaConfig = await this.configureLangChainChat(ctx);


		let template = promptTemplate.content;

		// añado un texto indicando que responsa en languaje (que es el idioma seleccionado por el usuario) y con el tono (que es el tono seleccionado por el usuario)



		template = template + `\n respuesta siempre en: {language} \n usando un tono : {tone} en la conversacion \n , formatea la respuesta en texto enriquecido`;

		const initializedPrompt = new PromptTemplate({ template, inputVariables: ["language", "tone"] });

		// formateo el promptTemplate

		const initialPrompt = await initializedPrompt.format({ language: this.configureLanguaje(language), tone: toneModel.title });

		let history = [];

		let respuesta = await iaConfig.chain.call({ input: initialPrompt });


		history.push({ message: initialPrompt, response: respuesta.response });
		respuesta = await iaConfig.chain.call({ input: description });
		history.push({ message: description, response: respuesta.response });

		// guardo en la base de datos todo, creando un chat 

		const chat = await strapi.db.query('api::chat.chat').create({

			data: {

				user: user.id,

				prompt: promptTemplate.id,

				temperature: temperatureModel.id,

				tone: toneModel.id,

				language: language,

				history: JSON.stringify(history),

				type: type,

				description: description,

				uuid: uuidv4(),
				iaConfig: JSON.stringify(iaConfig),
				config: {
					language: language,
					tone: toneModel,
					temperature: temperatureModel,
					variation: variation,
					type: type,
				}


			}

		});

		let uuidDocument = uuidv4();
		await Promise.all([strapi.db.query('api::message.message').create({

			data: {

				content: description,
				messageRaw: JSON.stringify(description),
				datetime: new Date(),
				type: 'text',
				chat: chat.id,
				user: user.id,
				sender: 'user',
			}

		}), strapi.db.query('api::message.message').create({

			data: {

				content: respuesta.response,
				messageRaw: JSON.stringify(respuesta.response),
				datetime: new Date(),
				type: 'text',
				chat: chat.id,
				user: user.id,
				sender: 'ia',
			}

		}), await strapi.db.query('api::document-file.document-file').create({

			data: {

				title: "Nuevo documento",
				content: respuesta.response,
				create: user.id,
				uuid: uuidDocument,
			}
		})]);

		// creo el documento





		return ctx.send({ chat: chat.uuid, document: uuidDocument });
	},
	async findOne(ctx) {

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized" });

		let { id } = ctx.params;



		if (!id) return ctx.badRequest("Chat is required", { error: "Chat is required" });

		// busco el chat en la base de datos 

		const chatModel = await strapi.db.query('api::chat.chat').findOne({

			where: {

				uuid: id,
				user: user.id

			},

		});

		let messages = await strapi.db.query('api::message.message').findMany({

			where: {

				chat: chatModel.id

			},


		});

		for (let i = 0; i < messages.length; i++) {

			delete messages[i].embedding;

		}


		// busco el prompt asociado al chat 


		/*const prompt = await strapi.db.query('api::prompt.prompt').findOne({

			where: {

				id: chatModel.config.prompt.id,

			},

			select : ['title']

		});*/

		// saco el mensaje
		let titulo = "";
		if (messages[0]) {
			titulo = messages[0].content
			titulo = convert(titulo, { wordwrap: 130 });


			titulo = titulo.substring(0, 30) + '...';




		}


	/* verifico que chatModel.config exista . Si existe chatModel.config.configuracion  debe existir sino lo creo y añado estos valores cantidad: {
				vectoresMensaje: 5,
				mensajesHistorial: 10
			}*/
			if (!chatModel.config) {

				chatModel.config = {

					configuracion: {

						cantidad: {

							vectoresMensaje: 5,

							mensajesHistorial: 10

						}

					},

					cliente: {

						name: "Cliente no asignado",
						uuid : null
					}

				}

			}
		if (!chatModel.config.configuracion) {

			chatModel.config.configuracion = {

				cantidad: {

					vectoresMensaje: 5,

					mensajesHistorial: 10

				}

			}

		}




		return ctx.send({ messages: messages, prompt: titulo, name: chatModel.name, description: chatModel.description, config: chatModel.config, chat: chatModel.uuid });



	},

	configureLanguaje(language) {

		if (!language) language = 'es';

		if (language === 'es') {

			language = 'Español';

		} else if (language === 'en') {

			language = 'Ingles';

		} else {

			language = 'Euskera';

		}

		return language;
	},

	configureLangChainChat(ctx) {

		const { user } = ctx.state;

		let { language, tone, temperature, variation, type } = ctx.request.body.data;

		if (!user) return ctx.unauthorized("Unauthorized");

		if (!language) language = 'es';

		if (language === 'es') {

			language = 'Español';

		} else if (language === 'en') {

			language = 'Ingles';

		} else {

			language = 'Euskera';

		}

		if (!tone) tone = 0.5;

		if (!temperature) temperature = 0.7;

		if (!variation) variation = 1;

		if (!type) type = 'chat';

		let topP = typeof temperature === 'object' ? temperature.topP : 1;

		temperature = typeof temperature === 'object' ? temperature.temperature : temperature;


		const memory = new BufferMemory();

		const model = new OpenAI({
			openAIApiKey: OPENAI_API_KEY,
			modelName: "gpt-3.5-turbo",
			temperature: temperature,
			timeout: 90000,
			topP: topP,
			maxTokens: -1,
			verbose: true,
			n: variation,
			streaming: type === 'chat' ? true : false,

		});

		const chain = new ConversationChain({
			llm: model,
			memory: memory,
		});

		return {
			chain: chain,
			memory: memory,
			model: model,
		}
	},

	async delete(ctx) {

		// verifico este logueado

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized" });


		// saco el id del chat

		const { id } = ctx.params;

		if (!id) return ctx.badRequest("Chat is required", { error: "Chat is required" });


		// busco el chat en la base de datos


		const chatModel = await strapi.db.query('api::chat.chat').findOne({

			where: {

				uuid: id,
				user: user.id

			},



		});

		if (!chatModel) return ctx.badRequest("Chat not found", { error: "Chat not found" });


		//	borro el chat



		// elimino todos los mensajes del chat

		// busco todos los mensajes del chat

		const messages = await strapi.db.query('api::message.message').findMany({

			where: {

				chat: chatModel.id,

			},

			limit: 5000,

		});

		// losr ecorro y elimino usando bluebird

		await Promise.map(messages, async (message) => {

			await strapi.db.query('api::message.message').delete({

				where: {

					id: message.id,

				},

			});

		});

		/*	await strapi.db.query('api::message.message').deleteMany({
				where: {
					chat: {
							id: chatModel.id
						},
				},
		});*/



		await strapi.db.query('api::chat.chat').delete({

			where: {

				uuid: id,

			},

		});

		return ctx.send({ message: "Chat deleted" });

	},


	async updateTitle(ctx) {


		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized" });

		const { uuid } = ctx.params;

		if (!uuid) return ctx.badRequest("Chat is required", { error: "Chat is required" });

		const { name } = ctx.request.body.data;

		if (!name) return ctx.badRequest("Title is required", { error: "Title is required" });

		await strapi.db.query('api::chat.chat').update({

			where: {

				uuid: uuid,

			},

			data: {

				name: name,

			},

		});

		return ctx.send({ message: "Title updated" });



	},
	async updateConfig(ctx) {


		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized", { error: "Unauthorized" });

		const { uuid } = ctx.params;

		if (!uuid) return ctx.badRequest("Chat is required", { error: "Chat is required" });

		const { client, configuracion } = ctx.request.body.data;

		console.log(ctx.request.body.data);



		if (!configuracion) return ctx.badRequest("Config is required", { error: "Config is required" });
		let clientModel = null;
		if(client?.uuid){
			clientModel = await strapi.db.query('api::client.client').findOne({

				where: {
	
					uuid: client.uuid,
	
				},
	
			});
console.log(clientModel);
			if (!clientModel) return ctx.badRequest("Client not found", { error: "Client not found" });
		}




		

		await strapi.db.query('api::chat.chat').update({

			where: {

				uuid: uuid,

			},

			data: {

				config: {
					
					configuracion: {
						...configuracion,
					
					},

					cliente:	client,	
				},

				// añado client si existe 

				client: clientModel ? clientModel.id : null,

			},

		});

		return ctx.send({ message: "Chat updated" });



	}


}));
