'use strict';

/**
	* infobase controller
	*/

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::grupo-de-incrustacion.grupo-de-incrustacion', ({ strapi }) => ({


	async findInfobase(ctx){

		const { user } = ctx.state;

		if (!user) return ctx.unauthorized("Unauthorized");

		let { _limit, _page, _sort, _q, _where, _client ,_isMe } = ctx.query;

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
					create: user.id ,
					infobase:true,
					queueState:"completed"
				},
				populate:["media","client", "create"]
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
