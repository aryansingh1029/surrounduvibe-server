const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

// Create upload directory if not exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const name = path.parse(file.originalname).name;
    const filename = name + '.mp3';
    cb(null, filename);
  }
});
const upload = multer({ storage });

// Serve static and uploaded files
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));

// Basic test route to keep app alive on Railway
app.get('/', (req, res) => {
  res.send('SurroundUvibe backend is running ✅');
});

// Handle audio upload
app.post('/upload', upload.single('audio'), (req, res) => {
  const filePath = '/uploads/' + req.file.filename;
  res.json({ filename: filePath });
});

// =============== SOCKET.IO ===============
const users = {}; // socket.id → { name }

io.on('connection', (socket) => {
  console.log('🔗 New connection:', socket.id);

  socket.on('register', (name) => {
    users[socket.id] = { name };
    updateUserList();
  });

  socket.on("seek", (position) => {
    socket.broadcast.emit("seek", position);
  });

  socket.on("ping-time", () => {
    socket.emit("pong-time", Date.now());
  });

  socket.on("get-server-time", () => {
    socket.emit("server-time", Date.now());
  });

  socket.on("file-ready", (src) => {
    socket.broadcast.emit("file-ready", src);
  });

  socket.on("play", (data) => {
    socket.broadcast.emit("play", data);
  });

  socket.on("toggle", (action) => {
    socket.broadcast.emit("toggle", action);
  });

  socket.on("stop", () => {
    socket.broadcast.emit("stop");
  });

  socket.on("volume", (value) => {
    socket.broadcast.emit("volume", value);
  });

  socket.on("host-mute", (id) => {
    io.to(id).emit("mute");
  });

  socket.on("host-kick", (id) => {
    io.to(id).emit("kick");
    io.sockets.sockets.get(id)?.disconnect(true);
    delete users[id];
    updateUserList();
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    updateUserList();
  });

  function updateUserList() {
    const userArray = Object.entries(users).map(([id, data]) => ({
      id,
      name: data.name
    }));
    io.emit("update-user-list", userArray);
  }
});

// ✅ Use dynamic port on Railway
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
