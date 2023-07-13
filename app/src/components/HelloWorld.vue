<template>
  <div>
    <v-tabs>
      <v-tab>Copy</v-tab>
      <v-tab>Image</v-tab>
      <v-tab-item>
        <form>
          <v-select label="Select language">
            <v-menu>
              <v-list>
                <v-list-item v-for="language in languages" :key="language">{{ language }}</v-list-item>
              </v-list>
            </v-menu>
          </v-select>
          <v-select label="Select tone">
            <v-menu>
              <v-list>
                <v-list-item v-for="tone in tones" :key="tone">{{ tone }}</v-list-item>
              </v-list>
            </v-menu>
          </v-select>
          <v-select label="Choose use case">
            <v-menu>
              <v-list>
                <v-list-item v-for="useCase in useCases" :key="useCase">{{ useCase }}</v-list-item>
              </v-list>
            </v-menu>
          </v-select>
          <v-text-field label="Primary keyword" v-model="keyword"></v-text-field>
          <v-select label="Number of variants">
            <v-menu>
              <v-list>
                <v-list-item v-for="variant in variants" :key="variant">{{ variant }}</v-list-item>
              </v-list>
            </v-menu>
          </v-select>
          <v-select label="Creativity level">
            <v-menu>
              <v-list>
                <v-list-item v-for="level in levels" :key="level">{{ level }}</v-list-item>
              </v-list>
            </v-menu>
          </v-select>
          <v-btn @click="generateContent">Ryte for me</v-btn>
        </form>
      </v-tab-item>
      <v-tab-item>
        <form>
          <v-textarea label="Enter image description" rows="5"></v-textarea>
          <v-btn @click="generateImage">Draw for me</v-btn>
        </form>
      </v-tab-item>
      <v-tab-item>
        <div>
          <v-select label="Select language">
            <v-menu>
              <v-list>
                <v-list-item v-for="language in languages" :key="language">{{ language }}</v-list-item>
              </v-list>
            </v-menu>
          </v-select>
          <v-select label="Select tone">
            <v-menu>
              <v-list>
                <v-list-item v-for="tone in tones" :key="tone">{{ tone }}</v-list-item>
              </v-list>
            </v-menu>
          </v-select>
          <div>
            <div v-for="message in messages" :key="message.id">
              <div v-if="message.sender === 'user'">
                <p>You</p>
              </div>
              <div v-else>
                <p>Rytr</p>
              </div>
              <div>
                <p>{{ message.content }}</p>
              </div>
            </div>
          </div>
          <form>
            <input type="text" placeholder="Enter your message..." maxlength="300" v-model="newMessage">
            <button @click.prevent="sendMessage">Send</button>
            <button @click.prevent="clearMessages">Clear</button>
          </form>
        </div>
      </v-tab-item>
    </v-tabs>
  </div>
</template>

<script>
export default {
  data() {
    return {
      languages: ["🇪🇸 Spanish"],
      tones: ["Convincing"],
      useCases: ["Blog Idea & Outline"],
      variants: ["1 variant"],
      levels: ["Low"],
      keyword: "",
      messages: [
        { id: 1, sender: "user", content: "Hola como estás???" },
        { id: 2, sender: "bot", content: "¡Hola! Estoy aquí para ayudarte en lo que necesites. ¿En qué puedo asistirte hoy?" }
      ],
      newMessage: ""
    };
  },
  methods: {
    generateContent() {
      // Implement your logic for generating content
    },
    generateImage() {
      // Implement your logic for generating image
    },
    sendMessage() {
      if (this.newMessage.trim() !== "") {
        const message = { id: Date.now(), sender: "user", content: this.newMessage };
        this.messages.push(message);
        this.newMessage = "";
        // Implement your logic for handling bot response
      }
    },
    clearMessages() {
      this.messages = [];
    }
  }
};
</script>
