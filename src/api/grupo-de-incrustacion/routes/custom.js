module.exports = {
	routes: [
			{
					method: "GET",
					path: "/grupos-incrustacion/infobase",
					handler: "custom.findInfobase",
					config: {
							policies: [],
							middlewares: [],
					},
			},

		
	],
};