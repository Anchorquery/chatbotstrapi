
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.URL + '/api/users/drive/oauth2callback'

);
module.exports = (plugin) => {
  plugin.controllers.user.googleAuth = async (ctx) => {


    // si no esta logueado retorno un error 401

    if (!ctx.state.user) {

      return ctx.unauthorized("Error", { error: true, message: "Usuario no logueado" })

    }

    // saco el parametro de redireccion

    let { _redirect, uuid } = ctx.query;

    const scopes = [

      //  'https://www.googleapis.com/auth/gmail.readonly', // Permiso para Gmail
      'https://www.googleapis.com/auth/userinfo.profile', // Permiso para la información del perfil del usuario
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/drive'
    ];

    if (_redirect == 'client_infobase') {

       //http://localhost:8080/app/cliente/18df8361-9047-4267-97eb-d7d617215355

       _redirect = process.env.FRONT_URL + '/app/cliente/' + uuid + '?tab=documentos';



    }

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      // en state mando el id del usuario y la url del front para redirigir
      state:  ctx.state.user.id + ',' + _redirect
    });

    return {
      url
    }
  };

  plugin.controllers.user.oauth2Callback = async (ctx) => {

    const { code, state } = ctx.query;


    // separo de state el id del usuario y la url del front

    const [userId, url] = state.split(',');



    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: { id: userId },
        // populo todos los	campos de la tabla
        // @ts-ignore
        populate: true,
      });

    if (!user) {

      return ctx.badRequest("Error", { error: true, message: "Usuario no encontrado" })
    }

    console.log(ctx.query)
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);


    /*const entity = await strapi.db
    .query("plugin::users-permissions.user")
    .create({

    });*/

    // busco si no existe uno


    const googleTokens = await strapi.db
      .query("api::user-google-token.user-google-token")
      .findOne({
        where: { user: userId },
      });

    console.log(tokens)
    if (googleTokens) {

      // actualizo googleTokens


      await strapi.db.query("api::user-google-token.user-google-token").update({

        data: {
          ...tokens
        },
        where: {
          id: googleTokens.id

        }

      });





    } else {

      // creo uno nuevo

      await strapi.db.query("api::user-google-token.user-google-token").create({

        data: {
          ...tokens,
          user: userId
        }

      });

    }

    // redirijo al front

    ctx.redirect(url);

    

  };


  plugin.controllers.user.me = async (ctx) => {

    // si no esta logueado retorno un error 401
    console.log(ctx.state.user)
    if (!ctx.state.user) {

      return ctx.unauthorized("Error", { error: true, message: "Usuario no logueado" })

    }

    const user = await strapi.db

      .query("plugin::users-permissions.user")

      .findOne({

        where: { id: ctx.state.user.id },

        // populo todos los	campos de la tabla

        // @ts-ignore

        populate: true,


      });





    const token = await strapi.db.query("api::user-google-token.user-google-token").findOne({

      where: { user: ctx.state.user.id },

    });

 

    return {
      id: user.id,
      uuid: user.uuid,
      email: user.email,

      name: user.name,

      lastname: user.lastname,


      isGoogleAuth: token ? true : false,

      role: {
          
          id: user.role.id,
  
          name: user.role.name
      }

    };






  };




  plugin.routes["content-api"].routes.push(
    {
      method: "GET",
      path: "/users/auth/google",
      handler: "user.googleAuth",
      config: {
        prefix: "",
      },
    },

  ); plugin.routes["content-api"].routes.push(
    {
      method: "GET",
      path: "/users/drive/oauth2callback",
      handler: "user.oauth2Callback",
      config: {
        prefix: "",
      },
    },

  );

  return plugin;
};
