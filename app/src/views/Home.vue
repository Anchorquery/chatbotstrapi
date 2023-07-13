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
                <v-window-item value="2">
                  <div
                    class="_chat_1qglh_1"
                    style="height: 100%; margin-top: 30px"
                  >
                    <div style="display: flex;">
                      <v-file-input
                        label="File input"
                        variant="solo"
                        width = "70%"
                        prepend-icon="mdi-paperclip"
                        accept="image/*, application/pdf"
                        v-model="file"
                        @change="onFileChange"

                      ></v-file-input>
                      <v-btn
                        @click="uploadFile()"
                        class="_button_194hd_2 _outlined_194hd_112 _small_194hd_37"
                        text
                      >
                        <v-icon>mdi-upload</v-icon>
                      </v-btn>
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
      <v-dialog
      v-model="dialog"
      
      persistent
      width="auto"
    >
      <v-card
        color="primary"
      >
        <v-card-text>
          Cargando ...
          <v-progress-linear
            indeterminate
            color="white"
            class="mb-0"
          ></v-progress-linear>
        </v-card-text>
      </v-card>
    </v-dialog>
    </v-main>
  </v-app>
</template>
<script>
import { QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import "@vueup/vue-quill/dist/vue-quill.bubble.css";
import qs from "qs";
import axios from "axios";
axios.defaults.baseURL = "http://localhost:1337/api";
axios.defaults.headers.post["Content-Type"] =
  "application/x-www-form-urlencoded";
axios.defaults.headers.common["Authorization"] = `Bearer ${localStorage.getItem(
  "authorization"
)}`;

// activo autenticacion

export default {
  components: {
    QuillEditor,
  },
  data() {
    return {
      dialog: false,
      tab: null,
      tabs: [
        {
          value: "1",
          text: "Chat",
        },
        {
          value: "2",
          text: "PDF",
        },
      ],
      file: "",

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

    async uploadFile() {
      try {
        
    this.dialog = true;

        let formData = new FormData();

        // agrego el archivo

        formData.append("file", this.file);

        // subo el archivo

         await axios.post("/strapi-chat/upload-file", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        this.dialog = false;
        // obtengo el texto del archivo
      } catch (error) {
        console.log(error);
      }
    },

    onFileChange(e) {
      let files = e.target.files || e.dataTransfer.files;
      if (!files.length) return;
      this.createImage(files[0]);
    },

    onQuillReady(quill) {
      this.quill = quill;
    },
    pasarAlEditor(texto) {
      let quill = this.quill;

      quill.setContents(quill.clipboard.convert(texto));
    },
    async sendMessage() {
      if (this.newMessage) {
        try {
          let data = {
            sessionId: localStorage.getItem("sessionId") || null,
            message: this.newMessage,
            language: this.selectedLanguage.name,
            tone: this.selectedTone.id,
            type: "chat",
          };
          console.log(data);
          this.messages.push({
            sender: "You",
            content: this.newMessage,
            time: new Date().toLocaleTimeString(),
          });

          this.newMessage = "";
          let response = await axios.post("/strapi-chat/chat", { data });

          localStorage.setItem("sessionId", response.data.data.sessionId);

          this.messages.push({
            sender: "Rytr",
            content: response.data.data.response,
            time: new Date().toLocaleTimeString(),
          });
        } catch (error) {
          console.log(error);
        }
      }
    },
    async recoveryHistoryChat() {
      try {
        // verifico si en el localstorage existe el sessionId

        if (!localStorage.getItem("sessionId")) return;

        let sessionId = localStorage.getItem("sessionId");

        let response = await axios.get(
          `/strapi-chat/get-session-by-id/${sessionId}`
        );

        let mensajes = response.data.data?.history;

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
      } catch (error) {}
    },
  },
  async mounted() {
    await this.recoveryHistoryChat();
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
</style>
