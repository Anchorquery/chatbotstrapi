'use strict';

/**
	* infobase controller
	*/

const { createCoreController } = require('@strapi/strapi').factories;
const DocumentQueue = require("../../../../util/queue/files-queue.js");
module.exports = createCoreController('api::grupo-de-incrustacion.grupo-de-incrustacion', ({ strapi }) => ({


	async findInfobase(ctx){

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		let { _limit, _page, _sort, _q, _where, _client, _isMe, _type,_isInfobase , _state} = ctx.query;

	

		_limit = _limit ? parseInt(_limit) : 10;
		_page = _page ? parseInt(_page) : 1;
		_sort = _sort ? _sort : 'createdAt:desc';
		_q = _q ? _q : '';
		

		let where = {
			
				queueState: "completed"
		};
		if (_client !== null && _client !== undefined && _client !== "null" && _client) {
				where.client = _client;
		}
		if (_type !== null && _type !== undefined && _type !== "null" && _type) {
			where.type = _type;
	}

		if(_isMe == true){
				where.create = user.id;
		}

		if(_isInfobase == true){

			where.infobase = _isInfobase;
		}

		if(_state){

			where.queueState = _state;
		}

		if(_q){
			where.title={
				$containsi:_q
			}
		}
		
		const _offset = (_page - 1) * _limit;
		
		// Realiza la consulta con las condiciones acumuladas en 'where'
		let _items = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findWithCount({
				limit: _limit,
				offset: _offset,
				where: where,
				populate: ["media", "client", "create"]
		});
		



			const _total = _items[1];

			// @ts-ignore
			_items = _items[0];


      // recorro los items para sacar cliente y más datos.

      _items.forEach(element => {

        element.create = element.create?.name ? `${element.create?.name} ${element.create?.lastName}` :element.create?.email;
        

      });




			const _lastPage = Math.ceil(_total / _limit);
			return ctx.send({ data: _items, meta: { pagination: { page: _page, limit: _limit, total: _total, lastPage: _lastPage } } });
	},
	async updateInfobase(ctx){

const {uuid} = ctx.params;

let { title , client, state} = ctx.request.body;



//buso el cliente

client = await await strapi.db.query("api::client.client").findOne({
	where:{
		uuid:client
	}
});




await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").update ({
	where:{
		uuid
	},
	data:{
		title,
		client:client?.id
	}
});

if(state != "completed"){

	const grupoIncrustacion = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findOne({
		where:{
			uuid:uuid
		},

		populate :true 

	});
console.log(grupoIncrustacion)
	if(!grupoIncrustacion || grupoIncrustacion.media == null){

return ctx.badRequest ("Grupo de incrustacion no encontrado");

	}



	// elimino todas las incrustaciones actuales


	await strapi.db.query("api::document.document").deleteMany({
		where: {
			grupoIncrustacion: {
				$eq: grupoIncrustacion.id,
			},
		},
	});

this.procesarYSubirDocumento(grupoIncrustacion.id,title,grupoIncrustacion.media,client,ctx.state.user);


}





return ctx.send({ data:uuid });


	},

	async procesarYSubirDocumento(grupoIncrustacion,nombreFile, file, clienteEmpresa, user) {

  try {


    const documentQueue = new DocumentQueue(
      user,grupoIncrustacion
      );

      strapi.log.debug(documentQueue)
      strapi.log.debug("grupoIncrustacion al llamar la funcion")
      strapi.log.debug(grupoIncrustacion)
  
  
    documentQueue.addDocumentToQueue( { infobase:true,nombreFile,clienteEmpresa,user, grupoIncrustacion, file } );
  } catch (error) {

    strapi.log.debug(error)
    return error.message ;

    
  }



},





}));
