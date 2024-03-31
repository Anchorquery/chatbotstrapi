'use strict';

/**
  * document controller
  */
const { Readable } = require("stream");
const path = require('path');
const { v4: uuid } = require('uuid');
const os = require('os');
const fse = require('fs-extra');
const { createCoreController } = require('@strapi/strapi').factories;
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const DocumentQueue = require("../../../../util/queue/files-queue.js");
module.exports = createCoreController('api::document.document', ({ strapi }) => ({


  async uploadFileEmbadding(ctx) {
    try {
      if (!ctx.state.user) return ctx.unauthorized("Unauthorized", { message: 'Unauthorized' });

      const file = ctx.request.files?.files;

      let nombreFile = ctx.request.body.name;



      if (!file) return ctx.badRequest("File required", { message: 'File required' });

      const { client, type, folder } = ctx.request.body;
      const clienteEmpresa = await this.buscarCliente(client);

      if (!type || type != 'file') return ctx.badRequest("Debe especificar el tipo", { message: 'Type not found' });



      nombreFile = nombreFile ? nombreFile : await this.limpiarNombreArchivo(file.name);
      let grupoIncrustacion = await this.obtenerOcrearGrupoIncrustacion(clienteEmpresa, nombreFile, ctx.state.user);

      let fileNameNoExt = uuid() + '_' + nombreFile;
      const entity = await this.construirEntidadArchivo(file, grupoIncrustacion, fileNameNoExt);

      await strapi.plugin('upload').service('upload').uploadFileAndPersist(entity);

      const imagenIN = await strapi.query("plugin::upload.file").create({ data: entity });
      this.procesarYSubirDocumento(grupoIncrustacion.id, nombreFile, imagenIN, clienteEmpresa, ctx.state.user);

      await strapi.db.query('api::message.message').create({
        data: {
          content: `Su archivo ${nombreFile} se está cargando en Infobase, le avisaremos cuando esté listo para usar en Chat. Este proceso puede tardar unos minutos.`,
          uuid: uuid(),
          sender: "info",
          type: "text",

        },


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

  async obtenerOcrearGrupoIncrustacion(clienteEmpresa, nombreFile, user) {
    let grupo = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').findOne({
      where: {
        client: clienteEmpresa ? clienteEmpresa.id : null,
        title: nombreFile,
        create: user.id
      },

      select: ['id']
    });

    if (!grupo) {
      grupo = await strapi.db.query('api::grupo-de-incrustacion.grupo-de-incrustacion').create({
        data: {
          title: nombreFile,
          client: clienteEmpresa ? clienteEmpresa.id : null,
          create: user.id,
          infobase: true
        }
      });
    }

    return grupo;
  },

  async construirEntidadArchivo(file, grupoIncrustacion, fileNameNoExt) {
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

  async procesarYSubirDocumento(grupoIncrustacion, nombreFile, file, clienteEmpresa, user) {

    try {


      const documentQueue = new DocumentQueue(
        user, grupoIncrustacion
      );

      strapi.log.debug(documentQueue)
      strapi.log.debug("grupoIncrustacion al llamar la funcion")
      strapi.log.debug(grupoIncrustacion)


      documentQueue.addDocumentToQueue({ infobase: true, nombreFile, clienteEmpresa, user, grupoIncrustacion, file });
    } catch (error) {

      strapi.log.debug(error)
      return error.message;


    }



  },




  convbyteToKB(bytes) {

    return bytes / 1024;

  },




}));
