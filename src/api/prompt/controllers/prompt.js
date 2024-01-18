'use strict';

const { it } = require('date-fns/locale');

/**
	* promt controller
	*/

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::prompt.prompt', ({ strapi }) => ({


	async find(ctx) {


		// verifico si está conectado y si es admin

		const { user } = ctx.state;

		// saco los parametros de filtrado

		let { _limit, _page, _sort, _q, _type, _orden, _actividad, _tema} = ctx.query;

		_limit = _limit ? parseInt(_limit) : 10;
		_page = _page ? parseInt(_page) : 1;
		_sort = _sort ? _sort : 'createdAt:desc';
		_q = _q ? _q : '';
		// calculo el numero de paginas a saltar o offset

		const _offset = (_page - 1) * _limit;






		if (!user) return ctx.unauthorized("Unauthorized");


console.log({
	_type,
	_tema,
	_actividad
})

		let _items = await strapi.db.query('api::prompt.prompt').findWithCount({

			where: {
				...((_type !== 'undefined' && _type !== undefined) && { type: { '$eq': _type } }),
				...((_tema !== 'undefined' && _tema !== undefined) && {
					category: {
						id: { '$eq': _tema }
					}
				}),
				...((_actividad !== 'undefined' && _actividad !== undefined) && {
					actividad: {
						id: {
							'$eq': _actividad
						}
					}
				}),



			},

			limit: _limit,

			offset: _offset,

			select: ['uuid', 'title', 'oficial', 'status', 'metaData', 'content'],

			populate: ['category'],
		});

		// obtengo el total de prompts

		const _total = _items[1];

		// @ts-ignore
		_items = _items[0];




		const _lastPage = Math.ceil(_total / _limit);




		return ctx.send({ data: _items, meta: { pagination: { page: _page, limit: _limit, total: _total, lastPage: _lastPage } } });
	}






}));
