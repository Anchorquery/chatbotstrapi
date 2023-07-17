<template>
  <v-app>
    <v-main>
      <v-container fluid>
        <v-row>
          <v-col cols="12" md="5">
            <div class="">
              <v-tabs v-model="tab">
                <v-tab
                  v-for="(item, index) in tabs"
                  :value="item.value"
                  :key="index"
                >
                  {{ item.text }}
                </v-tab>
              </v-tabs>

              <v-window v-model="tab">
                <v-window-item value="1">
                  <div
                    class="_chat_1qglh_1"
                    style="height: 100%; margin-top: 30px"
                  >
                    <div class="_selectRow_1qglh_7">
                      <div class="_select_1qglh_7">
                        <v-select
                          v-model="selectedLanguage"
                          :items="languages"
                          item-title="name"
                          item-value="id"
                          label="Idioma"
                          persistent-hint
                          return-object
                          single-line
                        ></v-select>
                      </div>
                      <div class="_select_1qglh_7">
                        <v-select
                          v-model="selectedTone"
                          :items="tones"
                          item-title="name"
                          item-value="id"
                          label="Tone"
                          persistent-hint
                          return-object
                          single-line
                        ></v-select>
                      </div>
                    </div>
                    <v-virtual-scroll
                      :height="350"
                      id=""
                      class=""
                      :items="messages"
                    >
                      <template v-slot:default="{ item }">
                        <div
                          class="_item_nop3r_1"
                          :class="{
                            _human_nop3r_39: item.sender === 'You',
                            _bot_nop3r_35: item.sender === 'Rytr',
                          }"
                        >
                          <div class="_sender_nop3r_7">
                            <div
                              class="_avatar_nop3r_13"
                              v-if="item.sender === 'Rytr'"
                            >
                              <img
                                src="https://storage.googleapis.com/rytr-me/public/image/logo.svg"
                                alt="Rytr"
                              />
                            </div>
                            <p>{{ item.sender }}</p>
                          </div>

                          <div class="_content_nop3r_42">
                            <p dir="auto">{{ item.content }}</p>
                          </div>

                          <div class="_actions_nop3r_49">
                            <div class="_buttons_nop3r_57">
                              <v-btn
                                @click="pasarAlEditor(item.content)"
                                class="_button_194hd_2 _outlined_194hd_112 _small_194hd_37"
                                text
                              >
                                <v-icon>mdi-content-copy</v-icon>
                                <span class="_spacing_194hd_17"></span>
                                Copiar al documento
                              </v-btn>
                              <!-- <v-btn
                                class="_button_194hd_2 _text_194hd_146 _small_194hd_37"
                                text
                              >
                                Delete
                              </v-btn>-->
                            </div>
                            <p class="_time_nop3r_70">{{ item.time }}</p>
                          </div>
                        </div>
                      </template>
                    </v-virtual-scroll>

                    <form class="_form_1qglh_138" @submit.prevent="sendMessage">
                      <input
                        type="text"
                        v-model="newMessage"
                        placeholder="Enter your message..."
                        maxlength="300"
                        :disabled="statusMessage"
                      />
                      <button type="submit">
                        <v-icon>mdi-send</v-icon>
                      </button>
                      <button type="button" class="_clear_1qglh_173">
                        <v-icon>mdi-close</v-icon>
                      </button>

                      <div v-if="statusMessage" class="lds-ellipsis">
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                      </div>
                      

                    </form>
                  </div>
                </v-window-item>
                <v-window-item value="2">
                  <div
                    class="_chat_1qglh_1"
                    style="height: 100%; margin-top: 30px"
                  >
                    <v-row
                      align="center"
                      justify="center"
                      style="margin-bottom: 20px"
                    >
                      <v-col cols="auto">
                        <v-btn
                          density="default"
                          icon="mdi-file"
                          @click="openModalFile"
                        ></v-btn>
                      </v-col>

                      <v-col cols="auto">
                        <v-btn
                          density="default"
                          icon="mdi-web"
                          @click="openURLModal"
                        ></v-btn>
                      </v-col>
                    </v-row>

                    <v-virtual-scroll
                      :height="350"
                      id=""
                      class=""
                      :items="messages"
                    >
                      <template v-slot:default="{ item }">
                        <div
                          class="_item_nop3r_1"
                          :class="{
                            _human_nop3r_39: item.sender === 'You',
                            _bot_nop3r_35: item.sender === 'Rytr',
                          }"
                        >
                          <div class="_sender_nop3r_7">
                            <div
                              class="_avatar_nop3r_13"
                              v-if="item.sender === 'Rytr'"
                            >
                              <img
                                src="https://storage.googleapis.com/rytr-me/public/image/logo.svg"
                                alt="Rytr"
                              />
                            </div>
                            <p>{{ item.sender }}</p>
                          </div>

                          <div class="_content_nop3r_42">
                            <p dir="auto">{{ item.content }}</p>
                          </div>

                          <div class="_actions_nop3r_49">
                            <div class="_buttons_nop3r_57">
                              <v-btn
                                @click="pasarAlEditor(item.content)"
                                class="_button_194hd_2 _outlined_194hd_112 _small_194hd_37"
                                text
                              >
                                <v-icon>mdi-content-copy</v-icon>
                                <span class="_spacing_194hd_17"></span>
                                Copiar al documento
                              </v-btn>
                              <!-- <v-btn
                                class="_button_194hd_2 _text_194hd_146 _small_194hd_37"
                                text
                              >
                                Delete
                              </v-btn>-->
                            </div>
                            <p class="_time_nop3r_70">{{ item.time }}</p>
                          </div>
                        </div>
                      </template>
                    </v-virtual-scroll>

                    <form
                      class="_form_1qglh_138"
                      @submit.prevent="sendMessage(2)"
                    >
                      <input
                        type="text"
                        v-model="newMessage"
                        placeholder="Enter your message..."
                        maxlength="300"
                      />
                      <button type="submit">
                        <v-icon>mdi-send</v-icon>
                      </button>
                      <button type="button" class="_clear_1qglh_173">
                        <v-icon>mdi-close</v-icon>
                      </button>
                    </form>
                  </div>
                </v-window-item>
              </v-window>
            </div>
          </v-col>

          <v-col cols="12" md="7">
            <div class="_file_rt005_1">
              <div class="_workspace_10w6x_1">
                <quill-editor
                  theme="snow"
                  ref="quill"
                  @ready="onQuillReady"
                ></quill-editor>
              </div>
            </div>
          </v-col>
        </v-row>
      </v-container>
      <v-dialog v-model="dialog" max-width="400px">
        <v-card>
          <v-card-text>
            <v-row justify="center">
              <v-col cols="12" class="text-center">
                <div v-if="uploadProgress < 100">
                  <v-progress-circular
                    :size="70"
                    :width="7"
                    :value="uploadProgress"
                    color="primary"
                  ></v-progress-circular>
                  <div class="mt-2">Uploading...</div>
                </div>
                <div v-else>
                  <v-icon large color="success"
                    >mdi-check-circle-outline</v-icon
                  >
                  <div class="mt-2">Upload completed!</div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-dialog>
      <v-dialog v-model="modalOpenFile" max-width="500">
        <v-card>
          <v-card-title>Select Files to Upload</v-card-title>
          <v-card-text>
            <div style="display: flex">
              <v-file-input
                label="File input"
                variant="solo"
                width="70%"
                prepend-icon="mdi-paperclip"
                accept="application/pdf, application/vnd.google-apps.document, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, text/csv"
                v-model="files"
                :multiple="true"
              ></v-file-input>
              <v-btn
                @click="uploadFile()"
                class="_button_194hd_2 _outlined_194hd_112 _small_194hd_37"
                text
              >
                <v-icon>mdi-upload</v-icon>
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-dialog>
      <v-dialog v-model="urlModalOpen" max-width="500">
        <v-card>
          <v-card-title>Enter URL</v-card-title>
          <v-card-text>
            <v-text-field label="URL" v-model="url" outlined></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="processURL">Submit</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-main>
  </v-app>
</template>
<script>
import { QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import "@vueup/vue-quill/dist/vue-quill.bubble.css";
import { io } from "socket.io-client";
import axios from "axios";
import { toast } from "vue3-toastify";
import "vue3-toastify/dist/index.css";
const { VITE_API_URL, VITE_SOCKET_URL } = import.meta.env;
axios.defaults.baseURL = VITE_API_URL;

axios.defaults.headers.post["Content-Type"] =
  "application/x-www-form-urlencoded";
axios.defaults.headers.common["Authorization"] = `Bearer ${localStorage.getItem(
  "authorization"
)}`;

/*const socket = io(VITE_SOCKET_URL, {
  extraHeaders: {
    Authorization: `Bearer ${localStorage.getItem("authorization")}`,
  },
  query: { token: localStorage.getItem("authorization") },
  autoConnect: true,
  //transports: ["websocket"],
});*/

export default {
  components: {
    QuillEditor,
  },
  data() {
    return {
      statusMessage: false,
      url: "",
      dialog: false,
      modalOpenFile: false,
      urlModalOpen: false,
      tab: null,
      tabs: [
        {
          value: "1",
          text: "Chat",
        },
        {
          value: "2",
          text: "Embedding",
        },
      ],

      files: [],
      uploadProgress: 0,

      selectedLanguage: { id: 1, name: "Español" },
      selectedTone: { id: 0.7, name: "Defecto", selected: true },
      languages: [
        { id: 1, name: "Español" },
        { id: 2, name: "Inglés" },
        { id: 3, name: "Euskera" },
      ],
      tones: [
        { id: 1, name: "Loco 10" },
        { id: 0.9, name: "Muy Creactivo 0.9" },
        { id: 0.8, name: "Creactivo 0.8" },
        { id: 0.7, name: "Defecto 0.7" },
        { id: 0.6, name: "Explorador 0.6" },
        { id: 0.5, name: "Balanceado 0.5" },
        { id: 0.4, name: "Analítico 0.4" },
        { id: 0.3, name: "Preciso 0.3" },
        { id: 0.2, name: "Conciso 0.2" },
        { id: 0.1, name: "Genio - 0.1" },
      ],
      quill: null,

      messages: [],
      newMessage: "",
    };
  },
  methods: {
    openModalFile() {
      this.modalOpenFile = true;
    },
    notify(text, type = "success") {
      toast[type](text, {
        position: "top-right",
        timeout: 2000,
        closeOnClick: true,
        pauseOnFocusLoss: true,
        pauseOnHover: true,
        draggable: true,
        draggablePercent: 0.6,
        showCloseButtonOnHover: false,
        hideProgressBar: false,
        closeButton: "button",
        color: "#000000",
        icon: true,
        rtl: false,
        bodyClassName: "toastify-body",
      });
    },
    openURLModal() {
      this.urlModalOpen = true;
    },
    async processURL() {
      try {
        if (!this.url) return;

        await axios.post("/strapi-chat/inscrustacion-url", { url: this.url });

        this.urlModalOpen = false;
      } catch (error) {
        console.log(error);

        this.urlModalOpen = false;
      }
    },
    async uploadFile() {
      try {
        if (this.files.length == 0) return;
        this.dialog = true;
        let formData = new FormData();

        if (this.files.length === 1) {
          // Si solo hay un archivo, agrégalo directamente a formData sin iterar
          const file = this.files[0];
          formData.append("files[]", file, file.name);
        } else {
          // Si hay múltiples archivos, itera sobre ellos y agrégalos a formData
          for (let file of this.files) {
            formData.append("files[]", file, file.name);
          }
        }

        await axios.post("/strapi-chat/upload-file", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentage = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );

            // Actualizar el porcentaje de carga en el popup
            this.uploadProgress = percentage;
          },
        });

        setTimeout(() => {
          this.uploadProgress = 0;
        }, 2000);
        this.dialog = false;
        this.modalOpenFile = false;
      } catch (error) {
        this.dialog = false;
        this.modalOpenFile = false;
        console.log(error);
      }
    },
    onFileChange(e) {
      this.files = e.target.files;
    },

    onQuillReady(quill) {
      this.quill = quill;
    },
    pasarAlEditor(texto) {
      let quill = this.quill;

      quill.setContents(quill.clipboard.convert(texto));
    },
    async sendMessage(type = 1) {
      console.log(this.newMessage);
      if (this.newMessage) {
        try {
          this.statusMessage = true;
          let data = {
            sessionId: localStorage.getItem("sessionId") || null,
            message: this.newMessage,
            language: this.selectedLanguage.name,
            tone: this.selectedTone.id,
            history: this.messages,
            type: type == 1 ? "chat" : "emberding",
          };

          this.messages.push({
            sender: "You",
            content: this.newMessage,
            time: new Date().toLocaleTimeString(),
          });

          this.newMessage = "";
          /* socket.emit("sendMessage", data);

          socket.on("responseMessage", (data) => {
            console.log(data);
            localStorage.setItem("sessionId", data.sessionId);

            this.messages.push({
              sender: "Rytr",
              content:
                type == 1
                  ? data.response
                  : data.text,
              time: new Date().toLocaleTimeString(),
            });
          });*/
          let response = await axios.post("/strapi-chat/chat", { data });

          localStorage.setItem("sessionId", response.data.data.sessionId);

          this.messages.push({
            sender: "Rytr",
            content:
              type == 1 ? response.data.data.response : response.data.data.text,
            time: new Date().toLocaleTimeString(),
          });
          this.statusMessage = false;

        } catch (error) {
          console.log(error);
          this.statusMessage = false;
        }
      }
    },
    async recoveryHistoryChat() {
      try {
        var sessionId = (await localStorage.getItem("sessionId")) || null;

        if (sessionId === null || sessionId === undefined || sessionId === "") {
          return;
        }

        if (
          sessionId == undefined ||
          sessionId == null ||
          sessionId == "null" ||
          sessionId == "undefined"
        ) {
          localStorage.removeItem("sessionId");

          return;
        }

        let response = await axios.get(
          `/strapi-chat/get-session-by-id/${sessionId}`
        );

        let mensajes = response.data.data?.history;

        if (!mensajes) return;

        mensajes.forEach((element, index) => {
          //salto el primer mensaje que es el de bienvenida
          if (index == 0) return;

          // recorro el contenido y elimino de los tipo human la palabra "Responde en: this.selectedLanguage.name "

          if (element.type == "human") {
            element.data.content = element.data.content.replace(
              `Responde en: ${this.selectedLanguage.name}`,
              ""
            );
          }

          this.messages.push({
            sender: element.type == "human" ? "You" : "Rytr",
            content: element.data.content,
            time: new Date().toLocaleTimeString(),
          });
        });
      } catch (error) {
        console.log(error);
      }
    },
  },
  async mounted() {
    await this.recoveryHistoryChat();
    /*console.log("mounted");
    socket.connect();
    socket.on("connect", () => {
      this.notify("Connection Success");
    });
    socket.emit("connection", "data");
    socket.onDisconnect((_) => print("Connection Disconnection"));
    socket.onConnectError((err) => print(err));
    socket.onError((err) => print(err));*/
  },
  computed: {
    Authorization() {
      return `Bearer ${localStorage.getItem("token")}`;
    },
  },
};
</script>

<style>
body {
  overflow: hidden;
}
body {
  scrollbar-width: none; /* Oculta la barra de desplazamiento en navegadores que la soportan */
}

/* Estilos personalizados para la barra de desplazamiento en WebKit */
body::-webkit-scrollbar {
  width: 0; /* Ancho de la barra de desplazamiento */
  background-color: transparent; /* Color de fondo de la barra de desplazamiento */
}
.v-field__outline {
  border: unset !important;
}
.v-select .v-field .v-text-field__prefix,
.v-select .v-field .v-text-field__suffix,
.v-select .v-field .v-field__input,
.v-select .v-field.v-field {
  cursor: pointer;
  border-radius: 30px;
  outline: unset;
  border-bottom: unset;
}
.selectores {
  display: flex;
  flex-direction: row;
  align-items: center;
  cursor: pointer;
  outline: none;
  border: 1px solid var(--border-dark);

  color: var(--text);

  border-radius: 1.4rem;
  transition-property: border;
  transition-duration: 0.2s;
  height: 2.5rem;
  padding: 0 0.5rem;
}
button:focus,
button:focus-visible {
  outline: none;
}
.toastify-body {
  color: #000000 !important;
}
.Toastify__toast-theme--colored.Toastify__toast--success {
  background: #00b894 !important;
  color: #000000 !important;
}
.lds-ellipsis {
  display: inline-block;
  position: relative;
  width: 80px;
  height: 80px;
}
.lds-ellipsis div {
  position: absolute;
  top: 33px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #00b894;
  animation-timing-function: cubic-bezier(0, 1, 1, 0);
}

.lds-ellipsis div:nth-child(1) {
  left: 8px;
  animation: lds-ellipsis1 0.6s infinite;
}

.lds-ellipsis div:nth-child(2) {
  left: 8px;
  animation: lds-ellipsis2 0.6s infinite;
}

.lds-ellipsis div:nth-child(3) {
  left: 32px;
  animation: lds-ellipsis2 0.6s infinite;
}

.lds-ellipsis div:nth-child(4) {
  left: 56px;
  animation: lds-ellipsis3 0.6s infinite;
}

@keyframes lds-ellipsis1 {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes lds-ellipsis3 {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(0);
  }
}

@keyframes lds-ellipsis2 {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(24px, 0);
  }
}


</style>
