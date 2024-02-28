'use strict';

/**
	* infobase controller
	*/

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::grupo-de-incrustacion.grupo-de-incrustacion', ({ strapi }) => ({


	async findInfobase(ctx){

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		let { _limit, _page, _sort, _q, _where, _client, _isMe, _type } = ctx.query;

	

		_limit = _limit ? parseInt(_limit) : 10;
		_page = _page ? parseInt(_page) : 1;
		_sort = _sort ? _sort : 'createdAt:desc';
		_q = _q ? _q : '';
		

		let where = {
				infobase: true,
				queueState: "completed"
		};
		if (_client !== null && _client !== undefined && _client !== "null" && _client) {
				where.client = _client;
		}
		if (_type !== null && _type !== undefined && _type !== "null" && _type) {
			where.type = _type;
	}

		if(_isMe){
				where.create = user.id;
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

        element.create = `${element.create?.name} ${element.create?.lastName}`
        

      });




			const _lastPage = Math.ceil(_total / _limit);
			return ctx.send({ data: _items, meta: { pagination: { page: _page, limit: _limit, total: _total, lastPage: _lastPage } } });
	}




}));
