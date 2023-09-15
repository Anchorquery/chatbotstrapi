'use strict';

/**
 * tone controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::tone.tone',({ strapi }) => ({


	async find (ctx) {


		// verifico si está conectado y si es admin

		const { user } = ctx.state;

		// saco los parametros de filtrado

		let { _limit, _page, _sort, _q, _where } = ctx.query;

		 _limit = _limit ? parseInt(_limit) : 10;
			_page = _page ? parseInt(_page) : 1;
			_sort = _sort ? _sort : 'createdAt:desc';
			_q = _q ? _q : '';
		 // calculo el numero de paginas a saltar o offset

			const _offset =  (_page - 1) * _limit;						





		if (!user) return ctx.unauthorized("Unauthorized");


		// obtengo los prompts del usuario y los marcados como publicos todos con status = true

		let _items = await strapi.db.query('api::tone.tone').findWithCount({


			limit: _limit,

			offset: _offset,


		});

		// obtengo el total de prompts

		const _total = _items[1];

		// @ts-ignore
		_items = _items[0];




		const _lastPage = Math.ceil(_total / _limit);




		return ctx.send({ data: _items, meta: { pagination: { page: _page, limit: _limit, total: _total, lastPage: _lastPage } } });
	}

}));
