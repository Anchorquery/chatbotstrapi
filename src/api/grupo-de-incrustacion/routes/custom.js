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
			{
				method: "PUT",
				path: "/grupos-incrustacion/update-infobase/:uuid",
				handler: "custom.updateInfobase",
				config: {
						policies: [],
						middlewares: [],
				},
		},
		
	],
};