'use strict';
require('dotenv').config();
const express = require('express');
const myDB = require('./connection');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const session = require('express-session');
const passport = require('passport');

const passportSocketIo = require('passport.socketio');
const MongoStore = require('connect-mongo')(session);
const cookieParser = require('cookie-parser');

const URI = process.env.MONGO_URI;
const store = new MongoStore({ uri: URI });

const routes = require('./routes.js');
const auth = require('./auth.js');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false },
  key: 'express.sid',
  store: store,
}));

app.set('view engine', 'pug');
app.set('views', './views/pug');

// app.route('/').get((req, res) => {
//   res.render('index', { title: 'Hello', message: 'Please log in' })
// });

const PORT = process.env.PORT || 3000;

myDB(async client => {
  const myDataBase = await client.db('cluster1').collection('users');

  routes(app, myDataBase);
  auth(app, myDataBase);

  let currentUsers = 0;
  io.on('connect', (socket) => {
    ++currentUsers;
    io.emit('user count', currentUsers);
    console.log('A user has connected!');

    socket.on('disconnect', () => {
      --currentUsers;
      io.emit('user count', currentUsers);
      console.log('A user has disconnected!')
    })
  });

  io.use(
    passportSocketIo.authorize({
      cookieParser: cookieParser,
      key: 'express.sid',
      secret: process.env.SESSION_SECRET,
      store: store,
      success: onAuthorizeSuccess,
      fail: onAuthorizeFail
    })
  );
}).catch(e => {
  app.route('/').get((req, res) => {
    res.render('index', { title: e, message: 'Unable to connect to database' });
  });

  function onAuthorizeSuccess(data, accept) {
    console.log('successful connection to socket.io');
  
    accept(null, true);
  }
  
  function onAuthorizeFail(data, message, error, accept) {
    if (error) throw new Error(message);
    console.log('failed connection to socket.io:', message);
    accept(null, false);
  }

  io.on('connection', socket => {
    console.log('A user has connected!')
  })
});

app.use(passport.initialize());
app.use(passport.session());

http.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});