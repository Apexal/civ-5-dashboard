import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";

import express from "express";

const port = 8080;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Stores connected clients and their responses to keep them alive */
let clients = [];

/** Stores name of latest Civ save file */
let latestAutosavefile = "Pacal_0093 BC-0550-final.civ5save";

/** Watch game save folder */
fs.watch("autosaves", (type, filename) => {
  console.log(`Reacting to ${type} for autosaves/${filename}`);
  latestAutosavefile = filename;

  // Send event to all connected clients that a new file is available
  broadcastEvent("new-file");
});

/** Sends an event to every connected client */
function broadcastEvent(eventType, payload) {
  console.log(`Broadcasting event to all clients`);
  clients.forEach((client) => {
    client.response.write(
      "data: " + JSON.stringify({ type: eventType, payload }) + "\n\n"
    );
  });
}

app.use(express.static("public"));

/** Initiates a long-lived server-side event stream and stores it in `clients`. */
app.get("/events", (request, response) => {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Create new client with response and store it
  const newClient = {
    id: crypto.randomUUID(),
    response,
  };
  clients.push(newClient.id);
  console.log(`${newClient.id} Connection established`);

  // Remove the client from the list when the connection closes
  request.on("close", () => {
    console.log(`${newClient.id} Connection closed`);
    clients = clients.filter((client) => client.id !== newClient.id);
  });
});

/** Respond with latest game save file */
app.get("/latest", (req, res) => {
  res.status(200).set("content-type", "application/octet-stream");
  fs.createReadStream(
    path.join(__dirname, "autosaves", latestAutosavefile)
  ).pipe(res);
});

app.listen(port, () => {
  console.log(`server running: http://localhost:${port}\n`);
});
