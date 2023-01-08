const jwt = require('jsonwebtoken');

const authenticationResponseTopic = 'dentistimo/authentication/response';
const registerDentistTopic = 'dentistimo/register/dentist';
const loginDentistTopic = 'dentistimo/login/dentist';

module.exports = {
    async handleVerifyIdTokenRequest(topic, payload, client) {
        // Extract the idToken and role from the payload
        const { idToken } = JSON.parse(payload.toString());

        // Verify the idToken
        try {
            const decoded = await jwt.verify(idToken, process.env.JWT_SECRET);
            console.log(decoded);
            // Check if the role in the JWT matches the role provided in the request
            if (decoded.role === 'User') {
                console.log('Authorized');
                // Send a response with the status "Authorized" and the ID of the token
                client.publish(
                    authenticationResponseTopic,
                    JSON.stringify({
                        status: 'Authorized',
                        id: decoded.aud,
                        role: 'User',
                    })
                );
            } else if (decoded.role === 'Dentist') {
                console.log('Authorized');
                // Send a response with the status "Authorized" and the ID of the token
                client.publish(
                    authenticationResponseTopic,
                    JSON.stringify({
                        status: 'Authorized',
                        id: decoded.aud,
                        role: 'Dentist',
                    })
                );
            } else {
                console.log('Unauthorized');
                // If the roles don't match, send a response with the status "Unauthorized"
                client.publish(
                    authenticationResponseTopic,
                    JSON.stringify({ status: 'Unauthorized' })
                );
            }
        } catch (error) {
            // If the idToken is invalid, send a response with the status "Unauthorized"
            console.log(error.message);
            client.publish(
                authenticationResponseTopic,
                JSON.stringify({ status: 'Unauthorized' })
            );
        }
    },

    async signJWT(user, topic) {
        let token;

        if (topic == registerDentistTopic || topic == loginDentistTopic) {
            // Create the JWT tokens object
            let tokens = {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: 'Dentist',
            };
            // Sign the JWT token
            token = jwt.sign(tokens, process.env.JWT_SECRET, {
                issuer: 'Dentistimo-User-Management',
                audience: user.dentistId.toString(),
                expiresIn: 360000,
            });
        } else {
            // Create the JWT tokens object
            let tokens = {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: 'User',
            };
            token = jwt.sign(tokens, process.env.JWT_SECRET, {
                issuer: 'Dentistimo-User-Management',
                audience: user.userId.toString(),
                expiresIn: 360000,
            });
        }

        return token;
    },
};
