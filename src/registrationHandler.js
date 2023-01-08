const { generateUniqueUserId } = require('./helpers/generateId');
const { getUserInfo } = require('./helpers/getUserInfo');
const { findUserByEmail } = require('./helpers/findUser');
const { signJWT } = require('./helpers/JWTHandler');

const registerErrorTopic = 'dentistimo/register/error';
const sendDentistTopic = 'dentistimo/add-dentist';
const registerUserTopic = 'dentistimo/register/user';
const registerDentistTopic = 'dentistimo/register/dentist';

const validator = require('email-validator');
const bcrypt = require('bcrypt');

async function registerUser(client, topic, payload) {
    try {
        // Parse the payload and extract the user information
        const userInfo = getUserInfo(payload);
        if (!userInfo) throw new Error('Invalid JSON');
        const {
            firstName,
            lastName,
            email,
            password,
            passwordCheck,
            requestId,
        } = userInfo;
        let officeId;

        // If the topic is registerDentistTopic, extract the officeId field from the payload
        if (topic === registerDentistTopic) {
            officeId = userInfo.officeId;

            // Validate the officeId field
            if (!officeId) {
                const error = new Error('Office is required');
                client.publish(
                    `${registerErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }
        }

        // Validate the rest of the input fields
        if (!firstName || !lastName || !email || !password || !passwordCheck) {
            const error = new Error('All fields are required');
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }
        if (!validator.validate(email)) {
            const error = new Error('Invalid email address');
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }
        if (password !== passwordCheck) {
            const error = new Error('Passwords do not match');
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }
        if (password.length < 8) {
            const error = new Error(
                'Password must be longer than 8 characters long'
            );
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }

        // Check if email is already registered
        let existingUser = await findUserByEmail(topic, email);
        if (existingUser) {
            const error = new Error('Email is already in use');
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }

        // Hash password and create new user
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(password, salt);
        let newUser;
        if (topic == registerDentistTopic) {
            let dentistId = await generateUniqueUserId(10, true);
            newUser = new Dentist({
                dentistId,
                firstName,
                lastName,
                email,
                password: passwordHash,
                officeId,
            });
        } else {
            let userId = await generateUniqueUserId(10, false);
            newUser = new User({
                userId,
                firstName,
                lastName,
                email,
                password: passwordHash,
            });
        }

        const savedUser = await newUser.save();

        let token = await signJWT(newUser, topic);

        // Publish success or error message
        if (topic == registerDentistTopic) {
            client.publish(
                `${sendDentistTopic}`,
                JSON.stringify({
                    officeId: savedUser.officeId,
                    dentistId: savedUser.dentistId,
                })
            );
            client.publish(
                `${registerDentistTopic}/${requestId}`,
                JSON.stringify({
                    status: 'success',
                    firstName: savedUser.firstName,
                    lastName: savedUser.lastName,
                    email: savedUser.email,
                    officeId: savedUser.officeId,
                    idToken: token,
                })
            );
        } else {
            client.publish(
                `${registerUserTopic}/${requestId}`,
                JSON.stringify({
                    status: 'success',
                    firstName: savedUser.firstName,
                    lastName: savedUser.lastName,
                    email: savedUser.email,
                    idToken: token,
                })
            );
        }
    } catch (error) {
        console.error('[register error]', error.message);
    }
}

module.exports = { registerUser };
