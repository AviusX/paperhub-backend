import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import helmet from 'helmet';
import sessions from 'client-sessions';
import config from '../config';
import User from './database/models/User';
import authRoutes from './routes/auth';

const DiscordStrategy = require('passport-discord').Strategy;
const app = express();
app.use(helmet());

// Set up sessions
app.use(sessions({
    cookieName: "session", // cookie name dictates the key name added to the request object
    secret: config.sessions.secret, // should be a large unguessable string
    duration: 1000 * 60 * 60 * 24, // how long the session will stay valid in ms
    activeDuration: 1000 * 60 * 5, // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
    cookie: {
        httpOnly: true, // Cookie is not accessible from javascript
        ephemeral: true, // Exit session when browser closes
        secure: config.production // Only allow through SSL
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Configure passport sessions
passport.serializeUser((user: any, done: any) => done(null, user.id));

passport.deserializeUser((id: any, done: any) => {
    User.findById(id, (err: any, user: any) => done(err, user));
});

// Set up Passport Discord Strategy
passport.use(new DiscordStrategy({
    clientID: config.discordClient.id,
    clientSecret: config.discordClient.secret,
    callbackURL: '/auth/discord/callback',
    scope: ['identify', 'guilds']
},
    (accessToken: any, refreshToken: any, profile: any, cb: any) => {
        User.findOneAndUpdate({ discordId: profile.id }, // query
            { discordId: profile.id, username: profile.username }, // update
            { upsert: true }, // options (upsert: true creates the object if it doesn't exist.)
            function (err, user) { // callback
                return cb(err, user);
            });
    })
);

// Routes
app.use("/auth", authRoutes);

// Connect to DB and start express server.
mongoose.connect(config.mongo.url, config.mongo.options)
    .then(() => {
        console.log("Connected to the database");
        app.listen(config.port, () => {
            console.log(`Server started on port ${config.port}`);
        });
    })