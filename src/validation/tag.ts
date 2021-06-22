import Joi from 'joi';

const customValidation = (value: string) => {
    // Regex that matches every character that's not an alphabet, number, hyphen or underscore.
    const validationRegex = /[^a-zA-Z0-9\-_]/g;
    // If there is a character that matches the above regex, throw an error
    // because we only want to allow letters, numbers, hyphens and underscores.
    if (validationRegex.test(value)) throw new Error();

    return value;
}

export const tagSchema = Joi.object({
    title: Joi.string()
        .custom(customValidation, "Custom Validation")
        .min(3)
        .max(20)
        .trim()
        .required()
        .label("Tag Name")
        .messages({
            'any.custom': "Tag name must only contain alphabets, numbers, hyphens or underscores"
        })
});