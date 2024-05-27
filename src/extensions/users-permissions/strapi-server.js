
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.URL + '/api/users/drive/oauth2callback'

);
module.exports = (plugin) => {
  plugin.controllers.user.googleAuth = async (ctx) => {

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',  // Permiso para Google Drive
      'https://www.googleapis.com/auth/gmail.readonly', // Permiso para Gmail
      'https://www.googleapis.com/auth/userinfo.profile', // Permiso para la información del perfil del usuario
      'https://www.googleapis.com/auth/userinfo.email'
    ];



    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state : ctx.state.user.id
    });

    return {
      url
    }
  };

  plugin.controllers.user.oauth2Callback = async (ctx) => {

    const { code,state } = ctx.query;


    // busco al usuario en la base de datos

    const user = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({
      where: {id: state },
      // populo todos los	campos de la tabla
      // @ts-ignore
      populate: true,
    });

    if(!user){

      return ctx.badRequest("Error",{error:true, message: "Usuario no encontrado"})
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
      where: {user: state },
    });


    if(googleTokens){

      // actualizo googleTokens


      await strapi.db
      .query("api::user-google-token.user-google-token")
      .findOne({
        where: {user: state },
      });




    }

    return tokens;

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
