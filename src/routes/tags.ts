import express from 'express';
import isLoggedIn from '../middleware/isLoggedIn';
import { getTags, getTag, createTag } from '../controllers/tags';

const router = express.Router();

router.get('/', getTags); // Sends an array of tag titles.
router.get('/:title', getTag); // Sends the whole tag document.
router.post('/', isLoggedIn, createTag); // Creates the tag and sends error or success message.

export default router;