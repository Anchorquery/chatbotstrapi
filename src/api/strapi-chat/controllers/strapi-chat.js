'use strict';

/**
 * A set of functions called "actions" for `strapi-chat`
 */
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
module.exports = {
  chat: async (ctx) => {
    try {

    let type =  ctx.request.body.type;
    let response  = null;
    if(type == 'chat'){

       response = await strapi
        .service('api::strapi-chat.strapi-chat')
        .chat(ctx);
    }else{

    
      response = await strapi.service('api::strapi-chat.chat-embading').makeChain(ctx);

    }

      ctx.body = { data: response };


    } catch (err) {
      console.log(err);
      console.log(err.message);
      throw new Error(err.message);
    }
  },

  getSessionById: async (ctx) => {
    try {

      if (!ctx.params.sessionId) {
        throw new Error('id is required');
      }

      const response = await strapi
        .service('api::strapi-chat.strapi-chat')
        .getSessionById(ctx);

      ctx.body = { data: response };
    } catch (err) {
      console.log(err.message);
      throw new Error(err.message);
    }
  },

  deleteSessionById: async (ctx) => {
    try {
      const response = await strapi
        .service('api::strapi-chat.strapi-chat')
        .deleteSessionById(ctx);
      ctx.body = { data: response };
    } catch (err) {
      console.log(err.message);
      throw new Error(err.message);
    }
  },

  clearAllSessions: async (ctx) => {
    try {
      const response = await strapi
        .service('api::strapi-chat.strapi-chat')
        .clearAllSessions(ctx);

      ctx.body = { data: response };
    } catch (err) {
      console.log(err.message);
      throw new Error(err.message);
    }
  },

  getAllSessions: async (ctx) => {
    try {
      const response = await strapi
        .service('api::strapi-chat.strapi-chat')
        .getAllSessions(ctx);

      ctx.body = { data: response };
    } catch (err) {
      console.log(err.message);
      throw new Error(err.message);
    }
  },
  uploadFile: async (ctx) => {
    let files = ctx.request.files["files[]"];

    files = Array.isArray(files) ? files : [files];
    for (const key in files) {
     
      const file = files[key];
     // console.log("file dentro",file);
      const { path, name, type } = file;

      // Generar un nombre único utilizando uuidv4
      const uniqueName = `${uuidv4()}-${name}`;

      // verifico si el directorio existe
      if (!fs.existsSync('./docs')) {
        fs.mkdirSync('./docs');
      }
      

      // Definir la ruta de destino del archivo
      const uploadPath = `./docs/${uniqueName}`;


      try {
        // Leer el contenido del archivo en forma de buffer
        const buffer = await fs.promises.readFile(path);

        // Guardar el archivo en la carpeta "docs" con el nombre único
        await fs.promises.writeFile(uploadPath, buffer);

        let ruta = fs.realpathSync(uploadPath);
 
        ctx.request.body.path = ruta;

        // obtengo la ruta del archivo
        

      //  ctx.request.body.format = format;
        const docs = await strapi
          .service('api::strapi-chat.files-embading')
          .loadDocument(ctx);


        const vectore = await strapi
          .service('api::strapi-chat.files-embading')
          .embeddDocument(docs);

     

        //await fs.promises.unlink(path);

        console.log(`Archivo guardado: ${uploadPath}`);
      } catch (error) {
        console.error(`error : ${error}`);
        console.error(`Error al guardar el archivo: ${uploadPath}`);
        throw new Error(error.message || error);
        console.error(error);
      }
    }

    ctx.send({ ok: true });

  },
  incrustacionUrl: async (ctx) => {

    try {
      const docs = await strapi
        .service('api::strapi-chat.web-embading')
        .loadUrlPuperter(ctx);

      await strapi
        .service('api::strapi-chat.files-embading')
        .embeddDocument(docs);

       

      ctx.body = { ok: true };

    } catch (err) {
      console.log(err.message);
      throw new Error(err.message);
    }
  }
};
