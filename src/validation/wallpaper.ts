import Joi from 'joi';

const customTitleValidation = (value: string, helpers: object) => {
    // Match any character that is not a lowercase or uppercase letter, number, hyphen or space.
    const validationRegex = /[^a-zA-Z0-9\- ]/g;
    if (validationRegex.test(value)) throw new Error();
    return value;
}

export const wallpaperSchema = Joi.object({
    title: Joi.string()
        .min(3)
        .max(25)
        .trim()
        .custom(customTitleValidation, 'Custom Validation')
        .required()
        .label("Title")
        .messages({
            'any.custom': "Allowed characters are: letters, numbers, hyphens and space."
        }),
    tags: Joi.array()
        .items(Joi.string())
        .required()
        .label("Tags")
        .messages({
            'string.empty': "You must select at least one tag."
        })
});