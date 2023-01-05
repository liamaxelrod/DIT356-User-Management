const jwt = require('jsonwebtoken');

const authenticationResponseTopic = 'dentistimo/authentication/response';

module.exports = {
    async handleVerifyIdTokenRequest(topic, payload, client) {
        // Extract the idToken and role from the payload
        const { idToken, role } = JSON.parse(payload.toString());

        // Verify the idToken
        try {
            const decoded = jwt.verify(idToken, process.env.JWT_SECRET);
            // Check if the role in the JWT matches the role provided in the request
            if (decoded.role === role) {
                // Send a response with the status "Authorized" and the ID of the token
                client.publish(
                    authenticationResponseTopic,
                    JSON.stringify({ status: 'Authorized', ID: decoded.ID })
                );
            } else {
                // If the roles don't match, send a response with the status "Unauthorized"
                client.publish(
                    authenticationResponseTopic,
                    JSON.stringify({ status: 'Unauthorized' })
                );
            }
        } catch (error) {
            // If the idToken is invalid, send a response with the status "Unauthorized"
            client.publish(
                authenticationResponseTopic,
                JSON.stringify({ status: 'Unauthorized' })
            );
        }
    },
};
