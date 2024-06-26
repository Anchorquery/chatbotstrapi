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
		{
			method: "GET",
			path: "/grupos-incrustacion/infobase/:uuid",
			handler: "custom.findOneInfobase",
			config: {
					policies: [],
					middlewares: [],
			},
	},
		{
			method: "GET",
			path: "/grupos-incrustacion/update-infobase-cron",
			handler: "custom.updateInfobaseCron",
			config: {
					policies: [],
					middlewares: [],
			},
	},
	{
		method: "POST",
		path: "/grupos-incrustacion/incrustar-archivo-drive",
		handler: "custom.incrustarDedeDrive",
		config: {
				policies: [],
				middlewares: [],
		},
},
	],
};