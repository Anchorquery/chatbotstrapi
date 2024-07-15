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
			{
				method: "POST",
				path: "/document/uploadTextEmbadding",
				handler: "document.uploadTextEmbadding",
				config: {
						policies: [],
						middlewares: [],
				},
		},
			{
				method: "POST",
				path: "/document/fileEmbadding",
				handler: "custom.uploadFileEmbadding",
				config: {
						policies: [],
						middlewares: [],
				},
		},
	],
};