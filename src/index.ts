import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import helmet from 'helmet';
import path from 'path';
import sessions from 'client-sessions';
import config from '../config';
import User from './database/models/User';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import wallpaperRoutes from './routes/wallpapers';
import tagRoutes from './routes/tags';

const DiscordStrategy = require('passport-discord').Strategy;

// Middleware setup ===========================================
const app = express();

// Helmet without contentSecurityPolicyset to false
// blocks the react frontend from loading for some reason.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
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

// Serve the static files such as wallpapers
app.use(express.static(path.join(__dirname, '../public')));
// Serve the static files from the built ReactJS client.
const CLIENT_PATH = path.join(__dirname, '../build');
app.use(express.static(CLIENT_PATH));

// Configure passport sessions ================================
passport.serializeUser(function (user: any, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err: any, user: any) {
        done(err, user);
    });
});

// Set up Passport Discord Strategy ===========================
passport.use(new DiscordStrategy({
    clientID: config.discordClient.id,
    clientSecret: config.discordClient.secret,
    callbackURL: '/auth/discord/callback',
    scope: ['identify', 'guilds']
},
    (accessToken: any, refreshToken: any, profile: any, cb: any) => {
        // Only log user in if they are in the 150 percent server.
        let userEligible = checkUserEligibility(profile.guilds);
        if (userEligible) {
            User.findOneAndUpdate({
                discordId: profile.id
            }, // query
                {
                    discordId: profile.id,
                    username: profile.username,
                    discriminator: profile.discriminator
                }, // update
                { upsert: true, useFindAndModify: false }, // options (upsert: true creates the object if it doesn't exist.)
                function (err, user) { // callback
                    return cb(err, user);
                });
        } else {
            return cb();
        }
    })
);

// Routes =====================================================
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/wallpapers', wallpaperRoutes);
app.use('/tags', tagRoutes);

// Serve client ===============================================
app.get("/*", (_req: Request, res: Response) => {
    res.sendFile(path.join(CLIENT_PATH, "index.html"));
})

// Connect to DB and start express server. ====================
mongoose.connect(config.mongo.url, config.mongo.options)
    .then(() => {
        console.log("Connected to the database");
        app.listen(config.port, () => {
            console.log(`Server started on port ${config.port}`);
        });
    })

// Custom functions ===========================================
function checkUserEligibility(guilds: any): boolean {
    let userEligible = false;
    guilds.forEach((guild: any) => {
        if (guild.id === '614918030870183963')
            userEligible = true;
    });
    return userEligible;
}