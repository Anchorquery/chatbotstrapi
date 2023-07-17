'use strict';




module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {




  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
   /* process.nextTick(() => {
   
      let interval;
      // @ts-ignore
      var io = require("socket.io")(strapi.server.httpServer, {
        cors: { // cors setup
          origin: "*",
          methods: ["GET", "POST"],
          allowedHeaders: ["Authorization"],
          credentials: true,
        },
      });

      console.log('socket.io server started');
      console.log('socket.io server started',io );
      io.use(async (socket, next) => {


        try {

    
          //Socket Authentication
          const result = await strapi.plugins[
            'users-permissions'
          ].services.jwt.verify(socket.handshake.query.token);

          
          // buscamos el usuario en la base de datos

          const user = await strapi.entityService.findOne('plugin::users-permissions.user', result.id, {
            populate: { avatar_image: true }
          });

          delete user.createdAt;
          delete user.updatedAt;
          delete user.provider;
          delete user.password;
          delete user.resetPasswordToken;
          delete user.confirmationToken;

    
        //  user.avatar_image = user.avatar_image ? user.avatar_image.url : false;


          // actualizo el usuario como online

          await strapi.entityService.update('plugin::users-permissions.user', result.id , 
          
          {data:{ online: true, socket_id : socket.id  } });


          
          socket.user = user;
          next();
        } catch (error) {


          console.log(error)
        }



      }).on('connection', function (socket) {


        console.log('socket.io server started', socket.user.id);

        if (interval) {
          clearInterval(interval);
        }

  
        interval = setInterval(() => {
          io.emit('serverTime', { time: new Date().getTime() }); // This will emit the event to all connected sockets

        }, 1000);



 
        // send mensaje

        socket.on('sendMessage' , async (data) => {

          console.log(data);
          let response = {};

          let ctx = {
            request: {
              body: {
                data: {
                  ...data,
                },
              },
            },
            state: {
              user: socket.user,
            },
            // ñado el socket para poder emitir mensajes
            socket: socket
          };


          

        

          if(data.type == 'chat'){

            response = await strapi
             .service('api::strapi-chat.strapi-chat')
             .chat(ctx);
         }else{
     
         
           response = await strapi.service('api::strapi-chat.chat-embading').makeChain(ctx);
     
         }


          

          socket.emit('responseMessage', {status: 'sent' , message: response});


          

        })


        socket.on('disconnect', async () => {


          // actualizo el usuario como offline

          await strapi.entityService.update('plugin::users-permissions.user', socket.user.id , 
          
          {data:{ online: false , socket_id : null }});


        });


        

      });

    });*/
  },



};
