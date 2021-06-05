import express from 'express';
import passport from 'passport';
import { logout, checkAuthenticated } from '../controllers/auth/index';

const router = express.Router();

router.get('/discord', passport.authenticate('discord'));
router.get('/discord/callback', passport.authenticate('discord', {
    successRedirect: "http://localhost:3000",
    failureRedirect: "http://localhost:3000"
}));
router.get('/logout', logout);
router.get('/check', checkAuthenticated);


// Below is the same thing as above but with a custom callback.
// It is important to note that when using a custom callback, sessions
// must be established manually by using req.login(). Otherwise, cookies are not set.
// req.login() uses serializeUser and deserializeUser to set sessions.

/*
* router.get('/discord/callback', function (req, res, next) {
*     passport.authenticate('discord', function (err, user) {
*         if (err) {
*             console.error("An error occurred during authentication.");
*             console.error(err);
*             return next(err);
*         }
*         if (user) {
*             console.log(`User ${user.username} logged in.`);
* 
*             // Create a session if user logs in successfully.
*             // req.login creates a session using serializeUser and deserializeUser
*             req.login(user, function (err) {
*                 if (err) {
*                     console.log(err);
*                     return next(err);
*                 }
*             });
*             return res.redirect("http://localhost:3000");
*         }
*         console.log("User failed to login.");
*         return res.status(401).redirect("http://localhost:3000");
* 
*     })(req, res, next);
* });
*/

export default router;