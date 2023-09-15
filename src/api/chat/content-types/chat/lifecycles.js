const uuid = require('uuid');

module.exports = {

	beforeCreate(event) {
		if(!event.params.data.uuid)	{
			event.params.data.uuid = uuid.v4();
		}

	
	},
};