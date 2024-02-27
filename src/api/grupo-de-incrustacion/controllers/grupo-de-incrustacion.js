'use strict';

/**
	* grupo-de-incrustacion controller
	*/

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::grupo-de-incrustacion.grupo-de-incrustacion', ({ strapi }) => ({

	async delete(ctx) {


		console.log(ctx.params)

		const { id } = ctx.params;
		if (!id) return ctx.badRequest("Chat is required", { error: "Chat is required" });
		let grupo_incrustacion = await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").findOne({
			where: {
				uuid: id

			}
		});



		if (!grupo_incrustacion) return ctx.badRequest("Chat is required", { error: "Chat is required" });

		let count = await strapi.db.query("api::document.document").deleteMany({
			where: {
				grupoIncrustacion: {
					$eq: grupo_incrustacion.id,
				},
			},
		});


		await strapi.db.query("api::grupo-de-incrustacion.grupo-de-incrustacion").delete({
			where: {
				id: grupo_incrustacion.id

			}
		});

		console.log(count);

		return ctx.send({
			count: count,
			state: "OK"

		})
	}



}));
