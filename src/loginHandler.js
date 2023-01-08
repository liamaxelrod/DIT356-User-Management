const { getUserInfo } = require('./helpers/getUserInfo');
const { findUserByEmail } = require('./helpers/findUser');
const { signJWT } = require('./helpers/JWTHandler');

const loginErrorTopic = 'dentistimo/login/error';
const loginUserTopic = 'dentistimo/login/user';
const loginDentistTopic = 'dentistimo/login/dentist';

const bcrypt = require('bcrypt');

async function login(client, topic, payload) {
    // Parse the payload and extract the email, password, and requestId
    let user;
    try {
        // Parse the payload and extract the user information
        const userInfo = getUserInfo(payload);
        if (!userInfo) throw new Error('Invalid JSON');
        let { email, password, requestId } = userInfo;
        // Check if the email and password fields are present
        if (!email || !password) {
            // If either field is missing, throw an error and publish an error message
            const error = new Error('All fields are required');
            client.publish(`${loginErrorTopic}/${requestId}`, error.message);
            throw error;
        }
        // Check if the topic is for user or dentist logins
        if (topic == loginUserTopic) {
            // If the topic is for user logins, find the user with the matching email
            user = await findUserByEmail(topic, email);
            // If no user is found, throw an error and publish an error message
            if (!user) {
                const error = new Error('User name or password incorrect');
                client.publish(
                    `${loginErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }
            // Validate the password
            let isMatch = await bcrypt.compare(password, user.password);
            // If the password is invalid, throw an error and publish an error message
            if (!isMatch) {
                const error = new Error('User name or password incorrect');
                client.publish(
                    `${loginErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }

            let token = await signJWT(user);

            // Publish the login success message with the JWT token
            client.publish(
                `${loginUserTopic}/${requestId}`,
                JSON.stringify({
                    idToken: token,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    userId: user.userId,
                })
            );
        } else if (topic == loginDentistTopic) {
            // If the topic is for dentist logins, find the dentist with the matching email
            user = await findUserByEmail(topic, email);
            // If no dentist is found, throw an error and publish an error message
            if (!user) {
                const error = new Error('User name or password incorrect');
                client.publish(
                    `${loginErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }

            // Validate the password
            let isMatch = await bcrypt.compare(password, user.password);
            // If the password is invalid, throw an error and publish an error message
            if (!isMatch) {
                const error = new Error('User name or password incorrect');
                client.publish(
                    `${loginErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }

            let token = await signJWT(user, topic);

            // Publish the login success message with the JWT token and company name
            client.publish(
                `${loginDentistTopic}/${requestId}`,
                JSON.stringify({
                    idToken: token,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    officeId: user.officeId,
                    dentistId: user.dentistId,
                })
            );
        }
    } catch (error) {
        // Log any errors that occur
        console.log('[login]', error.message);
    }
}

module.exports = { login };
