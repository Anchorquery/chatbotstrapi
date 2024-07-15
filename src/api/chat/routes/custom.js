
module.exports = {
  routes: [
    { // Path defined with a URL parameter
      method: 'PUT',
      path: '/chats/update-config/:uuid',
      handler: 'chat.updateConfig',
      refix: '',
      config: {
        prefix: '',
      }
    },
    { // Path defined with a URL parameter
      method: 'POST',
      path: '/chats/delete-many',
      handler: 'chat.deleteMany',
      refix: '',
      config: {
        prefix: '',
      }
    },    { // Path defined with a URL parameter
      method: 'GET',
      path: '/chats/get-data/:uuid',
      handler: 'chat.getChatData',
      refix: '',
      config: {
        prefix: '',
      }
    },
  ]
}
