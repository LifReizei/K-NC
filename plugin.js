// Hola Mundo funcional para Kino
kino.register({
  async home(ctx) {
    return {
      sections: [{
        title: "Test",
        items: [{ id: "test", title: "Test", type: "anime" }]
      }]
    };
  },
  async resolve(ctx) {
    throw kino.error("not_found", "No disponible.");
  }
});
