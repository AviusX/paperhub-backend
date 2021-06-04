import express from 'express';

const router = express.Router();

// const router = require('express').Router();
import passport from 'passport';

router.get('/discord', passport.authenticate('discord'));
router.get('/discord/callback', passport.authenticate('discord', {
    successRedirect: "http://localhost:3000",
    failureRedirect: "/login"
}))

export default router;