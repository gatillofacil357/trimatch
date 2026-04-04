import localtunnel from 'localtunnel';

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    console.log("======================================================");
    console.log("TUNNEL_URL: " + tunnel.url);
    console.log("======================================================");
    
    tunnel.on('close', () => {
      console.log("Túnel cerrado.");
    });
  } catch (e) {
    console.error("Error al crear el túnel:", e);
  }
})();
