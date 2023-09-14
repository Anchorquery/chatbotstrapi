module.exports = {
	routes: [
			{
					method: "POST",
					path: "/document/uploadEmbadding",
					handler: "document.uploadEmbadding",
					config: {
							policies: [],
							middlewares: [],
					},
			},
			{
					method: "POST",
					path: "/document/uploadUrlEmbadding",
					handler: "document.uploadUrlEmbadding",
					config: {
							policies: [],
							middlewares: [],
					},
			},

	],
};