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
import { PermissionLevel } from './enums/PermissionLevel';

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
    async (accessToken: any, refreshToken: any, profile: any, cb: any) => {
        // Check if a user is a member of 150 percent.
        const isUserChad = checkUserChad(profile.guilds);

        try {
            const userExists = await User.exists({ discordId: profile.id });

            if (userExists) {
                // If user exists, just update their username and discriminator and log them in.

                const user = await User.findOneAndUpdate({ discordId: profile.id },
                    { username: profile.username, discriminator: profile.discriminator },
                    { useFindAndModify: false }
                );

                return cb(null, user);
            } else if (!userExists && isUserChad) {
                // If user doesn't exist but is a member of 150 percent, make a new user
                // with a permission level of Moderator and log them in.

                const user = await User.create({
                    discordId: profile.id,
                    username: profile.username,
                    discriminator: profile.discriminator,
                    permissionLevel: PermissionLevel.Moderator
                });

                return cb(null, user);
            } else {
                // If user doesn't exist and is not a member of 150 percent, just make a new
                // user with the default permission level of user and log them in.

                const user = await User.create({
                    discordId: profile.id,
                    username: profile.username,
                    discriminator: profile.discriminator
                });

                return cb(null, user);
            }
        } catch (err) {
            console.error("Something went wrong while logging the user in:\n", err);
            return cb(err);
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
/**
 * Takes a list of guilds. Returns true if the guild id of 
 * the private Discord server 150 percent exists in the list.
 * Returns false otherwise.
 *
 * @param {*} guilds
 * @return {*}  {boolean}
 */
function checkUserChad(guilds: any): boolean {
    let userEligible = false;
    guilds.forEach((guild: any) => {
        if (guild.id === '614918030870183963')
            userEligible = true;
    });
    return userEligible;
}