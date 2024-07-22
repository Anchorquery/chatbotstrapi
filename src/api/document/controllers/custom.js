'use strict';

/**
  * document controller
  */
const { Readable } = require("stream");
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const fse = require('fs-extra');
const { createCoreController } = require('@strapi/strapi').factories;
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const DocumentFileQueue = require("../../../../util/queue/files-queue.js");
const DocumentURLQueue = require("../../../../util/queue/url-queue.js");
const DocumentTextQueue = require("../../../../util/queue/text-queue.js");
module.exports = createCoreController('api::document.document', ({ strapi }) => ({


  async uploadFileEmbedding(ctx) {
    try {
      if (!ctx.state.user) return ctx.unauthorized("Unauthorized", { message: 'Unauthorized' });
      const user = ctx.state.user;
      const file = ctx.request.files?.files;
      let { client, type, title, remoteUrl, text, tags } = ctx.request.body;

      tags = JSON.parse(tags);
      const clienteEmpresa = await this.buscarCliente(client);
      let nombreFile = title ? title : await this.limpiarNombreArchivo(type === 'file' ? file.name : text);

      let grupoIncrustacion = await this.getOrCreateGrupoIncrustacion(clienteEmpresa, nombreFile, ctx.state.user.id, remoteUrl, type);

      // Procesar etiquetas
      tags = await this.procesarTags(tags);

      if (type === 'file') {
        if (!file) return ctx.badRequest("File required", { message: 'File required' });
        let fileNameNoExt = uuidv4() + '_' + nombreFile;
        const entity = await this.construirEntidadArchivo(file, grupoIncrustacion, fileNameNoExt);
        await strapi.plugin('upload').service('upload').uploadFileAndPersist(entity);
        const imagenIN = await strapi.query("plugin::upload.file").create({ data: entity });
        this.procesarYSubirDocumento(grupoIncrustacion.id, nombreFile, imagenIN, clienteEmpresa, ctx.state.user);

      } else if (type === 'url') {
        let recursivity = false;
        let summarize = false;
        let cleanHtml = true;
        let puppeteer = false;

        if (!remoteUrl) return ctx.badRequest("Url or file required", { message: 'Url or file required' });
        if (!grupoIncrustacion) {
          return ctx.badRequest("Group creation failed", { message: 'Group creation failed' });
        }

        const documentQueue = new DocumentURLQueue(user, grupoIncrustacion.id);
        documentQueue.addDocumentToQueue({
          urlOrTxt: remoteUrl, nombreFile, clienteEmpresa, summarize, cleanHtml, puppeteer,
          tags, user, grupoIncrustacion, filterUrl: [], blocksize: 0, blocknum: 0,
          minLenChar: 200, recursivity, type
        });
      } else if(type === 'text') {



        if (!text) return ctx.badRequest("Text required", { message: 'Text required' });

        const documentTextQueue = new DocumentTextQueue(user, grupoIncrustacion.id);

        documentTextQueue.addDocumentToQueue({

          text, nombreFile, clienteEmpresa, tags, user, grupoIncrustacion, type

        });



      }else{
        return ctx.badRequest("Type not supported", { message: 'Type not supported' });
      }

      await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({
        where: { id: grupoIncrustacion.id },
        data: {
          remoteUrl: remoteUrl,
          text: text || "",
          title: nombreFile,
          tags: tags,
          isTag: tags && tags.length > 0,
          type: type,
          client: clienteEmpresa ? clienteEmpresa.id : null,
        },
      });

      return ctx.send({ message: 'Su archivo ha sido subido, se le informará cuando esté disponible para ser usado' });

    } catch (error) {
      console.log(error);
      ctx.badRequest('Error processing request', { message: error.message });
    }
  },

  async updateFileEmbedding(ctx) {
    try {

      if (!ctx.state.user) return ctx.unauthorized("Unauthorized", { message: 'Unauthorized' });
      const user = ctx.state.user;
      const file = ctx.request.files?.files;
      const uuid = ctx.params.uuid;


      let { client, type, folder, title , remoteUrl, text, tags } = ctx.request.body;


      tags = JSON.parse(tags);

      let nombreFile = ctx.request.body.title;
      const clienteEmpresa = await this.buscarCliente(client);

      let grupoIncrustacion = await this.getOrCreateGrupoIncrustacion
      (clienteEmpresa, nombreFile, ctx.state.user.id ,remoteUrl, type);

      // elimino todos las incrustaciones que tenga este grupo

      await strapi.db.query("api::document.document").deleteMany({
        where: {
          grupoIncrustacion: {
            $eq: grupoIncrustacion.id,
          },
        },
      });



      tags = await this.procesarTags(tags);



      if(type == 'file'){
        if (!file) return ctx.badRequest("File required", { message: 'File required' });
        let fileNameNoExt = uuidv4() +'_' + nombreFile;
        const entity = await this.construirEntidadArchivo(file, grupoIncrustacion, fileNameNoExt);

        await strapi.plugin('upload').service('upload').uploadFileAndPersist(entity);

        const imagenIN = await strapi.query("plugin::upload.file").create({ data: entity });
        this.procesarYSubirDocumento(grupoIncrustacion.id, nombreFile, imagenIN, clienteEmpresa, ctx.state.user);



      }else if(type == 'url'){

        let recursivity =  false;
        let summarize = false;
        let cleanHtml =   true;
        let puppeteer =   false;

        if (!remoteUrl) return ctx.badRequest("Url or file required", { message: 'Url or file required' });





        if (!grupoIncrustacion) {
          return ctx.badRequest("Group creation failed", { message: 'Group creation failed' });
        }



        const documentURLQueue = new DocumentURLQueue(user, grupoIncrustacion.id);


        documentURLQueue.addDocumentToQueue({
          urlOrTxt: remoteUrl, nombreFile, clienteEmpresa, summarize, cleanHtml, puppeteer,
          tags,
          user, grupoIncrustacion, filterUrl: [], blocksize: 0, blocknum: 0,
          minLenChar: 200, recursivity, type
        });

      } else if(type === 'text') {



        if (!text) return ctx.badRequest("Text required", { message: 'Text required' });

        const documentTextQueue = new DocumentTextQueue(user, grupoIncrustacion.id);

        documentTextQueue.addDocumentToQueue({

          text, nombreFile, clienteEmpresa, tags, user, grupoIncrustacion, type

        });



      }else{
        return ctx.badRequest("Type not supported", { message: 'Type not supported' });
      }


      await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').update({

        where: { uuid },

        data: {
          remoteUrl: remoteUrl,
          text: text ? text : "",
          title: nombreFile,
          tags: tags,
          isTag: tags && tags.length > 0 ? true : false,
          type : type,
          client: clienteEmpresa ? clienteEmpresa.id : null,

        }

      });



      return ctx.send({ message: 'Su archivo ha sido subido, se le informará cuando esté disponible para ser usado' });

    } catch (error) {
      strapi.log.debug(error);
      ctx.badRequest('Error processing request', { message: error.message });
    }
  },

  async buscarCliente(clientUUID) {
    return await strapi.db.query('api::client.client').findOne({
      where: { uuid: clientUUID },
      select: ['id', 'name']
    });
  },

  async limpiarNombreArchivo(nombreArchivo) {
    // Separa la base del nombre del archivo de su extensión usando el último punto.
    const partes = nombreArchivo.split('.');
    const nombreBase = partes.join('.'); // Une de nuevo las partes restantes, en caso de que hubiera más de un punto.

    // Limpia el nombre base del archivo: quita espacios en blanco al inicio y al final, y remueve caracteres especiales.
    const nombreLimpio = nombreBase.trim().replace(/[*+~.()'"!:@]/g, '').replace(/[_-]/g, ' ');

    // Opcional: Si deseas conservar la extensión, puedes concatenarla de nuevo aquí.
    // return `${nombreLimpio}.${extension}`;

    return nombreLimpio; // Retorna el nombre base limpio sin la extensión.
  },


  async construirEntidadArchivo(file, grupoIncrustacion, fileNameNoExt) {
    console.log("file", file)
    let buffer = await fs.promises.readFile(file.path);
    strapi.log.debug("grupoIncrustacion", grupoIncrustacion)
    const tmpWorkingDirectory = await fse.mkdtemp(path.join(os.tmpdir(), 'strapi-upload-'));

    return {
      name: `${file.name}`,
      hash: fileNameNoExt,
      ext: path.extname(file.name),
      mime: file.type,
      size: this.convbyteToKB(file.size),
      provider: 'local',
      tmpWorkingDirectory: tmpWorkingDirectory,
      getStream: () => Readable.from(buffer),
      folderPath: '/1',
      related: {
        id: grupoIncrustacion.id,
        __type: 'api::grupo-de-incrustacion.grupo-de-incrustacion',
        __pivot: { field: 'media' }
      }
    };
  },

  async procesarYSubirDocumento(grupoIncrustacion, nombreFile, file, clienteEmpresa, user, tags = []) {

    try {


      const documentQueue = new DocumentFileQueue(
        user, grupoIncrustacion
      );


      documentQueue.addDocumentToQueue({ infobase: true, nombreFile, clienteEmpresa, user, grupoIncrustacion, file, tags });
    } catch (error) {

      console.log(error);
      return error.message;


    }



  },


  async getOrCreateGrupoIncrustacion(clienteEmpresa, nombreFile, userId, info, type, uuid) {

    let where={};

    if(clienteEmpresa){
      where.client = clienteEmpresa.id;
    }

    if(uuid){

      where.uuid = uuid;


    }else{
      where.title = nombreFile;
    }
    let grupoIncrustacion = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').findOne({
      where,
      select: ['id']
    });

    if (!grupoIncrustacion) {


      let data = { title: nombreFile, create: userId };

      if (clienteEmpresa) {

        data.client = clienteEmpresa.id;

      }

      if (type == 'url') {
        data.remoteUrl =  info;
      }

          if (type == 'text') {
            data.text = info;
          }

      grupoIncrustacion = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').create({
        data: { ...data, type }
      });
    }

    return grupoIncrustacion;
  },
  convbyteToKB(bytes) {

    return bytes / 1024;

  },
  async procesarTags(tags) {
    if (tags && tags.length > 0) {
        let arrayTags = [];
        for (let tag of tags) {
          let existingTag = null;
          if (tag.id) {



            existingTag = await strapi.db.query("api::tag.tag").findOne({
                where: { id: tag.id }
            });
          }else{
           // lo creo

            existingTag = await strapi.db.query("api::tag.tag").create({
              data: {
                  title: tag
              }

          });
          }

            arrayTags.push(existingTag.id);
        }

        return arrayTags;
    }
    return null;
}




}));
